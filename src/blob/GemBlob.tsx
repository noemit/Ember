import * as React from 'react';
import type { BlobProps } from './types';
import PuffyClayRenderer from './renderers/PuffyClayRenderer';
import './blob.css';

export default function GemBlob({
  seed,
  size = 44,
  state = 'idle',
  interactive = true,
  shapeIndex,
  colorIndex,
  className = '',
  style,
}: BlobProps) {
  return (
    <div
      className={`gem-blob gem-blob-puffy-clay ${className}`}
      data-state={state}
      style={{ width: size, height: size, ...style }}
    >
      <PuffyClayRenderer
        seed={seed}
        size={size}
        state={state}
        interactive={interactive}
        shapeIndex={shapeIndex}
        colorIndex={colorIndex}
      />
    </div>
  );
}
