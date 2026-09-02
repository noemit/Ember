import * as React from 'react';
import GemBlob from './GemBlob';
import GrokBlob from './GrokBlob';
import type { BallState, BlobStyle } from '../types';

type Props = {
  style: BlobStyle;
  seed: string;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

/** Picks the blob renderer for the active style so callers don't care which is on. */
export default function Blob({ style, ...rest }: Props) {
  return style === 'gem' ? <GemBlob {...rest} /> : <GrokBlob {...rest} />;
}
