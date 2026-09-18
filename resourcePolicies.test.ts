import { expect, test } from 'bun:test';
import { acceptedEncoding } from './electron/remoteServer';
import { shareValue } from './src/lib/structuralSharing';
import { mergePolledSessions } from './src/api';

test('negotiates static compression without selecting a disabled encoding', () => {
  expect(acceptedEncoding('gzip, br')).toBe('br');
  expect(acceptedEncoding('br;q=0, gzip;q=1')).toBe('gzip');
  expect(acceptedEncoding('gzip;q=0.5, br;q=0.2')).toBe('gzip');
  expect(acceptedEncoding('identity')).toBeUndefined();
});

test('unchanged session polling keeps list and row references', () => {
  const session = { instanceId: 'i', id: 's', title: 'Title', updated: 100 };
  const previous = { i: [session] };
  expect(mergePolledSessions(previous, { i: [{ ...session }] }, [])).toBe(previous);
  const next = mergePolledSessions(previous, { i: [{ ...session, title: 'Renamed' }] }, []);
  expect(next.i[0].title).toBe('Renamed');
  expect(next.i[0]).not.toBe(session);
});

test('structural sharing preserves unchanged children but not changed pin sets', () => {
  const before = { a: [{ id: 1 }], b: { active: false } };
  const after = shareValue(before, { a: [{ id: 1 }], b: { active: true } });
  expect(after.a).toBe(before.a);
  expect(after.b.active).toBe(true);
  const pins = new Set(['a']);
  expect(shareValue(pins, new Set(['a']))).toBe(pins);
  expect(shareValue(pins, new Set(['b']))).not.toBe(pins);
});
