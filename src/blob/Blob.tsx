import * as React from 'react';
import BuddyBlob from './BuddyBlob';
import { moodFrom, stateFromMood } from './mood';
import { seedIdentity } from './seed';
import type { AvatarIdentity, BallMood, BallState, BlobStyle } from '../types';

// Glyph pulls in the generated icon table, so it's split out of the main bundle.
const GlyphBlob = React.lazy(() => import('./GlyphBlob'));

type Props = {
  style: BlobStyle;
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  state?: BallState;
  mood?: BallMood;
  interactive?: boolean;
};

/** Picks the blob renderer for the active style so callers don't care which is on. */
export default function Blob({ style, ...rest }: Props) {
  // Renderers memoize on the identity reference; a fresh object per render would defeat that.
  const identity = React.useMemo(
    () => rest.identity ?? seedIdentity(rest.seed),
    [rest.identity, rest.seed]
  );
  // A caller that only knows the coarse state still gets a sensible mood.
  const mood = rest.mood ?? moodFrom(rest.state ?? 'idle', undefined, false);
  const state = rest.state ?? stateFromMood(mood);
  const props = { ...rest, identity, mood, state };
  const size = rest.size ?? 30;
  const rendered =
    style === 'buddy' ? (
      <BuddyBlob {...props} />
    ) : (
      <React.Suspense
        fallback={
          <span
            aria-hidden="true"
            className="inline-block flex-none rounded-full bg-muted"
            style={{ width: size, height: size }}
          />
        }
      >
        <GlyphBlob {...props} />
      </React.Suspense>
    );
  if (mood !== 'unread') return rendered;
  // An unread turn gets a small highlight dot, style-agnostic so Buddy and Glyph both show it.
  return (
    <span className="relative inline-flex flex-none" style={{ width: size, height: size }}>
      {rendered}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-highlight ring-2 ring-background"
      />
    </span>
  );
}
