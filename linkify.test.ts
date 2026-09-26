import { describe, expect, test } from 'bun:test';
import { tokenizeLinks } from './src/components/Linkify';

const links = (text: string) => tokenizeLinks(text).filter((t) => t.type === 'link').map((t) => t.value);

describe('tokenizeLinks', () => {
  test('links http(s) URLs and drops sentence punctuation', () => {
    expect(links('see https://example.com/a?b=1. ')).toEqual(['https://example.com/a?b=1']);
  });

  test('links bare host:port addresses agents print without a scheme', () => {
    expect(links('running on localhost:3000 and 127.0.0.1:8080/api.')).toEqual([
      'localhost:3000',
      '127.0.0.1:8080/api',
    ]);
    expect(links('try www.example.com/docs.')).toEqual(['www.example.com/docs']);
  });

  test('a bare hostname without a port stays plain text', () => {
    expect(links('the localhost config')).toEqual([]);
  });

  test('links absolute POSIX paths under known roots', () => {
    expect(links('open /Users/me/ember/src/api.ts:42')).toEqual(['/Users/me/ember/src/api.ts:42']);
    expect(links('in ~/ember/dist.')).toEqual(['~/ember/dist']);
  });

  test('keeps a balanced closing paren on Wikipedia-style URLs', () => {
    expect(links('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
  });

  test('does not link words, relative paths, or Windows paths', () => {
    expect(links('src/api.ts C:\\\\Users\\\\me file:///etc')).toEqual([]);
  });
});
