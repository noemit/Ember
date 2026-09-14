import { describe, expect, test } from 'bun:test';
import { countPinsBySession, sessionKeyFromPin } from './src/lib/pins';

describe('pinned-message keys', () => {
  test('splits the session key from the message id at the last separator', () => {
    expect(sessionKeyFromPin('local::ses_a2::ses_a2-0')).toBe('local::ses_a2');
    expect(sessionKeyFromPin('local::ses_a2')).toBeNull();
    expect(sessionKeyFromPin('::')).toBeNull();
    expect(sessionKeyFromPin('')).toBeNull();
  });

  test('counts pins per session, ignoring malformed keys', () => {
    expect(
      countPinsBySession([
        'local::ses_a2::ses_a2-0',
        'local::ses_a2::ses_a2-1',
        'studio::ses_b1::msg_1',
        'malformed',
      ])
    ).toEqual({ 'local::ses_a2': 2, 'studio::ses_b1': 1 });
  });
});
