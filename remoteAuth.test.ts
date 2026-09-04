import { describe, expect, test } from 'bun:test';
import { hashRemotePassword, verifyRemotePassword } from './electron/remoteAuth';

describe('remote access authentication', () => {
  test('hashes passwords without storing the plaintext and verifies them', () => {
    const stored = hashRemotePassword('correct horse battery staple');
    expect(stored).not.toContain('correct horse battery staple');
    expect(verifyRemotePassword('correct horse battery staple', stored)).toBe(true);
    expect(verifyRemotePassword('wrong password', stored)).toBe(false);
  });

  test('rejects malformed password hashes', () => {
    expect(verifyRemotePassword('password', undefined)).toBe(false);
    expect(verifyRemotePassword('password', 'scrypt$bad$hash')).toBe(false);
    expect(verifyRemotePassword('password', 'bcrypt$salt$' + 'a'.repeat(64))).toBe(false);
  });
});
