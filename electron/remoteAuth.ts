import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const hashRemotePassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

export const verifyRemotePassword = (password: string, stored: unknown): boolean => {
  if (typeof stored !== 'string') return false;
  const [algorithm, salt, expected] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  try {
    const actual = scryptSync(password, salt, 32);
    const target = Buffer.from(expected, 'hex');
    return actual.length === target.length && timingSafeEqual(actual, target);
  } catch {
    return false;
  }
};
