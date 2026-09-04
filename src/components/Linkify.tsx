import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * URLs plus absolute POSIX paths under the roots agents usually mention. Paths stop at
 * whitespace and closing quotes/brackets; the trailing-punctuation trim below handles
 * sentences like "see /Users/me/file.ts." Windows paths are skipped on purpose: they
 * come from remote instances and can't be revealed locally anyway.
 */
const LINK_PATTERN =
  /https?:\/\/[^\s<>"'`]+|(?:~|\/(?:Users|home|Volumes|tmp|var|opt|etc|Applications|private|workspace|root|srv|mnt))(?:\/[^\s<>"'`()[\]]+)+/g;

const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"`]+$/;

export type LinkToken = { type: 'text'; value: string } | { type: 'link'; value: string };

export const tokenizeLinks = (text: string): LinkToken[] => {
  const tokens: LinkToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    let value = match[0];
    // Keep balanced parentheses (Wikipedia-style URLs) but drop sentence punctuation.
    const trimmed = value.replace(TRAILING_PUNCTUATION, '');
    const opens = (trimmed.match(/\(/g) ?? []).length;
    const closes = (trimmed.match(/\)/g) ?? []).length;
    value = opens > closes && value[trimmed.length] === ')' ? `${trimmed})` : trimmed;
    if (start > cursor) tokens.push({ type: 'text', value: text.slice(cursor, start) });
    tokens.push({ type: 'link', value });
    cursor = start + value.length;
  }
  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });
  return tokens;
};

type Props = {
  text: string;
  className?: string;
};

/** Renders text with URLs and local paths as links that open via the Ember bridge. */
export default function Linkify({ text, className }: Props) {
  const tokens = React.useMemo(() => tokenizeLinks(text), [text]);

  return (
    <>
      {tokens.map((token, index) =>
        token.type === 'link' ? (
          <a
            key={index}
            href={token.value}
            title={token.value.startsWith('http') ? token.value : `Reveal in Finder: ${token.value}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void window.ember.openExternal(token.value);
            }}
            className={cn(
              'cursor-pointer break-all underline decoration-current/50 underline-offset-2 hover:decoration-current',
              className
            )}
          >
            {token.value}
          </a>
        ) : (
          <React.Fragment key={index}>{token.value}</React.Fragment>
        )
      )}
    </>
  );
}
