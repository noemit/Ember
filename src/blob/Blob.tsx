import * as React from 'react';
import GrokBlob from './GrokBlob';
import { seedIdentity } from './seed';
import type { AvatarIdentity, BallState, BlobStyle } from '../types';

const GemBlob = React.lazy(() => import('./GemBlob'));
const GlyphBlob = React.lazy(() => import('./GlyphBlob'));
const CritterBlob = React.lazy(() => import('./CritterBlob'));

type Props = {
  style: BlobStyle;
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

/** Picks the blob renderer for the active style so callers don't care which is on. */
export default function Blob({ style, ...rest }: Props) {
  const props = { ...rest, identity: rest.identity ?? seedIdentity(rest.seed) };
  if (style === 'grok') return <GrokBlob {...props} />;
  const Variant = style === 'gem' ? GemBlob : style === 'glyph' ? GlyphBlob : CritterBlob;
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
      <Variant {...props} />
    </React.Suspense>
  );
}
