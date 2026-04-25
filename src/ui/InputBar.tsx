import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ModelInfo } from '../models/list.js';

type InputMode = 'default' | 'selectingModel';
type ModelSelectMode = 'picker' | 'freetext';

interface Props {
  disabled: boolean;
  selectedModel: string;
  models: ModelInfo[];
  unavailableNotices: string[];
  onSubmit: (query: string) => void;
  onModelChange: (id: string) => void;
}

export function InputBar({ disabled, selectedModel, models, unavailableNotices, onSubmit, onModelChange }: Props) {
  const [query, setQuery] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('default');
  const [modelSelectMode, setModelSelectMode] = useState<ModelSelectMode>('picker');
  const [modelCursor, setModelCursor] = useState(0);
  const [modelText, setModelText] = useState('');

  // Refs track latest values synchronously so submit handlers read the
  // correct value before React flushes the corresponding state update.
  const queryRef = useRef('');
  const modelTextRef = useRef('');

  // Mode refs so useInput always reads the latest mode even before React commits
  const inputModeRef = useRef<InputMode>('default');
  const modelSelectModeRef = useRef<ModelSelectMode>('picker');
  const modelCursorRef = useRef(0);

  const setInputModeSync = (mode: InputMode) => {
    inputModeRef.current = mode;
    setInputMode(mode);
  };

  const setModelSelectModeSync = (mode: ModelSelectMode) => {
    modelSelectModeRef.current = mode;
    setModelSelectMode(mode);
  };

  const setModelCursorSync = (cursor: number) => {
    modelCursorRef.current = cursor;
    setModelCursor(cursor);
  };

  const handleQueryChange = (value: string) => {
    if (value === '/model') {
      queryRef.current = '';
      setQuery('');
      setInputModeSync('selectingModel');
      setModelSelectModeSync('picker');
      setModelCursorSync(0);
      return;
    }
    queryRef.current = value;
    setQuery(value);
  };

  const handleModelTextChange = (value: string) => {
    modelTextRef.current = value;
    setModelText(value);
  };

  useInput((input, key) => {
    if (inputModeRef.current === 'selectingModel') {
      if (modelSelectModeRef.current === 'picker') {
        if (key.upArrow) {
          const next = Math.max(0, modelCursorRef.current - 1);
          setModelCursorSync(next);
          return;
        }
        if (key.downArrow) {
          const next = Math.min(models.length - 1, modelCursorRef.current + 1);
          setModelCursorSync(next);
          return;
        }
        if (key.return) {
          onModelChange(models[modelCursorRef.current].id);
          setInputModeSync('default');
          return;
        }
        if (input === ' ') {
          setModelSelectModeSync('freetext');
          setModelText('');
          modelTextRef.current = '';
          return;
        }
        if (key.escape) { setInputModeSync('default'); return; }
      }
      if (modelSelectModeRef.current === 'freetext' && key.escape) {
        setModelSelectModeSync('picker');
      }
    }
  }, { isActive: !disabled });

  const handleQuerySubmit = (_value: string) => {
    const current = queryRef.current.trim();
    if (!current) return;
    onSubmit(current);
    queryRef.current = '';
    setQuery('');
  };

  const handleModelTextSubmit = (_value: string) => {
    const name = modelTextRef.current.trim();
    if (name) onModelChange(name);
    setInputModeSync('default');
    setModelText('');
    modelTextRef.current = '';
  };

  const hintsText = inputMode === 'selectingModel'
    ? '↑↓: navigate  •  Enter: select  •  Space: type name  •  Esc: cancel'
    : 'Enter: submit  •  Ctrl+C: exit';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Box gap={1} flexGrow={1}>
          {inputMode === 'selectingModel' && modelSelectMode === 'freetext' ? (
            <>
              <Text>model:</Text>
              <TextInput
                value={modelText}
                onChange={handleModelTextChange}
                onSubmit={handleModelTextSubmit}
                placeholder="e.g. gpt-4o-mini"
              />
            </>
          ) : inputMode === 'selectingModel' ? (
            <Text dimColor>Select a model below or press Space to type a name...</Text>
          ) : (
            <>
              <TextInput
                value={query}
                onChange={handleQueryChange}
                onSubmit={handleQuerySubmit}
                placeholder="Describe the code you need..."
                focus={!disabled}
              />
            </>
          )}
        </Box>
        <Text dimColor>[{selectedModel}]</Text>
      </Box>
      {inputMode === 'selectingModel' && modelSelectMode === 'picker' && (
        <Box flexDirection="column">
          {models.map((m, i) => (
            <Text key={m.id} color={i === modelCursor ? 'cyan' : undefined}>
              {i === modelCursor ? '▶ ' : '  '}{m.id}
            </Text>
          ))}
          {unavailableNotices.map(msg => (
            <Text key={msg} dimColor>{msg}</Text>
          ))}
        </Box>
      )}
      <Text dimColor>{hintsText}</Text>
    </Box>
  );
}
