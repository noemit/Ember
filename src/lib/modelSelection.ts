import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelOption, ModelRef } from '../types';

export const selectedModelError = (selectedModelId: string | undefined, model: ModelRef | undefined): string | null =>
  selectedModelId && selectedModelId !== DEFAULT_MODEL && (!model || modelRefKey(model) !== selectedModelId)
    ? `Selected model ${selectedModelId} is unavailable. Refresh models or choose another model; Ember will not substitute one.`
    : null;

const normalizeVariant = (variant: string | null | undefined): string => (variant ?? '').trim().toLowerCase();

/** Case-insensitive equality where empty and unset both mean "model default". */
export const sameVariant = (a?: string | null, b?: string | null): boolean => normalizeVariant(a) === normalizeVariant(b);

/**
 * Reasoning-effort spellings differ across sources ('Default' saved by a scheduled task vs
 * 'default' advertised by the catalogue). Match ignoring case and return the canonical spelling.
 */
export const canonicalVariant = (variants: string[] | undefined, variant: string): string | undefined =>
  variants?.find((entry) => sameVariant(entry, variant));

export const resolveComposerModel = (selectedModelId: string, variant: string, models: ModelOption[], defaultModelId: string | null) => {
  const target = models.find((model) => modelRefKey(model) === (selectedModelId === DEFAULT_MODEL ? defaultModelId : selectedModelId));
  const model = selectedModelId === DEFAULT_MODEL ? undefined : target;
  const error = selectedModelError(selectedModelId, model) ?? (
    variant && (!target || !canonicalVariant(target.details.variants, variant))
      ? `Selected reasoning level ${variant} is unavailable for ${selectedModelId}. Choose a supported level; Ember will not change it automatically.`
      : null
  );
  return { model, error };
};
