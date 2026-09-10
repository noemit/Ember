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

/** Cursor distance (px) within which the pupils react; farther away they settle back to centre. */
const NEAR_RADIUS = 260;
/** Re-measure a blob at most this often while the cursor moves, so scroll/layout shifts don't stale it. */
const RECT_TTL_MS = 500;

/**
 * Moves pupils toward the cursor, but only when it's nearby: within `NEAR_RADIUS` the pull ramps
 * up smoothly and past it the pupils settle back to centre. `reach` is the max offset in viewBox
 * units. The blob's page box is cached so a long session list doesn't force layout on every move.
 */
export const usePupilTracking = (
  wrapperRef: React.RefObject<HTMLElement | null>,
  pupilRefs: Array<React.RefObject<SVGElement | null>>,
  enabled: boolean,
  reach = 5
): void => {
  const pupils = React.useRef(pupilRefs);
  pupils.current = pupilRefs;
  const rectRef = React.useRef<{ rect: DOMRect; at: number } | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) rectRef.current = { rect, at: performance.now() };
    };
    measure();
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      rectRef.current = null;
    };
  }, [enabled, wrapperRef]);

  React.useEffect(() => {
    if (!enabled) return;
    return subscribe((clientX, clientY) => {
      let cached = rectRef.current;
      if (!cached || performance.now() - cached.at > RECT_TTL_MS) {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        cached = { rect, at: performance.now() };
        rectRef.current = cached;
      }
      const dx = clientX - (cached.rect.left + cached.rect.width / 2);
      const dy = clientY - (cached.rect.top + cached.rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const near = distance < NEAR_RADIUS ? 1 - distance / NEAR_RADIUS : 0;
      const pull = near * near * (3 - 2 * near);
      const x = ((dx / distance) * reach * pull).toFixed(2);
      const y = ((dy / distance) * reach * pull).toFixed(2);
      const transform = `translate(${x} ${y})`;
      pupils.current.forEach((ref) => ref.current?.setAttribute('transform', transform));
    });
  }, [enabled, reach, wrapperRef]);
};
