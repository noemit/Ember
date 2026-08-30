import * as React from 'react';
import type { BallState } from '../types';
import type { BlobDirection, BlobProps } from './types';
import { useActiveBlobDirection } from './directionState';
import HabitPillRenderer from './renderers/HabitPillRenderer';
import PuffyClayRenderer from './renderers/PuffyClayRenderer';
import LuminousOrbRenderer from './renderers/LuminousOrbRenderer';
import PlayfulDoodleRenderer from './renderers/PlayfulDoodleRenderer';
import PastelCompanionRenderer from './renderers/PastelCompanionRenderer';
import './blob.css';

export default function GemBlob({
  seed,
  size = 36,
  state = 'idle',
  direction: explicitDirection,
  interactive = true,
  className = '',
  style,
}: BlobProps) {
  const [globalDirection] = useActiveBlobDirection();
  const direction: BlobDirection = explicitDirection ?? globalDirection;

  const renderContent = () => {
    switch (direction) {
      case 'habit-pill':
        return <HabitPillRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'puffy-clay':
        return <PuffyClayRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'luminous-orb':
        return <LuminousOrbRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'playful-doodle':
        return <PlayfulDoodleRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      case 'pastel-companion':
        return <PastelCompanionRenderer seed={seed} size={size} state={state} interactive={interactive} />;
      default:
        return <HabitPillRenderer seed={seed} size={size} state={state} interactive={interactive} />;
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
