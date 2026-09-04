import { describe, expect, test } from 'bun:test';
import {
  isLocalHttpUrl,
  localInstanceUrl,
  normalizeApiMethod,
  parseAvatarOverrides,
  parseStringRecord,
  resolveApiUrl,
} from './electron/transport';

describe('instance transport validation', () => {
  test('only recognizes exact loopback hostnames as local', () => {
    expect(isLocalHttpUrl('http://localhost:3000')).toBe(true);
    expect(isLocalHttpUrl('https://127.0.0.1/api')).toBe(true);
    expect(isLocalHttpUrl('http://[::1]:3000')).toBe(true);
    expect(isLocalHttpUrl('http://localhost.evil.test')).toBe(false);
    expect(isLocalHttpUrl('http://127.0.0.1.evil.test')).toBe(false);
    expect(isLocalHttpUrl('http://localhost@evil.test')).toBe(false);
  });

  test('keeps API requests on the configured origin and base path', () => {
    expect(resolveApiUrl('https://example.test', '/api/session?id=1')).toBe(
      'https://example.test/api/session?id=1'
    );
    expect(resolveApiUrl('https://example.test/openchamber/', '/api/session')).toBe(
      'https://example.test/openchamber/api/session'
    );
    expect(resolveApiUrl('https://example.test', '@evil.test')).toBeNull();
    expect(resolveApiUrl('https://example.test', '//evil.test/api')).toBeNull();
    expect(resolveApiUrl('https://example.test', '/admin')).toBeNull();
    expect(resolveApiUrl('https://example.test', '/api/../admin')).toBeNull();
    expect(resolveApiUrl('file:///tmp/settings.json', '/api/session')).toBeNull();
  });

  test('discovers OpenChamber’s separately stored local runtime', () => {
    expect(localInstanceUrl({ desktopLocalPort: 58123 })).toBe('http://127.0.0.1:58123');
    expect(localInstanceUrl({ desktopLocalClientToken: 'configured' })).toBe('http://127.0.0.1:57123');
    expect(localInstanceUrl({})).toBeNull();
    expect(localInstanceUrl({ desktopLocalPort: 70_000 })).toBeNull();
  });

  test('allows only methods used by the API client', () => {
    expect(normalizeApiMethod('get')).toBe('GET');
    expect(normalizeApiMethod('POST')).toBe('POST');
    expect(normalizeApiMethod('patch')).toBe('PATCH');
    expect(normalizeApiMethod('DELETE')).toBeNull();
    expect(normalizeApiMethod('TRACE')).toBeNull();
  });
});

describe('appearance settings validation', () => {
  test('bounds and sanitizes persisted string mappings', () => {
    const unsafe = JSON.parse('{"valid":"task:one","__proto__":"bad","empty":""}');
    expect(parseStringRecord(unsafe)).toEqual({ valid: 'task:one' });
    expect(parseStringRecord({ one: '1', two: '2' }, 1)).toEqual({ one: '1' });
    expect(parseStringRecord(null)).toEqual({});
  });

  test('accepts only bounded curated appearance values', () => {
    expect(parseAvatarOverrides({
      valid: { colorIndex: 5, shapeName: 'wind-turbine' },
      badColor: { colorIndex: 6 },
      fractional: { colorIndex: 1.5 },
      badShape: { shapeName: '<svg>' },
      empty: {},
    })).toEqual({
      valid: { colorIndex: 5, shapeName: 'wind-turbine' },
    });
  });
});
