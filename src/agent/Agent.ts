import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createModel } from '../models/registry.js';
import { MODELS, type ModelInfo } from '../models/list.js';
import { listFilesTool, listFilesInDir } from '../tool/listFiles.js';

const TOOLS = [listFilesTool];

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

  private async invokeWithTools(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.model.bindTools) throw new Error('Current model does not support tool use');
    const boundModel = this.model.bindTools(TOOLS);
    const messages: Parameters<typeof boundModel.invoke>[0] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    for (;;) {
      const response = await boundModel.invoke(messages);
      messages.push(response);

      const toolCalls = response.tool_calls ?? [];
      if (toolCalls.length === 0) {
        if (typeof response.content !== 'string') throw new Error('Unexpected response type');
        return response.content.trim();
      }

      for (const call of toolCalls) {
        const result = await listFilesTool.invoke(call.args as { path: string });
        messages.push(new ToolMessage({ tool_call_id: call.id ?? '', content: result }));
      }
    }
  }

  async suggest(prompt: string): Promise<string> {
    return this.invokeWithTools(
      `You are a coding assistant. You have access to a tool that lets you explore the project directory.
Use it when the user's request requires understanding project structure.
When you have gathered enough context, return ONLY a raw code snippet with no explanation, no markdown fences, and no prose.`,
      prompt,
    );
  }

  async init(): Promise<string> {
    const files = await listFilesInDir('.');
    const result = await this.model.invoke([
      new SystemMessage(
        `You are a project analyst. Write a concise markdown document describing the project: its purpose, directory structure, key files, and architecture. Output only the markdown content — no preamble, no code fences around the whole document.`,
      ),
      new HumanMessage(`Project file tree:\n\n${files}\n\nDescribe this project.`),
    ]);
    if (typeof result.content !== 'string') throw new Error('Unexpected response type');
    return result.content.trim();
  }
}
