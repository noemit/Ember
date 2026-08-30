import * as React from 'react';
import type { BlobDirection, BlobProps } from './types';
import { useActiveBlobDirection } from './directionState';
import PuffyClayRenderer from './renderers/PuffyClayRenderer';
import LineMascotRenderer from './renderers/LineMascotRenderer';
import MicroCritterRenderer from './renderers/MicroCritterRenderer';
import PostcardSceneRenderer from './renderers/PostcardSceneRenderer';
import SquiggleRenderer from './renderers/SquiggleRenderer';
import StarFaceRenderer from './renderers/StarFaceRenderer';
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
      case 'line-mascot':
        return <LineMascotRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'micro-critter':
        return <MicroCritterRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'postcard-scene':
        return <PostcardSceneRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'squiggle-doodle':
        return <SquiggleRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'star-face':
        return <StarFaceRenderer seed={seed} size={size} state={state} interactive={interactive} />;
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
