import * as React from 'react';
import type { ChatMessage } from '../types';

export type ModelObservation = {
  id: string;
  instanceId: string;
  sessionId: string;
  messageId: string;
  providerID: string;
  modelID: string;
  variant?: string;
  directory?: string;
  completedAt: number;
  durationMs?: number;
  output?: number;
  prompt?: number;
  cacheRead?: number;
  cost?: number;
  error: boolean;
  aborted: boolean;
  rating?: 'helpful' | 'unhelpful';
};

let records: ModelObservation[] = [];
let load: Promise<void> | undefined;
let lastLoadedAt = 0;
let revision = 0;
let error: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let writes: Promise<void> = Promise.resolve();
const pending = new Map<string, ModelObservation>();
const seen = new Map<string, string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => records;
const fail = (value: unknown) => { error = value instanceof Error ? value.message : 'Could not save model experience'; emit(); };

export const observationId = (instanceId: string, sessionId: string, messageId: string): string =>
  JSON.stringify([instanceId, sessionId, messageId]);

export const observationsFor = (instanceId: string, sessionId: string, directory: string | undefined, messages: readonly ChatMessage[]): ModelObservation[] =>
  messages.flatMap((message) => {
    const model = message.model;
    const completedAt = message.completedAt ?? (message.error ? message.createdAt : undefined);
    if (message.role !== 'assistant' || !message.completed || !model || completedAt === undefined) return [];
    const tokens = message.tokens;
    return [{
      id: observationId(instanceId, sessionId, message.id), instanceId, sessionId, messageId: message.id,
      providerID: model.providerID, modelID: model.modelID, variant: model.variant, directory, completedAt,
      durationMs: message.completedAt !== undefined && message.createdAt !== undefined && message.completedAt >= message.createdAt
        ? message.completedAt - message.createdAt : undefined,
      output: tokens?.output,
      prompt: tokens ? tokens.input + tokens.cacheRead + tokens.cacheWrite : undefined,
      cacheRead: tokens?.cacheRead, cost: message.cost, error: Boolean(message.error), aborted: Boolean(message.aborted),
    }];
  });

export const refreshModelStats = async (): Promise<void> => {
  if (!window.ember.getModelStats) return;
  const startedAt = revision;
  load ??= window.ember.getModelStats().then((next) => {
    if (revision !== startedAt) return;
    lastLoadedAt = Date.now();
    records = next;
    error = null;
    emit();
  }).catch(fail).finally(() => { load = undefined; });
  await load;
};

const flush = (): Promise<void> => {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const batch = [...pending.values()];
  pending.clear();
  if (!batch.length || !window.ember.observeModels) return writes;
  writes = writes.catch(() => {}).then(async () => {
    revision += 1;
    const confirmed = await window.ember.observeModels!(batch);
    const merged = new Map(records.map((record) => [record.id, record]));
    for (const record of confirmed) merged.set(record.id, record);
    records = [...merged.values()].filter((record) => record.completedAt >= Date.now() - 90 * 86_400_000)
      .sort((a, b) => b.completedAt - a.completedAt).slice(0, 10_000);
    error = null;
    emit();
  }).catch((reason) => {
    for (const record of batch) { pending.set(record.id, record); seen.delete(record.id); }
    fail(reason);
  });
  return writes;
};

export const observeModels = (observations: ModelObservation[]): void => {
  if (!window.ember.observeModels) return;
  for (const record of observations) {
    if (record.completedAt < Date.now() - 90 * 86_400_000) continue;
    const signature = JSON.stringify(record);
    if (seen.get(record.id) === signature) continue;
    seen.delete(record.id);
    seen.set(record.id, signature);
    pending.set(record.id, record);
  }
  while (seen.size > 10_000) seen.delete(seen.keys().next().value!);
  while (pending.size > 10_000) pending.delete(pending.keys().next().value!);
  if (pending.size && !timer) timer = setTimeout(() => void flush(), 1000);
};

export const rateModel = async (id: string, rating: ModelObservation['rating'] | null): Promise<void> => {
  await flush();
  if (!window.ember.rateModel) return;
  const mutation = writes.catch(() => {}).then(async () => {
    revision += 1;
    await window.ember.rateModel!(id, rating ?? null);
    records = records.map((record) => record.id === id ? { ...record, rating: rating ?? undefined } : record);
    error = null;
    emit();
  });
  writes = mutation;
  await mutation;
};

export const clearModelStats = async (): Promise<void> => {
  await flush();
  const mutation = writes.catch(() => {}).then(async () => {
    revision += 1;
    await window.ember.clearModelStats?.();
    records = [];
    pending.clear();
    error = null;
    emit();
  });
  writes = mutation;
  await mutation;
};

export const retryModelStats = async (): Promise<void> => { await flush(); await refreshModelStats(); };

export const useModelStats = (): { records: ModelObservation[]; error: string | null } => {
  const current = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  const currentError = React.useSyncExternalStore(subscribe, () => error, () => error);
  React.useEffect(() => { if (Date.now() - lastLoadedAt > 60_000) void refreshModelStats(); }, []);
  return { records: current, error: currentError };
};

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
};

export const summarizeModel = (rows: readonly ModelObservation[]) => {
  const completed = rows.filter((row) => !row.error && !row.aborted);
  const durations = completed.flatMap((row) => row.durationMs === undefined ? [] : [row.durationMs]);
  const rates = completed.flatMap((row) => row.output !== undefined && row.durationMs && row.durationMs > 0 ? [row.output / (row.durationMs / 1000)] : []);
  const costs = rows.flatMap((row) => row.cost === undefined ? [] : [row.cost]);
  const cached = rows.filter((row) => row.prompt !== undefined && row.prompt > 0 && row.cacheRead !== undefined);
  const prompt = cached.reduce((sum, row) => sum + row.prompt!, 0);
  const rated = rows.filter((row) => row.rating);
  return {
    count: rows.length, rated: rated.length, helpful: rated.filter((row) => row.rating === 'helpful').length,
    errors: rows.filter((row) => row.error && !row.aborted).length, cancelled: rows.filter((row) => row.aborted).length,
    duration: median(durations), durationSamples: durations.length, rate: median(rates), rateSamples: rates.length,
    cost: median(costs), costSamples: costs.length,
    cache: prompt ? cached.reduce((sum, row) => sum + row.cacheRead!, 0) / prompt : undefined, cacheSamples: cached.length,
  };
};
