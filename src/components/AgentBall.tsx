import * as React from 'react';
import type { BallState } from '../types';

type Props = {
  state: BallState;
};

export default function AgentBall({ state }: Props) {
  const ballRef = React.useRef<HTMLSpanElement>(null);
  const leftPupilRef = React.useRef<HTMLSpanElement>(null);
  const rightPupilRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const ball = ballRef.current;
      if (!ball) return;

      const rect = ball.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 240 / distance);
      const x = ((dx / distance) * 1.6 * reach).toFixed(2);
      const y = ((dy / distance) * 1.6 * reach).toFixed(2);
      const transform = `translate(${x}px, ${y}px)`;

      if (leftPupilRef.current) leftPupilRef.current.style.transform = transform;
      if (rightPupilRef.current) rightPupilRef.current.style.transform = transform;
    };

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <span className="agent-ball" data-state={state} ref={ballRef} title={state}>
      <span className="eye eye-left">
        <span className="pupil" ref={leftPupilRef} />
      </span>
      <span className="eye eye-right">
        <span className="pupil" ref={rightPupilRef} />
      </span>
    </span>
  );
}
