export function shareValue<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next;
  if (previous instanceof Set && next instanceof Set) {
    return previous.size === next.size && [...next].every((entry) => previous.has(entry)) ? previous : next;
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    const shared = next.map((value, index) => shareValue(previous[index], value));
    return (shared.length === previous.length && shared.every((value, index) => value === previous[index]) ? previous : shared) as T;
  }
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const keys = Object.keys(after);
  let same = keys.length === Object.keys(before).length;
  for (const key of keys) {
    Object.defineProperty(result, key, { value: shareValue(before[key], after[key]), enumerable: true, writable: true, configurable: true });
    if (!Object.hasOwn(before, key) || result[key] !== before[key]) same = false;
  }
  return (same ? previous : result) as T;
}
