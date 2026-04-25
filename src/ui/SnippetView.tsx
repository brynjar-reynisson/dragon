import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { highlight } from 'cli-highlight';

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

interface Props {
  snippet: string;
  loading: boolean;
  error: string | null;
  query: string;
  highlightSyntax?: boolean;
}

export function SnippetView({ snippet, loading, error, query, highlightSyntax = true }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  if (loading) {
    return (
      <Box flexDirection="column">
        {query && <Text dimColor>&gt; {query}</Text>}
        <Box gap={1}>
          <Text color="yellow"><Spinner type="dots" /></Text>
          <Text>Generating snippet... ({formatElapsed(elapsed)})</Text>
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

  let displayed: string;
  if (highlightSyntax) {
    try {
      displayed = highlight(snippet, { ignoreIllegals: true });
    } catch {
      displayed = snippet;
    }
  } else {
    displayed = snippet;
  }
  return (
    <Box flexDirection="column">
      {query && <Text dimColor>&gt; {query}</Text>}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text>{displayed}</Text>
      </Box>
    </Box>
  );
}
