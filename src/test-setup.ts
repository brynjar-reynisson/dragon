import { act } from 'react';
import { vi } from 'vitest';

// Patch ink-testing-library's render to wrap with React's act(),
// ensuring all effects (useEffect, useLayoutEffect) are flushed
// synchronously before render() returns.
vi.mock('ink-testing-library', async (importOriginal) => {
  const original = await importOriginal<typeof import('ink-testing-library')>();
  return {
    ...original,
    render: (tree: Parameters<typeof original.render>[0]) => {
      let result!: ReturnType<typeof original.render>;
      act(() => {
        result = original.render(tree);
      });
      return result;
    },
  };
});
