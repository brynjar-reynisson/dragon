import React, { useEffect, useState } from 'react';
import { Box, Text, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';
import { MODELS, type ModelInfo } from '../models/list.js';
import { fetchOllamaModels } from '../models/ollama.js';
import { saveModel } from '../models/persistence.js';

interface Props {
  agent: Agent;
  initialModelId: string;
  savedModelId: string | null;
}

export function App({ agent, initialModelId, savedModelId }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const [models, setModels] = useState<ModelInfo[]>(MODELS);
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  useEffect(() => {
    fetchOllamaModels().then(ollamaModels => {
      const merged = ollamaModels.length > 0 ? [...MODELS, ...ollamaModels] : MODELS;
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

  const handleSubmit = async (query: string, language?: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setSnippet('');
    try {
      const result = await agent.suggest(query, language);
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
      <SnippetView snippet={snippet} loading={loading} error={error} />
      {notice && <Text dimColor>{notice}</Text>}
      <InputBar
        disabled={loading}
        selectedModel={selectedModel}
        models={models}
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
