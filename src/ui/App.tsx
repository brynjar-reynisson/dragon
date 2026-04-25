import React, { useEffect, useState } from 'react';
import { Box, Text, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';
import { type ModelInfo } from '../models/list.js';
import { fetchOllamaModels } from '../models/ollama.js';
import { saveModel } from '../models/persistence.js';
import { availableModels, unavailableProviderMessages } from '../models/availability.js';

interface Props {
  agent: Agent;
  initialModelId: string;
  savedModelId: string | null;
}

export function App({ agent, initialModelId, savedModelId }: Props) {
  const [history, setHistory] = useState<Array<{ query: string; snippet: string; error: string | null }>>([]);
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const [models, setModels] = useState<ModelInfo[]>(availableModels());
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  useEffect(() => {
    fetchOllamaModels().then(ollamaModels => {
      const merged = ollamaModels.length > 0 ? [...availableModels(), ...ollamaModels] : availableModels();
      if (ollamaModels.length > 0) setModels(merged);

      if (savedModelId !== null && savedModelId !== initialModelId) {
        const found = merged.find(m => m.id === savedModelId);
        if (found) {
          agent.setModel(found);
          setSelectedModel(savedModelId);
        } else {
          setNotice(`Previously selected model "${savedModelId}" is not available.`);
        }
      }
    });
  }, [savedModelId, initialModelId, agent]);

  const handleSubmit = async (query: string) => {
    if (lastQuery && (snippet || error)) {
      setHistory(h => [...h, { query: lastQuery, snippet, error }]);
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    setSnippet('');
    setLastQuery(query);
    try {
      const result = await agent.suggest(query);
      setSnippet(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (id: string) => {
    const info: ModelInfo = models.find(m => m.id === id) ?? { id, provider: 'ollama' };
    try {
      agent.setModel(info);
      setSelectedModel(id);
      setError(null);
      setNotice(null);
      saveModel(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {history.map((item, i) => (
        <SnippetView key={i} snippet={item.snippet} loading={false} error={item.error} query={item.query} />
      ))}
      <SnippetView snippet={snippet} loading={loading} error={error} query={lastQuery} />
      {notice && <Text dimColor>{notice}</Text>}
      <InputBar
        disabled={loading}
        selectedModel={selectedModel}
        models={models}
        unavailableNotices={unavailableProviderMessages()}
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
