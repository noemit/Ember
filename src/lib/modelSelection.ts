import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelOption, ModelRef } from '../types';

export const selectedModelError = (selectedModelId: string | undefined, model: ModelRef | undefined): string | null =>
  selectedModelId && selectedModelId !== DEFAULT_MODEL && (!model || modelRefKey(model) !== selectedModelId)
    ? `Selected model ${selectedModelId} is unavailable. Refresh models or choose another model; Ember will not substitute one.`
    : null;

export const resolveComposerModel = (selectedModelId: string, variant: string, models: ModelOption[], defaultModelId: string | null) => {
  const target = models.find((model) => modelRefKey(model) === (selectedModelId === DEFAULT_MODEL ? defaultModelId : selectedModelId));
  const model = selectedModelId === DEFAULT_MODEL ? undefined : target;
  const error = selectedModelError(selectedModelId, model) ?? (
    variant && (!target || !target.details.variants.includes(variant))
      ? `Selected reasoning level ${variant} is unavailable for ${selectedModelId}. Choose a supported level; Ember will not change it automatically.`
      : null
  );
  return { model, error };
};
