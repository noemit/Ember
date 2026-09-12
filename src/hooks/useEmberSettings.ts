import * as React from 'react';
import { DEFAULT_THEME_ID } from '../themes';
import type { EmberSettings, EmberSettingsPatch } from '../types';

export const DEFAULT_SETTINGS: EmberSettings = {
  theme: DEFAULT_THEME_ID,
  blobStyle: 'buddy',
  sessionWindowHours: 48,
  hideToolCalls: false,
  reasoningDisplay: 'collapsed',
  instanceDefaults: {},
  pinnedMessages: [],
  sessionNotes: {},
  composerDrafts: {},
  scheduledSessionBindings: {},
  avatarOverrides: {},
  projectColorAssignments: {},
  remoteAccessEnabled: false,
  remotePasswordConfigured: false,
};

type Options = {
  /** Surfaces save failures; `retry` re-applies the same patch. */
  onError: (message: string, retry: () => void) => void;
  /** Called before a save so a stale error banner from an earlier action goes away. */
  onBeforeSave: () => void;
};

/**
 * Settings persisted by the main process. Writes are optimistic: the patch is applied
 * locally, sent to main, and then replaced by whatever main validated and stored. A revision
 * counter drops responses from saves that a newer patch has already superseded.
 */
export const useEmberSettings = ({ onError, onBeforeSave }: Options) => {
  const [settings, setSettings] = React.useState<EmberSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const revisionRef = React.useRef(0);
  // Live copy for callbacks that must read the latest value without re-subscribing.
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;

  const hydrateSettings = React.useCallback((stored: Partial<EmberSettings>) => {
    setSettings({ ...DEFAULT_SETTINGS, ...stored });
    setSettingsLoaded(true);
  }, []);

  const markSettingsLoaded = React.useCallback(() => setSettingsLoaded(true), []);

  const updateSettings = React.useCallback(
    function updateSettings(patch: EmberSettingsPatch, options?: { preserveActionError?: boolean }) {
      if (!options?.preserveActionError) onBeforeSave();
      const revision = ++revisionRef.current;
      setSettings((prev) => ({ ...prev, ...patch }));
      void window.ember
        .setSettings(patch)
        .then((stored) => {
          if (revisionRef.current === revision) setSettings({ ...DEFAULT_SETTINGS, ...stored });
        })
        .catch(async (err) => {
          if (revisionRef.current !== revision) return;
          onError(
            err instanceof Error ? err.message : 'Could not save settings.',
            () => updateSettings(patch, options)
          );
          try {
            const stored = await window.ember.getSettings();
            if (revisionRef.current === revision) setSettings({ ...DEFAULT_SETTINGS, ...stored });
          } catch {
            // The save already failed and was reported; keep the optimistic value if we can't re-read.
          }
        });
    },
    [onError, onBeforeSave]
  );

  return { settings, settingsLoaded, settingsRef, hydrateSettings, markSettingsLoaded, updateSettings };
};
