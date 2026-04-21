import React, { useEffect, useState } from 'react';
import { Box, useStdin } from 'ink';
import { InputBar } from './InputBar.js';
import { SnippetView } from './SnippetView.js';
import type { Agent } from '../agent/Agent.js';

interface Props {
  agent: Agent;
}

export function App({ agent }: Props) {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setRawMode } = useStdin();

  // Activate raw mode synchronously (useLayoutEffect) so stdin is ready
  // immediately after mount — this ensures tests can write to stdin right
  // after render() without needing an extra async tick.
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

  return (
    <Box flexDirection="column" padding={1}>
      <SnippetView snippet={snippet} loading={loading} error={error} />
      <InputBar disabled={loading} onSubmit={handleSubmit} />
    </Box>
  );
}
