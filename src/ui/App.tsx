import React, { useEffect, useState } from 'react';
import { Box, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';

interface Props {
  agent: Agent;
  initialModelId: string;
}

export function App({ agent, initialModelId }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(initialModelId);
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  const handleSubmit = async (query: string, language?: string) => {
    setLoading(true);
    setError(null);
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
    try {
      agent.setModel(id);
      setSelectedModel(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <SnippetView snippet={snippet} loading={loading} error={error} />
      <InputBar
        disabled={loading}
        selectedModel={selectedModel}
        onSubmit={handleSubmit}
        onModelChange={handleModelChange}
      />
    </Box>
  );
}
