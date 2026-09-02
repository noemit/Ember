import * as React from 'react';

type Subscriber = (x: number, y: number) => void;

// One window listener shared by every blob, throttled to the frame rate.
const subscribers = new Set<Subscriber>();
let frame = 0;
let last = { x: 0, y: 0 };
let attached = false;

const flush = () => {
  frame = 0;
  subscribers.forEach((subscriber) => subscriber(last.x, last.y));
};

const onMove = (event: MouseEvent) => {
  last = { x: event.clientX, y: event.clientY };
  if (!frame) frame = window.requestAnimationFrame(flush);
};

const subscribe = (subscriber: Subscriber): (() => void) => {
  subscribers.add(subscriber);
  if (!attached) {
    window.addEventListener('mousemove', onMove, { passive: true });
    attached = true;
  }
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && attached) {
      window.removeEventListener('mousemove', onMove);
      attached = false;
    }
  };
};

/**
 * Moves pupils toward the cursor. `reach` is the max pupil offset in viewBox units.
 */
export const usePupilTracking = (
  wrapperRef: React.RefObject<HTMLElement | null>,
  pupilRefs: Array<React.RefObject<SVGElement | null>>,
  enabled: boolean,
  reach = 5
): void => {
  const pupils = React.useRef(pupilRefs);
  pupils.current = pupilRefs;

  React.useEffect(() => {
    if (!enabled) return;
    return subscribe((clientX, clientY) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, 260 / distance);
      const x = ((dx / distance) * reach * pull).toFixed(2);
      const y = ((dy / distance) * reach * pull).toFixed(2);
      const transform = `translate(${x} ${y})`;
      pupils.current.forEach((ref) => ref.current?.setAttribute('transform', transform));
    });
  }, [enabled, reach, wrapperRef]);
};
