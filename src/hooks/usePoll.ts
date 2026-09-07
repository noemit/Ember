import * as React from 'react';
import { useStableCallback } from '@/lib/useStableCallback';

/**
 * Runs `task` immediately and then again `intervalMs` after each completion (not on a fixed
 * clock, so slow responses never pile up). Changing `intervalMs` restarts the loop, which
 * also runs the task once; that's intentional, since the interval changes exactly when an
 * instance's event stream comes or goes and a catch-up fetch is wanted either way.
 *
 * Polling is the safety net under event-driven invalidation: when an instance's stream is
 * live the interval is long, when it isn't the interval is short.
 */
export const usePoll = (task: () => Promise<void>, intervalMs: number, enabled: boolean): void => {
  const run = useStableCallback(task);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | undefined;

    const loop = async () => {
      try {
        await run();
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void loop(), intervalMs);
      }
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [enabled, run, intervalMs]);
};
