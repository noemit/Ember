import { expect, test } from 'bun:test';
import { ReadCoordinator } from './src/lib/readCoordinator';

test('deduplicates reads and serializes a full repair after a tail', async () => {
  const coordinator = new ReadCoordinator();
  const calls: string[] = [];
  let release = () => {};
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const tail = coordinator.run('a', 'tail', async () => { calls.push('tail'); await blocked; });
  const duplicate = coordinator.run('a', 'tail', async () => { calls.push('duplicate'); });
  const full = coordinator.run('a', 'full', async () => { calls.push('full'); });
  const duplicateFull = coordinator.run('a', 'full', async () => { calls.push('duplicate full'); });
  await Promise.resolve();
  expect(calls).toEqual(['tail']);
  expect(duplicate).toBe(tail);
  expect(duplicateFull).toBe(full);
  release();
  await full;
  expect(calls).toEqual(['tail', 'full']);
});

test('an authoritative repair waits for a pre-mutation full read then fetches again', async () => {
  const coordinator = new ReadCoordinator();
  const calls: string[] = [];
  let release = () => {};
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const old = coordinator.run('a', 'full', async () => { calls.push('before mutation'); await blocked; });
  const fresh = coordinator.run('a', 'full', async () => { calls.push('after mutation'); }, true);
  await Promise.resolve();
  expect(calls).toEqual(['before mutation']);
  release();
  await Promise.all([old, fresh]);
  expect(calls).toEqual(['before mutation', 'after mutation']);
});

test('independent sessions proceed and failures release a key', async () => {
  const coordinator = new ReadCoordinator();
  await expect(coordinator.run('a', 'full', async () => { throw new Error('failed'); })).rejects.toThrow('failed');
  let finished = false;
  await coordinator.run('a', 'full', async () => { finished = true; });
  expect(finished).toBe(true);
});
