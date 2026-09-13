import * as React from 'react';

export type ActionNotice = {
  message: string;
  actionLabel?: string;
  action?: () => void;
};

const NOTICE_TIMEOUT_MS = 8000;
/** An error toast lingers long enough to act on, then fades on its own. */
const ERROR_TIMEOUT_MS = 3 * 60_000;
const COPIED_FLASH_MS = 1600;
/** Long enough for the live region to notice the text was cleared before it's set again. */
const ANNOUNCE_RESET_MS = 40;

/**
 * Transient UI feedback: the error banner (with optional retry), the toast-style notice, the
 * "copied" flash, and the screen-reader status line. All of it is self-contained state with
 * timers, so it lives here rather than among the data handlers in App.
 */
export const useFeedback = () => {
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionErrorRetry, setActionErrorRetry] = React.useState<(() => void) | null>(null);
  const [errorCopied, setErrorCopied] = React.useState(false);
  const [actionNotice, setActionNotice] = React.useState<ActionNotice | null>(null);
  const [noticePaused, setNoticePaused] = React.useState(false);
  const [statusAnnouncement, setStatusAnnouncement] = React.useState('');
  const announceTimerRef = React.useRef<number | undefined>(undefined);

  const showActionError = React.useCallback((message: string | null, retry?: () => void) => {
    setActionError(message);
    setActionErrorRetry(() => retry ?? null);
  }, []);

  const clearActionErrorRetry = React.useCallback(() => setActionErrorRetry(null), []);

  React.useEffect(() => {
    setErrorCopied(false);
  }, [actionError]);

  React.useEffect(() => {
    if (!errorCopied) return;
    const timer = window.setTimeout(() => setErrorCopied(false), COPIED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [errorCopied]);

  React.useEffect(() => {
    setNoticePaused(false);
  }, [actionNotice]);

  // Errors fade on their own after three minutes, matching the notices' self-dismissing feel.
  React.useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => showActionError(null), ERROR_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [actionError, showActionError]);

  React.useEffect(() => {
    if (!actionNotice || noticePaused) return;
    const timer = window.setTimeout(() => setActionNotice(null), NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [actionNotice, noticePaused]);

  const announceStatus = React.useCallback((message: string) => {
    if (announceTimerRef.current !== undefined) {
      window.clearTimeout(announceTimerRef.current);
      announceTimerRef.current = undefined;
    }
    if (!message) {
      setStatusAnnouncement('');
      return;
    }
    // Clear first so repeated identical messages still trigger the live region.
    setStatusAnnouncement('');
    announceTimerRef.current = window.setTimeout(() => {
      setStatusAnnouncement(message);
      announceTimerRef.current = undefined;
    }, ANNOUNCE_RESET_MS);
  }, []);

  React.useEffect(
    () => () => {
      if (announceTimerRef.current !== undefined) window.clearTimeout(announceTimerRef.current);
    },
    []
  );

  return {
    actionError,
    actionErrorRetry,
    showActionError,
    clearActionErrorRetry,
    errorCopied,
    setErrorCopied,
    actionNotice,
    setActionNotice,
    setNoticePaused,
    statusAnnouncement,
    announceStatus,
  };
};
