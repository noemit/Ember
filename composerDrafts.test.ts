import { describe, expect, test } from 'bun:test';
import { clearComposerText, mergeDraftChanges } from './src/lib/composerDrafts';
import { resolveComposerModel, selectedModelError } from './src/lib/modelSelection';
import { DEFAULT_MODEL, type ModelOption } from './src/types';

const chosen: ModelOption = {
  providerID: 'p', modelID: 'chosen', label: 'Chosen',
  details: { name: 'Chosen', providerName: 'P', reasoning: true, toolcall: true, attachment: false, inputs: [], variants: ['high'] },
};

describe('explicit model choices', () => {
  test('clearing content preserves the exact model and reasoning level', () => {
    const state = { text: 'draft', modelId: 'p/chosen', variant: 'high', attachments: [], replyContext: null };
    expect(clearComposerText(state)).toEqual({ ...state, text: '' });
    expect(state.text).toBe('draft');
  });
  test('a missing choice never resolves to the default or first catalogue entry', () => {
    const result = resolveComposerModel('p/missing', 'high', [chosen], 'p/chosen');
    expect(result.model).toBeUndefined();
    expect(result.error).toContain('p/missing');
    expect(selectedModelError('p/missing', chosen)).toContain('p/missing');
  });
  test('catalogue ordering does not affect a concrete selection', () => {
    const other = { ...chosen, modelID: 'first' };
    expect(resolveComposerModel('p/chosen', 'high', [other, chosen], 'p/first').model).toBe(chosen);
    expect(resolveComposerModel('p/chosen', 'high', [chosen, other], 'p/first').model).toBe(chosen);
  });
  test('only the explicit server-default sentinel permits delegation', () => {
    expect(resolveComposerModel(DEFAULT_MODEL, '', [chosen], 'p/chosen')).toEqual({ model: undefined, error: null });
    expect(selectedModelError(DEFAULT_MODEL, undefined)).toBeNull();
  });
  test('unavailable reasoning levels are not silently cleared', () => {
    expect(resolveComposerModel('p/chosen', 'removed', [chosen], 'p/chosen').error).toContain('removed');
  });
});

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
