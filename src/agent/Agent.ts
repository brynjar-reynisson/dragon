import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createModel } from '../models/registry.js';
import { MODELS, type ModelInfo } from '../models/list.js';
import { listFilesTool, listFilesInDir } from '../tool/listFiles.js';
import { readFileTool } from '../tool/readFile.js';

const TOOLS = [listFilesTool, readFileTool];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = { name: string; invoke: (args: any) => Promise<unknown> };

export type OnToolCall = (name: string, args: Record<string, unknown>) => void;

export class Agent {
  private model: BaseChatModel;

  constructor(initialModelId: string) {
    const info = MODELS.find(m => m.id === initialModelId);
    if (!info) throw new Error(`Unknown model: "${initialModelId}"`);
    this.model = createModel(info);
  }

  setModel(info: ModelInfo): void {
    this.model = createModel(info);
  }

  private async invokeWithTools(
    tools: AnyTool[],
    systemPrompt: string,
    userPrompt: string,
    onToolCall?: OnToolCall,
  ): Promise<string> {
    if (!this.model.bindTools) throw new Error('Current model does not support tool use');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boundModel = this.model.bindTools(tools as any);

    // Standard multi-turn messages; only used for non-thinking models.
    const messages: Parameters<typeof boundModel.invoke>[0] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    // Thinking models (e.g. DeepSeek reasoning) embed `reasoning_content` in the
    // assistant turn. LangChain's serializer drops it, causing a 400 on the next
    // turn. We work around this by never passing the AIMessage back; instead we
    // accumulate tool results as text and rebuild the conversation each turn.
    const thinkingToolContext: string[] = [];

    for (;;) {
      const callMessages = thinkingToolContext.length > 0
        ? [
            new SystemMessage(systemPrompt),
            new HumanMessage(
              `${userPrompt}\n\nPrevious tool results:\n${thinkingToolContext.join('\n')}`,
            ),
          ]
        : messages;

      const response = await boundModel.invoke(callMessages);
      const toolCalls = response.tool_calls ?? [];

      if (toolCalls.length === 0) {
        if (typeof response.content !== 'string') throw new Error('Unexpected response type');
        return response.content.trim();
      }

      const isThinking = !!response.additional_kwargs?.reasoning_content;
      if (!isThinking) messages.push(response);

      for (const call of toolCalls) {
        const t = tools.find(t => t.name === call.name);
        if (!t) throw new Error(`Unknown tool: "${call.name}"`);
        onToolCall?.(call.name, call.args as Record<string, unknown>);
        const result = String(await t.invoke(call.args));
        if (isThinking) {
          thinkingToolContext.push(`[${call.name}] ${JSON.stringify(call.args)}\n${result}`);
        } else {
          messages.push(new ToolMessage({ tool_call_id: call.id ?? '', content: result }));
        }
      }
    }
  }

  async suggest(prompt: string, onToolCall?: OnToolCall): Promise<string> {
    return this.invokeWithTools(
      TOOLS,
      `You are a coding assistant. You have access to tools that let you explore the project directory.
Use them when the user's request requires understanding project structure or file contents.
When you have gathered enough context, return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.`,
      prompt,
      onToolCall,
    );
  }

  async init(onToolCall?: OnToolCall): Promise<string> {
    const files = await listFilesInDir('.');
    return this.invokeWithTools(
      [readFileTool],
      `You are a project analyst. You have been given the project file tree. Use the read_file tool to read whichever files you need to understand the project, then write a concise markdown document describing it: its purpose, directory structure, key files, and architecture. Output only the markdown content — no preamble, no code fences around the whole document.`,
      `Project file tree:\n\n${files}\n\nDescribe this project.`,
      onToolCall,
    );
  }
}
