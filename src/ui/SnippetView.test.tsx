import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { SnippetView } from './SnippetView.js';

describe('SnippetView', () => {
  it('shows usage hint when no snippet and not loading', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={false} error={null} query="" />
    );
    expect(lastFrame()).toContain('Type a request');
  });

  it('shows "Generating" text while loading', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={true} error={null} query="" />
    );
    expect(lastFrame()).toContain('Generating');
  });

  it('shows query above spinner while loading', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={true} error={null} query="debounce function" />
    );
    expect(lastFrame()).toContain('> debounce function');
    expect(lastFrame()).toContain('Generating');
  });

  it('shows error message when error is set', () => {
    const { lastFrame } = render(
      <SnippetView snippet="" loading={false} error="API rate limit exceeded" query="" />
    );
    expect(lastFrame()).toContain('API rate limit exceeded');
  });

  it('renders snippet content when provided', () => {
    const { lastFrame } = render(
      <SnippetView snippet="function foo() {}" loading={false} error={null} query="" />
    );
    expect(lastFrame()).toContain('function foo() {}');
  });

  it('shows query above snippet when provided', () => {
    const { lastFrame } = render(
      <SnippetView snippet="function foo() {}" loading={false} error={null} query="write a foo function" />
    );
    expect(lastFrame()).toContain('> write a foo function');
    expect(lastFrame()).toContain('function foo() {}');
  });

  it('does not show query prefix when query is empty', () => {
    const { lastFrame } = render(
      <SnippetView snippet="function foo() {}" loading={false} error={null} query="" />
    );
    expect(lastFrame()).not.toContain('>');
  });
});
