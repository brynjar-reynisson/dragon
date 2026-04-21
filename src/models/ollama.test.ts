import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOllamaModels } from './ollama.js';

describe('fetchOllamaModels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty array when fetch rejects (Ollama not running)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));
    expect(await fetchOllamaModels()).toEqual([]);
  });

  it('returns empty array when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));
    expect(await fetchOllamaModels()).toEqual([]);
  });

  it('returns empty array when models list is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );
    expect(await fetchOllamaModels()).toEqual([]);
  });

  it('keeps the model with the most recent modified_at per family', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { name: 'llama3.2:3b', modified_at: '2024-01-01T00:00:00Z' },
            { name: 'llama3.2:latest', modified_at: '2024-01-02T00:00:00Z' },
          ],
        }),
        { status: 200 },
      ),
    );
    expect(await fetchOllamaModels()).toEqual([
      { id: 'llama3.2:latest', provider: 'ollama' },
    ]);
  });

  it('handles multiple distinct model families', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { name: 'llama3.2:latest', modified_at: '2024-01-02T00:00:00Z' },
            { name: 'mistral:7b', modified_at: '2023-12-01T00:00:00Z' },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchOllamaModels();
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: 'llama3.2:latest', provider: 'ollama' });
    expect(result).toContainEqual({ id: 'mistral:7b', provider: 'ollama' });
  });

  it('returns single model when only one variant is installed', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: 'codellama:13b', modified_at: '2024-03-01T00:00:00Z' }],
        }),
        { status: 200 },
      ),
    );
    expect(await fetchOllamaModels()).toEqual([
      { id: 'codellama:13b', provider: 'ollama' },
    ]);
  });
});
