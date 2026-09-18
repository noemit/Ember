import * as React from 'react';
import { shareValue } from './structuralSharing';

export function useStableProps<T extends object>(props: T): T {
  const latest = React.useRef(props);
  latest.current = props;
  const previous = React.useRef<Record<string, unknown>>({});
  const callbacks = React.useRef<Record<string, (...args: unknown[]) => unknown>>({});
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      callbacks.current[key] ??= (...args: unknown[]) => {
        const callback = (latest.current as Record<string, unknown>)[key];
        return typeof callback === 'function' ? callback(...args) : undefined;
      };
      result[key] = callbacks.current[key];
    } else {
      result[key] = shareValue(previous.current[key], value);
    }
  }
  previous.current = result;
  return result as T;
}
