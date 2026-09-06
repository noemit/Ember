import * as React from 'react';

/**
 * Returns a callback whose identity never changes but whose body always calls the latest
 * `callback`. Use it when passing handlers from a frequently re-rendering parent into
 * `React.memo` children, so inline lambdas at the call site don't defeat the memo.
 */
export const useStableCallback = <Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): ((...args: Args) => Result) => {
  const ref = React.useRef(callback);
  ref.current = callback;
  return React.useCallback((...args: Args) => ref.current(...args), []);
};
