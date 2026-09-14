/**
 * A pin key is `<instanceId>::<sessionId>::<messageId>` (see `messagePinKey` in App). The session
 * key is everything before the last `::`, since only the message id can follow it.
 */
export const sessionKeyFromPin = (pin: string): string | null => {
  const separator = pin.lastIndexOf('::');
  if (separator <= 0) return null;
  const key = pin.slice(0, separator);
  // The session key itself is `instance::session`, so a valid pin has two separators.
  return key.includes('::') ? key : null;
};

/** Pinned-message counts per session key, for the rail's pin badges. */
export const countPinsBySession = (pins: readonly string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  pins.forEach((pin) => {
    const key = sessionKeyFromPin(pin);
    if (!key) return;
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
};
