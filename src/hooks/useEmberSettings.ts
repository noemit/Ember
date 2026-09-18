import * as React from 'react';
import { DEFAULT_THEME_ID } from '../themes';
import type { EmberSettings, EmberSettingsPatch } from '../types';
import { mergeDraftChanges } from '../lib/composerDrafts';

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
  openSessions: [],
  activeSession: null,
  minimizedSessions: [],
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
  const writesRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const pendingDraftsRef = React.useRef(new Map<string, { revision: number; value: import('../lib/composerDrafts').DraftChanges[string] }>());
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
      const { composerDraftChanges, ...values } = patch;
      for (const [key, value] of Object.entries(composerDraftChanges ?? {})) pendingDraftsRef.current.set(key, { revision, value });
      const pendingDrafts = () => Object.fromEntries([...pendingDraftsRef.current].map(([key, entry]) => [key, entry.value]));
      const adoptStored = (stored: EmberSettings) => {
        const next = { ...DEFAULT_SETTINGS, ...stored, composerDrafts: mergeDraftChanges(stored.composerDrafts, pendingDrafts()) };
        settingsRef.current = next;
        setSettings(next);
      };
      const next = {
        ...settingsRef.current,
        ...values,
        ...(composerDraftChanges ? { composerDrafts: mergeDraftChanges(settingsRef.current.composerDrafts, composerDraftChanges) } : {}),
      };
      settingsRef.current = next;
      setSettings(next);
      const save = writesRef.current.catch(() => {}).then(() => window.ember.setSettings(patch));
      writesRef.current = save;
      void save
        .then((stored) => {
          for (const key of Object.keys(composerDraftChanges ?? {})) {
            if (pendingDraftsRef.current.get(key)?.revision === revision) pendingDraftsRef.current.delete(key);
          }
          if (revisionRef.current === revision) adoptStored(stored);
        })
        .catch(async (err) => {
          if (composerDraftChanges) {
            const keys = Object.keys(composerDraftChanges).filter((key) => pendingDraftsRef.current.get(key)?.revision === revision);
            if (keys.length) onError(err instanceof Error ? err.message : 'Could not save drafts.', () => {
              const remaining = pendingDrafts();
              updateSettings({ composerDraftChanges: Object.fromEntries(keys.filter((key) => key in remaining).map((key) => [key, remaining[key]])) }, options);
            });
            return;
          }
          if (revisionRef.current !== revision) return;
          onError(
            err instanceof Error ? err.message : 'Could not save settings.',
            () => updateSettings(patch, options)
          );
          try {
            const stored = await window.ember.getSettings();
            if (revisionRef.current === revision) adoptStored(stored);
          } catch {
            // The save already failed and was reported; keep the optimistic value if we can't re-read.
          }
        });
    },
    [onError, onBeforeSave]
  );

  return { settings, settingsLoaded, settingsRef, hydrateSettings, markSettingsLoaded, updateSettings };
};
