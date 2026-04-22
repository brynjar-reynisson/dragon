import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { highlight } from 'cli-highlight';

interface Props {
  snippet: string;
  loading: boolean;
  error: string | null;
  query: string;
}

export function SnippetView({ snippet, loading, error, query }: Props) {
  if (loading) {
    return (
      <Box flexDirection="column">
        {query && <Text dimColor>&gt; {query}</Text>}
        <Box gap={1}>
          <Text color="yellow"><Spinner type="dots" /></Text>
          <Text>Generating snippet...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (!snippet) {
    return (
      <Text dimColor>Type a request above and press Enter to generate a snippet.</Text>
    );
  }

  let highlighted: string;
  try {
    highlighted = highlight(snippet, { ignoreIllegals: true });
  } catch {
    highlighted = snippet;
  }
  return (
    <Box flexDirection="column">
      {query && <Text dimColor>&gt; {query}</Text>}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text>{highlighted}</Text>
      </Box>
    </Box>
  );
}
