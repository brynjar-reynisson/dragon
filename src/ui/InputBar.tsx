import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  disabled: boolean;
  onSubmit: (query: string, language?: string) => void;
}

export function InputBar({ disabled, onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [editingLang, setEditingLang] = useState(false);
  // Refs track the latest values synchronously so handleSubmit has
  // the correct value even before React commits the state update.
  const queryRef = useRef('');
  const languageRef = useRef('');

  const handleQueryChange = (value: string) => {
    queryRef.current = value;
    setQuery(value);
  };

  const handleLanguageChange = (value: string) => {
    languageRef.current = value;
    setLanguage(value);
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'l') {
      setEditingLang(prev => !prev);
    }
    if (key.escape && editingLang) {
      setEditingLang(false);
    }
  }, { isActive: !disabled });

  const handleSubmit = (_value: string) => {
    const current = queryRef.current.trim();
    if (!current) return;
    onSubmit(current, languageRef.current.trim() || undefined);
    queryRef.current = '';
    setQuery('');
  };

  const handleLangSubmit = (_value: string) => {
    setLanguage(languageRef.current.trim());
    setEditingLang(false);
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box gap={1}>
        {language && !editingLang && <Text dimColor>[lang: {language}]</Text>}
        {editingLang ? (
          <Box gap={1}>
            <Text>lang:</Text>
            <TextInput
              value={language}
              onChange={handleLanguageChange}
              onSubmit={handleLangSubmit}
              placeholder="e.g. typescript"
            />
          </Box>
        ) : (
          <TextInput
            value={query}
            onChange={handleQueryChange}
            onSubmit={handleSubmit}
            placeholder="Describe the code you need..."
            focus={!disabled}
          />
        )}
      </Box>
      <Text dimColor>Ctrl+L: set language  •  Enter: submit  •  Ctrl+C: exit</Text>
    </Box>
  );
}
