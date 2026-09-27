import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelOption, ModelRef } from '../types';

export const selectedModelError = (selectedModelId: string | undefined, model: ModelRef | undefined): string | null =>
  selectedModelId && selectedModelId !== DEFAULT_MODEL && (!model || modelRefKey(model) !== selectedModelId)
    ? `Selected model ${selectedModelId} is unavailable. Refresh models or choose another model; Ember will not substitute one.`
    : null;

const normalizeVariant = (variant: string | null | undefined): string => {
  const normalized = (variant ?? '').trim().toLowerCase();
  return normalized === 'default' ? '' : normalized;
};

/** Case-insensitive equality where empty, unset and 'default' all mean "model default". */
export const sameVariant = (a?: string | null, b?: string | null): boolean => normalizeVariant(a) === normalizeVariant(b);

/**
 * Reasoning-effort spellings differ across sources ('High' saved by a scheduled task vs 'high'
 * advertised by the catalogue). Match ignoring case and return the canonical spelling. OpenCode 2
 * never advertises a 'default' level, so 'default'/'Default' resolves to '' (send no variant);
 * `undefined` means the level is genuinely unavailable.
 */
export const canonicalVariant = (variants: string[] | undefined, variant: string): string | undefined =>
  variants?.find((entry) => sameVariant(entry, variant)) ?? (normalizeVariant(variant) ? undefined : '');

export const resolveComposerModel = (selectedModelId: string, variant: string, models: ModelOption[], defaultModelId: string | null) => {
  const target = models.find((model) => modelRefKey(model) === (selectedModelId === DEFAULT_MODEL ? defaultModelId : selectedModelId));
  const model = selectedModelId === DEFAULT_MODEL ? undefined : target;
  const error = selectedModelError(selectedModelId, model) ?? (
    canonicalVariant(target?.details.variants, variant) === undefined
      ? `Selected reasoning level ${variant} is unavailable for ${selectedModelId}. Choose a supported level; Ember will not change it automatically.`
      : null
  );
  return { model, error };
};
