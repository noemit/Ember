import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelStatsStore, parseObservation } from './electron/modelStats';
import { observationsFor, summarizeModel, summarizeUsage } from './src/lib/modelStats';

const observation = () => ({
  instanceId: 'local', sessionId: 'session', messageId: 'message', providerID: 'provider', modelID: 'model',
  completedAt: Date.now() - 1000, durationMs: 2000, output: 100, prompt: 1000, cacheRead: 800, error: false, aborted: false,
});

test('accepts only bounded metadata, derives identity, and rejects stale records', () => {
  const raw = observation();
  const parsed = parseObservation({ ...raw, id: 'spoof', text: 'private conversation', input: { secret: 'not retained' }, rating: 'helpful' });
  expect(parsed?.id).toBe(JSON.stringify(['local', 'session', 'message']));
  expect(parsed).not.toHaveProperty('text');
  expect(parsed).not.toHaveProperty('input');
  expect(parsed).not.toHaveProperty('rating');
  expect(parseObservation({ ...raw, completedAt: 1 })).toBeNull();
  expect(parseObservation({ ...raw, modelID: 'x'.repeat(201) })).toBeNull();
  expect(parseObservation({ ...raw, cost: NaN })?.cost).toBeUndefined();
});

test('unknown cost is not free; errors and cancellation are separate', () => {
  const row = parseObservation(observation())!;
  const summary = summarizeModel([row, { ...row, id: 'error', error: true }, { ...row, id: 'abort', error: true, aborted: true }]);
  expect(summary.cost).toBeUndefined();
  expect(summary.costSamples).toBe(0);
  expect(summary.errors).toBe(1);
  expect(summary.cancelled).toBe(1);
  expect(summary.rate).toBe(50);
  expect(summary.cache).toBe(0.8);
  expect(summarizeModel([{ ...row, cost: 0 }]).cost).toBe(0);
});

test('usage groups every model across instances, most used first, within the window', () => {
  const now = Date.now();
  const row = { ...parseObservation(observation())!, completedAt: now - 1000 };
  const rows = [
    { ...row, id: 'a1', cost: 0.5 },
    { ...row, id: 'a2', instanceId: 'castle', variant: 'high', cost: 0.25 },
    { ...row, id: 'a3', instanceId: 'castle', variant: 'high' },
    { ...row, id: 'b1', modelID: 'other' },
    { ...row, id: 'old', modelID: 'stale', completedAt: now - 40 * 86_400_000 },
  ];
  const usage = summarizeUsage(rows, { days: 30, now });
  expect(usage.map((entry) => entry.modelID)).toEqual(['model', 'other']);
  expect(usage[0].count).toBe(3);
  expect(usage[0].totalCost).toBe(0.75);
  expect(usage[0].variants).toEqual([['high', 2], ['', 1]]);
  expect(usage[0].instances).toEqual([['castle', 2], ['local', 1]]);
  expect(summarizeUsage(rows, { days: 90, now }).map((entry) => entry.modelID)).toContain('stale');
  expect(summarizeUsage(rows, { days: 30, instanceId: 'local', now }).map((entry) => [entry.modelID, entry.count]))
    .toEqual([['model', 1], ['other', 1]]);
});

test('observes completed assistant metadata with the actual model variant', () => {
  const result = observationsFor('local', 'session', '/project', [{
    id: 'message', role: 'assistant', text: 'Not stored', parts: [], completed: true,
    model: { providerID: 'provider', modelID: 'model', variant: 'high' },
    createdAt: 100, completedAt: 200, cost: 0,
  }]);
  expect(result[0].variant).toBe('high');
  expect(result[0].durationMs).toBe(100);
  expect(result[0]).not.toHaveProperty('text');
});

test('an unchanged retry persists metadata after a failed disk write', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ember-model-retry-'));
  const parent = join(directory, 'blocked');
  const store = new ModelStatsStore(join(parent, 'stats.json'));
  const row = observation();
  try {
    await store.list();
    await writeFile(parent, 'temporary blocker');
    await expect(store.observe([row])).rejects.toThrow();
    await unlink(parent);
    await store.observe([row]);
    expect(await new ModelStatsStore(join(parent, 'stats.json')).list()).toHaveLength(1);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('observations deduplicate across clients, preserve ratings, and survive restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ember-model-stats-'));
  try {
    const file = join(directory, 'stats.json');
    const store = new ModelStatsStore(file);
    const row = observation();
    const [record] = await store.observe([row, row]);
    await store.rate(record.id, 'helpful');
    await store.observe([{ ...row, messageId: 'another' }]);
    const delta = await store.observe([{ ...row, output: 200 }]);
    expect(delta).toHaveLength(1);
    expect(delta[0].messageId).toBe('message');
    const reopened = new ModelStatsStore(file);
    const records = await reopened.list();
    expect(records).toHaveLength(2);
    expect(records.find((entry) => entry.id === record.id)?.rating).toBe('helpful');
    expect(records.find((entry) => entry.id === record.id)?.output).toBe(200);
    await reopened.rate(record.id, null);
    expect((await reopened.list()).find((entry) => entry.id === record.id)?.rating).toBeUndefined();
    await reopened.clear();
    await reopened.observe([row]);
    expect(await reopened.list()).toEqual([]);
    expect(await new ModelStatsStore(file).list()).toEqual([]);
  } finally {
    await rm(directory, { recursive: true });
  }
});
