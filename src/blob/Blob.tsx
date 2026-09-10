import * as React from 'react';
import GrokBlob from './GrokBlob';
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
  if (style === 'grok') return <GrokBlob {...props} />;
  const size = rest.size ?? 30;
  return (
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
}
