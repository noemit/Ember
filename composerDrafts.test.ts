import { describe, expect, test } from 'bun:test';
import { mergeDraftChanges } from './src/lib/composerDrafts';

describe('session-scoped draft patches', () => {
  test('one column cannot replace another column draft', () => {
    const a = { text: 'A', updatedAt: 1 };
    const b = { text: 'B', updatedAt: 2 };
    const first = mergeDraftChanges({}, { 'i::a': a });
    expect(mergeDraftChanges(first, { 'i::b': b })).toEqual({ 'i::a': a, 'i::b': b });
  });
  test('deletion is explicit and preserves unrelated entries', () => {
    const b = { text: 'B', updatedAt: 2 };
    expect(mergeDraftChanges({ 'i::a': { text: 'A', updatedAt: 1 }, 'i::b': b }, { 'i::a': null }))
      .toEqual({ 'i::b': b });
  });
});
