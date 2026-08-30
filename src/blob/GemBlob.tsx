import * as React from 'react';
import type { BlobDirection, BlobProps } from './types';
import { useActiveBlobDirection } from './directionState';
import PuffyClayRenderer from './renderers/PuffyClayRenderer';
import StarCandyRenderer from './renderers/StarCandyRenderer';
import FacetedGemRenderer from './renderers/FacetedGemRenderer';
import RetroBlockRenderer from './renderers/RetroBlockRenderer';
import LineMascotRenderer from './renderers/LineMascotRenderer';
import MicroCritterRenderer from './renderers/MicroCritterRenderer';
import './blob.css';

export default function GemBlob({
  seed,
  size = 44,
  state = 'idle',
  direction: explicitDirection,
  interactive = true,
  shapeIndex,
  colorIndex,
  className = '',
  style,
}: BlobProps) {
  const [globalDirection] = useActiveBlobDirection();
  const direction: BlobDirection = explicitDirection ?? globalDirection;

  const renderContent = () => {
    switch (direction) {
      case 'puffy-clay':
        return (
          <PuffyClayRenderer
            seed={seed}
            size={size}
            state={state}
            interactive={interactive}
            shapeIndex={shapeIndex}
            colorIndex={colorIndex}
          />
        );
      case 'star-candy':
        return <StarCandyRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'faceted-gem':
        return <FacetedGemRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'retro-block':
        return <RetroBlockRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'line-mascot':
        return <LineMascotRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'micro-critter':
        return <MicroCritterRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      default:
        return (
          <PuffyClayRenderer
            seed={seed}
            size={size}
            state={state}
            interactive={interactive}
            shapeIndex={shapeIndex}
            colorIndex={colorIndex}
          />
        );
    }
  };

  return (
    <div
      className={`gem-blob gem-blob-${direction} ${className}`}
      data-state={state}
      data-direction={direction}
      style={{ width: size, height: size, ...style }}
    >
      {renderContent()}
    </div>
  );
}
