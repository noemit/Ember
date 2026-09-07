import * as React from 'react';
import { MotionConfig } from 'motion/react';
import InstanceBar from './components/InstanceBar';
import LeftRail from './components/LeftRail';
import ChatView from './components/ChatView';
import { TooltipProvider } from '@/components/ui/tooltip';
import { applyTheme } from './themes';
import {
  allocateProjectColors,
  projectForSession,
  projectIdentityKey,
  resolveAvatarIdentity,
  seedIdentity,
  sessionAvatarKey,
} from './blob/seed';
import {
  abortSession,
  createClientMessageId,
  createSession,
  errorMessageOf,
  listInstances,
  loadAllAutoAcceptPolicies,
  loadAllMessageQueues,
  loadAllPermissions,
  loadAllProjects,
  loadAllQuestions,
  loadAllSessions,
  loadAllSessionStates,
  loadMessages,
  loadPermissions,
  loadQuestions,
  loadSessionStates,
  loadModels,
  loadScheduledIdentityData,
  mergePolledSessions,
  previewOf,
  reconcilePolledMessages,
  rejectQuestion,
  replyPermission,
  replyQuestion,
  sendPrompt,
  setAutoAccept,
  setSessionArchived,
  type AutoAcceptPolicy,
  type ModelList,
  type PromptInput,
} from './api';
import { useStableCallback } from '@/lib/useStableCallback';
import { copyText } from '@/lib/clipboard';
import { sameMessages } from '@/lib/messageSignature';
import { useEmberSettings } from './hooks/useEmberSettings';
import { useFeedback } from './hooks/useFeedback';
import { useMessageQueue } from './hooks/useMessageQueue';
import { usePoll } from './hooks/usePoll';
import { InvalidationQueue, invalidationsFor, parseEmberEvent, type Invalidation } from '@/lib/invalidation';
import { modelRefKey, SESSION_WINDOWS, sessionKey } from './types';
import type {
  AvatarIdentity,
  AvatarOverride,
  BallState,
  ChatMessage,
  MessagesStatus,
  MessageQueueSession,
  Instance,
  PermissionReply,
  PermissionRequest,
  Project,
  QuestionAnswers,
  QuestionRequest,
  Session,
  SessionNote,
  SessionRef,
  StoredComposerDraft,
  NewSessionOptions,
} from './types';

const SettingsPanel = React.lazy(() => import('./components/SettingsPanel'));
const AvatarPicker = React.lazy(() => import('./components/AvatarPicker'));
const CommandPalette = React.lazy(() => import('./components/CommandPalette'));

const DialogFallback = ({ label }: { label: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="status">
    <span className="rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
      {label}
    </span>
  </div>
);

// Fast cadence: used while an instance has no live event stream.
const STATE_POLL_MS = 3000;
const SESSION_POLL_MS = 10_000;
const SCHEDULE_POLL_MS = 30_000;
// Slow cadence: the safety net while every instance is streaming events to us.
const STATE_POLL_LIVE_MS = 30_000;
const SESSION_POLL_LIVE_MS = 60_000;
const MESSAGES_POLL_LIVE_MS = 20_000;
const SCHEDULE_POLL_LIVE_MS = 5 * 60_000;
const PREVIEW_COUNT = 24;
const PREVIEW_CONCURRENCY = 4;
// Transcripts kept warm for instant switching. Must cover PREVIEW_COUNT or the preview
// loader evicts what it just fetched.
const MESSAGE_CACHE_LIMIT = 32;
const RECENT_MODEL_COUNT = 5;
const CREATED_SESSION_GRACE_MS = 2 * 60_000;

/** Models the instance ran most recently, newest first, taken from its sessions' last-used model. */
const recentModelKeys = (sessions: Session[]): string[] => {
  const keys: string[] = [];
  [...sessions]
    .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
    .forEach((session) => {
      if (!session.model) return;
      const key = modelRefKey(session.model);
      if (!keys.includes(key)) keys.push(key);
    });
  return keys.slice(0, RECENT_MODEL_COUNT);
};

const forSession = <T extends { instanceId: string; sessionId: string }>(
  list: T[],
  selected: SessionRef | null
): T[] =>
  selected
    ? list.filter(
        (request) =>
          request.instanceId === selected.instanceId && request.sessionId === selected.sessionId
      )
    : [];

const sameIdentity = (a: AvatarIdentity, b: AvatarIdentity): boolean =>
  a.sessionKey === b.sessionKey &&
  a.projectKey === b.projectKey &&
  a.taskKey === b.taskKey &&
  a.colorSeed === b.colorSeed &&
  a.shapeSeed === b.shapeSeed &&
  a.motionSeed === b.motionSeed &&
  a.colorIndex === b.colorIndex &&
  a.shapeName === b.shapeName;

const sameStringRecord = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const sameNumberRecord = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const composerDraftSignature = (drafts: Record<string, StoredComposerDraft>): string =>
  JSON.stringify(
    Object.keys(drafts).sort().map((key) => {
      const draft = drafts[key];
      return [key, draft.text, draft.modelId ?? '', draft.variant ?? ''];
    })
  );

const responseError = (data: unknown, fallback: string): string =>
  errorMessageOf(data) ?? fallback;

const messagePinKey = (session: SessionRef, messageId: string): string =>
  `${sessionKey(session)}::${messageId}`;

export default function App() {
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [projectsByInstance, setProjectsByInstance] = React.useState<Record<string, Project[]>>({});
  const [sessionsByInstance, setSessionsByInstance] = React.useState<Record<string, Session[]>>({});
  const [statesByInstance, setStatesByInstance] = React.useState<
    Record<string, Record<string, BallState>>
  >({});
  const [permissionsByInstance, setPermissionsByInstance] = React.useState<
    Record<string, PermissionRequest[]>
  >({});
  const [questionsByInstance, setQuestionsByInstance] = React.useState<
    Record<string, QuestionRequest[]>
  >({});
  const [queuesByInstance, setQueuesByInstance] = React.useState<
    Record<string, MessageQueueSession[]>
  >({});
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [previewVersions, setPreviewVersions] = React.useState<Record<string, number | undefined>>({});
  const [selected, setSelected] = React.useState<SessionRef | null>(null);
  const [newSessionInstanceId, setNewSessionInstanceId] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState<{
    key: string | null;
    messages: ChatMessage[];
    status: MessagesStatus;
  }>({ key: null, messages: [], status: 'ready' });
  const [modelsByInstance, setModelsByInstance] = React.useState<Record<string, ModelList>>({});
  const [scheduledTaskNames, setScheduledTaskNames] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [sendingKeys, setSendingKeys] = React.useState<Set<string>>(() => new Set());
  const [reloadingKeys, setReloadingKeys] = React.useState<Set<string>>(() => new Set());
  // Local fallback for instances whose OpenChamber predates server-side auto-accept.
  const [bypassOverrides, setBypassOverrides] = React.useState<Record<string, boolean>>({});
  const [autoAcceptByInstance, setAutoAcceptByInstance] = React.useState<Record<string, AutoAcceptPolicy>>({});
  const [failedKeys, setFailedKeys] = React.useState<Set<string>>(() => new Set());
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsActivated, setSettingsActivated] = React.useState(false);
  const [avatarPickerSession, setAvatarPickerSession] = React.useState<Session | null>(null);
  const [settingsView, setSettingsView] = React.useState<'general' | 'instances'>('general');
  const [showArchived, setShowArchived] = React.useState(false);
  const [showScheduled, setShowScheduled] = React.useState(false);
  const [mobileRailOpen, setMobileRailOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  const {
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
  } = useFeedback();

  const clearActionError = React.useCallback(() => showActionError(null), [showActionError]);
  const { settings, settingsLoaded, settingsRef, hydrateSettings, markSettingsLoaded, updateSettings } =
    useEmberSettings({ onError: showActionError, onBeforeSave: clearActionError });
  const handleSettings = updateSettings;

  React.useEffect(() => {
    if (!mobileRailOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileRailOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileRailOpen]);

  React.useEffect(() => {
    const openOnShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setCommandPaletteOpen(true);
    };
    window.addEventListener('keydown', openOnShortcut);
    return () => window.removeEventListener('keydown', openOnShortcut);
  }, []);

  // Keep a live ref to the selected session so pollers can read its
  // directory (for routing) without re-running the effect on every session list refresh.
  const selectedSessionRef = React.useRef<Session | null>(null);
  const selectedKeyRef = React.useRef<string | null>(null);
  const sessionsByInstanceRef = React.useRef<Record<string, Session[]>>({});
  const projectsByInstanceRef = React.useRef<Record<string, Project[]>>({});
  const pendingCreatedSessions = React.useRef(new Map<string, { session: Session; expiresAt: number }>());
  // Snapshot the entries first: deleting from a Map while `forEach`-ing it can skip entries.
  const prunePendingCreated = (shouldDrop: (pending: { session: Session; expiresAt: number }) => boolean) => {
    [...pendingCreatedSessions.current.entries()].forEach(([key, pending]) => {
      if (shouldDrop(pending)) pendingCreatedSessions.current.delete(key);
    });
  };
  const pendingOptimisticIds = React.useRef(new Set<string>());
  // Once a reconciled transcript no longer carries an optimistic bubble, the server has its
  // own copy and the id can be released. Ids of failed sends are released by their caller.
  const releaseReconciledOptimistic = (messages: ChatMessage[]) => {
    if (pendingOptimisticIds.current.size === 0) return;
    const stillPending = new Set(messages.map((message) => message.id));
    [...pendingOptimisticIds.current].forEach((id) => {
      if (!stillPending.has(id)) pendingOptimisticIds.current.delete(id);
    });
  };
  const bypassReplyIds = React.useRef(new Set<string>());
  const messageCacheRef = React.useRef(new Map<string, ChatMessage[]>());
  const scheduledBindingsRef = React.useRef<Record<string, string>>({});
  const lastStatusAnnouncementRef = React.useRef<{
    key: string;
    state: BallState;
    signature: string;
  } | null>(null);
  const cacheMessages = (key: string, messagesForSession: ChatMessage[]) => {
    const cache = messageCacheRef.current;
    cache.delete(key);
    cache.set(key, messagesForSession);
    while (cache.size > MESSAGE_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    // The status endpoint never reports errors, so the transcript is the source of truth: a
    // turn that ended in a failure (not a user stop) puts the session in the error state.
    const last = messagesForSession[messagesForSession.length - 1];
    const failed = Boolean(last && last.role === 'assistant' && last.error && !last.aborted);
    setFailedKeys((prev) => {
      if (prev.has(key) === failed) return prev;
      const next = new Set(prev);
      if (failed) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const updateCachedMessages = (
    key: string,
    updater: (messagesForSession: ChatMessage[]) => ChatMessage[]
  ) => {
    const next = updater(messageCacheRef.current.get(key) ?? []);
    cacheMessages(key, next);
    if (selectedKeyRef.current === key) {
      setTranscript((current) =>
        current.key === key ? { key, messages: next, status: 'ready' } : current
      );
    }
  };

  const readyIds = React.useMemo(
    () => instances.filter((instance) => instance.attachable).map((instance) => instance.id),
    [instances]
  );
  // Stable key so effects re-run only when the set of connected instances changes.
  const readyKey = readyIds.join('\u0000');

  // The rail shows either active or archived sessions, never both. The recency window only
  // trims the active list; the archive is where old things live. Date.now() is read inside
  // the memo, so the cut-off refreshes with every session poll rather than needing a timer.
  const { sessionWindowHours } = settings;
  const sessions = React.useMemo(() => {
    const cutoff = sessionWindowHours > 0 ? Date.now() - sessionWindowHours * 3_600_000 : 0;
    return Object.entries(sessionsByInstance)
      .filter(([instanceId]) => readyIds.includes(instanceId) && (showScheduled || !hidden.has(instanceId)))
      .flatMap(([, list]) => list)
      .filter((session) => {
        if (showScheduled) return Boolean(settings.scheduledSessionBindings[sessionKey(session)]);
        return (
          Boolean(session.archived) === showArchived &&
          (showArchived || !cutoff || (session.updated ?? 0) >= cutoff)
        );
      });
  }, [sessionsByInstance, readyIds, hidden, showArchived, showScheduled, sessionWindowHours, settings.scheduledSessionBindings]);

  const allSessions = React.useMemo(
    () =>
      Object.entries(sessionsByInstance)
        .filter(([instanceId]) => readyIds.includes(instanceId))
        .flatMap(([, list]) => list),
    [readyIds, sessionsByInstance]
  );

  const permissions = React.useMemo(
    () => Object.values(permissionsByInstance).flat(),
    [permissionsByInstance]
  );
  const questions = React.useMemo(
    () => Object.values(questionsByInstance).flat(),
    [questionsByInstance]
  );

  // The status endpoint only knows idle/busy. A failed last turn makes an idle session `error`;
  // a pending approval or question trumps everything: the agent is blocked on us.
  const states = React.useMemo(() => {
    const merged = Object.assign({}, ...Object.values(statesByInstance)) as Record<string, BallState>;
    failedKeys.forEach((key) => {
      if ((merged[key] ?? 'idle') === 'idle') merged[key] = 'error';
    });
    [...permissions, ...questions].forEach((request) => {
      merged[sessionKey({ instanceId: request.instanceId, sessionId: request.sessionId })] = 'needs-input';
    });
    return merged;
  }, [statesByInstance, permissions, questions, failedKeys]);

  const selectedKey = selected ? sessionKey(selected) : null;
  const cachedTranscript = selectedKey ? messageCacheRef.current.get(selectedKey) : undefined;
  const transcriptMatchesSelection = Boolean(selectedKey && transcript.key === selectedKey);
  const messages = transcriptMatchesSelection ? transcript.messages : cachedTranscript ?? [];
  const messagesStatus: MessagesStatus = transcriptMatchesSelection
    ? transcript.status
    : cachedTranscript
      ? 'ready'
      : 'loading';
  // A retry belongs to the session it failed on; the banner text may still apply.
  React.useEffect(() => {
    clearActionErrorRetry();
  }, [selectedKey, clearActionErrorRetry]);
  const sending = selectedKey ? sendingKeys.has(selectedKey) : false;
  // YOLO mode. When the instance supports server-side auto-accept, the server's per-session
  // policy is the truth (it's what OpenChamber shows as "Permission auto-accept"). Otherwise
  // fall back to a local override and Ember replies to prompts itself while the session is open.
  const selectedPolicy = selected ? autoAcceptByInstance[selected.instanceId] : undefined;
  const serverYolo = Boolean(selectedPolicy?.supported);
  const bypass = selectedKey && selected
    ? serverYolo
      ? selectedPolicy?.sessions[selected.sessionId] ?? false
      : bypassOverrides[selectedKey] ?? settings.instanceDefaults[selected.instanceId]?.bypass ?? false
    : false;
  const selectedSession = selected
    ? (sessionsByInstance[selected.instanceId] ?? []).find((s) => s.id === selected.sessionId) ?? null
    : null;
  const selectedInstance = selected
    ? instances.find((instance) => instance.id === selected.instanceId) ?? null
    : null;
  const selectedQueue = selected
    ? (queuesByInstance[selected.instanceId] ?? []).find((queue) => queue.sessionId === selected.sessionId) ?? null
    : null;
  const allocatedProjectColors = React.useMemo(() => {
    const keys = Object.entries(projectsByInstance).flatMap(([instanceId, projects]) =>
      projects.map((project) => projectIdentityKey(instanceId, project.id))
    );
    return allocateProjectColors(keys, settings.projectColorAssignments);
  }, [projectsByInstance, settings.projectColorAssignments]);
  // Every blob renderer memoizes on its identity object, so hand back the previous reference
  // whenever a session's identity hasn't actually changed; otherwise each 10s poll would
  // re-derive traits for every visible avatar.
  const avatarIdentitiesRef = React.useRef<Record<string, AvatarIdentity>>({});
  const avatarIdentities = React.useMemo(() => {
    const previous = avatarIdentitiesRef.current;
    const next = Object.fromEntries(
      Object.entries(sessionsByInstance).flatMap(([instanceId, list]) =>
        list.map((session) => {
          const key = sessionKey(session);
          const identity = resolveAvatarIdentity(
            session,
            projectsByInstance[instanceId] ?? [],
            settings.scheduledSessionBindings,
            settings.avatarOverrides,
            allocatedProjectColors
          );
          const before = previous[key];
          return [key, before && sameIdentity(before, identity) ? before : identity];
        })
      )
    );
    avatarIdentitiesRef.current = next;
    return next;
  }, [sessionsByInstance, projectsByInstance, settings.scheduledSessionBindings, settings.avatarOverrides, allocatedProjectColors]);
  // avatarIdentities keeps stable references, and the fallback is memoized on the key, so this
  // is safe to use directly as an effect dependency.
  const selectedIdentity = React.useMemo(
    () => (selectedKey ? avatarIdentities[selectedKey] ?? seedIdentity(selectedKey) : seedIdentity('')),
    [selectedKey, avatarIdentities]
  );
  const avatarPickerIdentity = avatarPickerSession
    ? avatarIdentities[sessionKey(avatarPickerSession)] ??
      resolveAvatarIdentity(
        avatarPickerSession,
        projectsByInstance[avatarPickerSession.instanceId] ?? [],
        settings.scheduledSessionBindings,
        settings.avatarOverrides,
        allocatedProjectColors
      )
    : seedIdentity('');
  const avatarPickerProject = avatarPickerSession
    ? projectForSession(avatarPickerSession, projectsByInstance[avatarPickerSession.instanceId] ?? [])
    : null;
  const avatarPickerScopes = avatarPickerSession
    ? [
        { key: sessionAvatarKey(avatarPickerSession), label: 'This session' },
        ...(avatarPickerIdentity.taskKey
          ? [{
              key: avatarPickerIdentity.taskKey,
              label: `Scheduled task: ${scheduledTaskNames[avatarPickerIdentity.taskKey] ?? 'this task'}`,
            }]
          : []),
        ...(avatarPickerIdentity.projectKey
          ? [{
              key: avatarPickerIdentity.projectKey,
              label: avatarPickerProject ? `Project: ${avatarPickerProject.name}` : 'This folder',
            }]
          : []),
      ]
    : [];
  const pinnedMessageIds = React.useMemo(() => {
    if (!selected) return new Set<string>();
    const prefix = `${sessionKey(selected)}::`;
    return new Set(
      settings.pinnedMessages
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
    );
  }, [selected, settings.pinnedMessages]);

  // Sync the ref every render so the poller always sees the current directory.
  selectedSessionRef.current = selectedSession;
  selectedKeyRef.current = selectedKey;
  sessionsByInstanceRef.current = sessionsByInstance;
  projectsByInstanceRef.current = projectsByInstance;
  scheduledBindingsRef.current = settings.scheduledSessionBindings;

  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // The Dock icon mirrors the selected session's blob (and its state) so a glance at the Dock
  // says which agent this window is on. Theme is a dependency because the tile and the
  // contrast-adjusted palettes come from the current CSS variables.
  const selectedState: BallState = selectedKey ? states[selectedKey] ?? 'idle' : 'idle';
  React.useEffect(() => {
    if (!selectedKey) return;
    let cancelled = false;
    void import('./blob/dockIcon')
      .then(({ renderDockIcon }) =>
        renderDockIcon(settings.blobStyle, selectedIdentity, selectedState)
      )
      .then((dataUrl) => {
        if (!cancelled) return window.ember.setDockIcon(dataUrl);
      })
      .catch((err) => console.warn('Dock icon render failed', err));
    return () => {
      cancelled = true;
    };
  }, [selectedKey, selectedIdentity, selectedState, settings.blobStyle, settings.theme]);

  const refreshInstances = React.useCallback(async function refreshInstances() {
    setRefreshing(true);
    showActionError(null);
    try {
      setInstances(await listInstances());
    } catch (err) {
      showActionError(
        err instanceof Error ? err.message : 'Could not reprobe instances.',
        () => void refreshInstances()
      );
    } finally {
      setRefreshing(false);
    }
  }, [showActionError]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [stored, list] = await Promise.all([window.ember.getSettings(), listInstances()]);
        if (cancelled) return;
        hydrateSettings(stored);
        setInstances(list);
      } catch (err) {
        if (cancelled) return;
        markSettingsLoaded();
        setLoading(false);
        showActionError(
          err instanceof Error ? err.message : 'Ember could not finish starting.',
          () => window.location.reload()
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateSettings, markSettingsLoaded, showActionError]);

  // Per-instance data that rarely changes: projects, models.
  React.useEffect(() => {
    if (readyIds.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const [projects, modelLists] = await Promise.all([
          loadAllProjects(readyIds),
          Promise.all(readyIds.map(async (id) => [id, await loadModels(id)] as const)),
        ]);
        if (cancelled) return;
        // An instance that failed to answer is absent from these maps; keep its previous data.
        setProjectsByInstance((prev) => ({ ...prev, ...projects }));
        setModelsByInstance((prev) => ({
          ...prev,
          ...Object.fromEntries(
            modelLists.filter((entry): entry is readonly [string, ModelList] => entry[1] !== null)
          ),
        }));
      } catch (err) {
        if (!cancelled) {
          showActionError(err instanceof Error ? err.message : 'Could not load instance metadata.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readyKey is the stable string form of readyIds; refs carry the rest
  }, [readyKey]);

  // ---- Refreshers: one per REST resource. Timers and event hints both call these. ----
  // Each takes the instance ids to refresh and merges the result into state, leaving other
  // instances untouched. Failure preserves prior state (the loaders return null / omit keys).

  const directoryHintsFor = (instanceIds: string[]): Record<string, string[]> => {
    const hints: Record<string, string[]> = {};
    const current = selectedSessionRef.current;
    if (current?.directory && instanceIds.includes(current.instanceId)) {
      hints[current.instanceId] = [current.directory];
    }
    return hints;
  };

  const refreshSessions = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    try {
      const next = await loadAllSessions(instanceIds, directoryHintsFor(instanceIds));
      const now = Date.now();
      prunePendingCreated(
        (pending) =>
          pending.expiresAt <= now ||
          Boolean(next[pending.session.instanceId]?.some((session) => session.id === pending.session.id))
      );
      const preserved = [
        ...(selectedSessionRef.current ? [selectedSessionRef.current] : []),
        ...[...pendingCreatedSessions.current.values()].map((pending) => pending.session),
      ];
      setSessionsByInstance((prev) => mergePolledSessions(prev, next, preserved));
      setLoading(false);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  });

  const refreshAutoAccept = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const policies = await loadAllAutoAcceptPolicies(instanceIds).catch(() => ({}));
    setAutoAcceptByInstance((prev) => ({ ...prev, ...policies }));
  });

  const refreshStates = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const next = await loadAllSessionStates(instanceIds).catch(() => ({}));
    setStatesByInstance((prev) => ({ ...prev, ...next }));
  });

  const refreshPermissions = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const next = await loadAllPermissions(instanceIds, directoryHintsFor(instanceIds)).catch(() => ({}));
    setPermissionsByInstance((prev) => ({ ...prev, ...next }));
  });

  const refreshQuestions = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const next = await loadAllQuestions(instanceIds, directoryHintsFor(instanceIds)).catch(() => ({}));
    setQuestionsByInstance((prev) => ({ ...prev, ...next }));
  });

  const refreshQueues = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const next = await loadAllMessageQueues(instanceIds).catch(() => ({}));
    setQueuesByInstance((prev) => ({ ...prev, ...next }));
  });

  /** Refetch one transcript; applies to the open view only if it's still the selected session. */
  const refreshMessages = useStableCallback(async (ref: SessionRef) => {
    const key = sessionKey(ref);
    const directory =
      (sessionsByInstanceRef.current[ref.instanceId] ?? []).find((session) => session.id === ref.sessionId)?.directory;
    try {
      const next = await loadMessages(ref.instanceId, ref.sessionId, directory);
      const merged = reconcilePolledMessages(messageCacheRef.current.get(key) ?? [], next, pendingOptimisticIds.current);
      releaseReconciledOptimistic(merged);
      const result = sameMessages(messageCacheRef.current.get(key) ?? [], merged)
        ? messageCacheRef.current.get(key) ?? merged
        : merged;
      cacheMessages(key, result);
      if (selectedKeyRef.current === key) {
        setTranscript((current) =>
          current.key === key && current.messages === result && current.status === 'ready'
            ? current
            : { key, messages: result, status: 'ready' }
        );
      }
      const preview = previewOf(next);
      if (preview) {
        setPreviews((prev) => (prev[key] === preview ? prev : { ...prev, [key]: preview }));
      }
    } catch (err) {
      console.error('Failed to load messages', err);
      if (selectedKeyRef.current === key) {
        setTranscript((current) =>
          current.key === key && current.status !== 'ready' ? { ...current, status: 'error' } : current
        );
      }
    }
  });

  const refreshScheduled = useStableCallback(async (instanceIds: string[]) => {
    const projects = projectsByInstanceRef.current;
    const targets = instanceIds.filter((instanceId) => (projects[instanceId] ?? []).length > 0);
    if (targets.length === 0) return;
    try {
      const results = await Promise.all(
        targets.map((instanceId) => loadScheduledIdentityData(instanceId, projects[instanceId] ?? []))
      );
      const discovered: Record<string, string> = Object.assign({}, ...results.map((result) => result.bindings));
      const names: Record<string, string> = Object.assign({}, ...results.map((result) => result.taskNames));
      setScheduledTaskNames((prev) => ({ ...prev, ...names }));
      const merged: Record<string, string> = Object.fromEntries(
        Object.entries({ ...scheduledBindingsRef.current, ...discovered }).slice(-2000)
      );
      if (!sameStringRecord(merged, scheduledBindingsRef.current)) {
        scheduledBindingsRef.current = merged;
        handleSettings({ scheduledSessionBindings: merged });
      }
    } catch (err) {
      console.warn('Failed to load scheduled task identities', err);
    }
  });

  // ---- Event streams: hints invalidate, refreshers refetch. ----
  const [liveInstances, setLiveInstances] = React.useState<Record<string, boolean>>({});
  const liveInstancesRef = React.useRef(liveInstances);
  const refetch = useStableCallback(async ({ instanceId, resource, sessionId }: Invalidation) => {
    switch (resource) {
      case 'sessions': await refreshSessions([instanceId]); break;
      case 'states': await refreshStates([instanceId]); break;
      case 'permissions': await refreshPermissions([instanceId]); break;
      case 'questions': await refreshQuestions([instanceId]); break;
      case 'queues': await refreshQueues([instanceId]); break;
      case 'autoAccept': await refreshAutoAccept([instanceId]); break;
      case 'scheduled': await refreshScheduled([instanceId]); break;
      case 'messages': if (sessionId) await refreshMessages({ instanceId, sessionId }); break;
    }
  });
  const invalidationQueue = React.useMemo(() => new InvalidationQueue(refetch), [refetch]);

  React.useEffect(() => {
    const bridge = window.ember;
    if (!bridge.onEvent) return;
    const readySet = new Set(readyIds);
    const isLoaded = (instanceId: string, sessionId: string) =>
      selectedKeyRef.current === sessionKey({ instanceId, sessionId });

    const catchUp = (instanceId: string) => {
      // The stream just (re)connected; anything that changed while it was down was missed.
      (['sessions', 'states', 'permissions', 'questions', 'queues', 'autoAccept'] as const).forEach((resource) =>
        invalidationQueue.push({ instanceId, resource })
      );
      if (selectedKeyRef.current && selectedSessionRef.current?.instanceId === instanceId) {
        invalidationQueue.push({ instanceId, resource: 'messages', sessionId: selectedSessionRef.current.id });
      }
    };

    const unsubscribe = bridge.onEvent((raw) => {
      const event = parseEmberEvent(raw);
      if (!event || !readySet.has(event.instanceId)) return;
      if (event.type === 'ember:stream-status') {
        const connected = event.connected === true;
        const wasConnected = liveInstancesRef.current[event.instanceId] === true;
        if (wasConnected === connected) return;
        liveInstancesRef.current = { ...liveInstancesRef.current, [event.instanceId]: connected };
        setLiveInstances(liveInstancesRef.current);
        if (connected) catchUp(event.instanceId);
        return;
      }
      invalidationsFor(event, isLoaded).forEach((invalidation) => invalidationQueue.push(invalidation));
    });
    void bridge.eventStatus?.().then((status) => {
      liveInstancesRef.current = { ...liveInstancesRef.current, ...status };
      setLiveInstances(liveInstancesRef.current);
    });

    return () => {
      unsubscribe();
      invalidationQueue.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readyKey is the stable string form of readyIds; refs carry the rest
  }, [readyKey, invalidationQueue]);

  // ---- Polling: the safety net. Instances with a live stream poll slowly; the rest fast. ----
  // Split by liveness so one instance that can't stream (older OpenChamber, flaky tunnel)
  // doesn't drag the others back to the fast cadence.
  const liveIds = React.useMemo(() => readyIds.filter((id) => liveInstances[id]), [readyIds, liveInstances]);
  const deadIds = React.useMemo(() => readyIds.filter((id) => !liveInstances[id]), [readyIds, liveInstances]);
  const liveIdsRef = React.useRef(liveIds);
  liveIdsRef.current = liveIds;
  const deadIdsRef = React.useRef(deadIds);
  deadIdsRef.current = deadIds;

  const refreshListFor = async (ids: string[]) => {
    await Promise.all([refreshSessions(ids), refreshAutoAccept(ids)]);
  };
  const refreshStateFor = async (ids: string[]) => {
    await Promise.all([refreshStates(ids), refreshPermissions(ids), refreshQuestions(ids), refreshQueues(ids)]);
  };
  usePoll(() => refreshListFor(deadIdsRef.current), SESSION_POLL_MS, deadIds.length > 0);
  usePoll(() => refreshListFor(liveIdsRef.current), SESSION_POLL_LIVE_MS, liveIds.length > 0);
  usePoll(() => refreshStateFor(deadIdsRef.current), STATE_POLL_MS, deadIds.length > 0);
  usePoll(() => refreshStateFor(liveIdsRef.current), STATE_POLL_LIVE_MS, liveIds.length > 0);

  // Read through refs so this effect only re-runs when the session list changes. Depending on
  // `previews` directly made every 3s transcript poll cancel an in-flight preview batch.
  const previewsRef = React.useRef(previews);
  previewsRef.current = previews;
  const previewVersionsRef = React.useRef(previewVersions);
  previewVersionsRef.current = previewVersions;

  React.useEffect(() => {
    const targets = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .slice(0, PREVIEW_COUNT)
      .filter((session) => {
        const key = sessionKey(session);
        return !(key in previewsRef.current) || previewVersionsRef.current[key] !== session.updated;
      });
    if (targets.length === 0) return;
    let cancelled = false;

    void (async () => {
      const entries: Array<readonly [string, string | null, number | undefined]> = [];
      let cursor = 0;
      const loadNext = async (): Promise<void> => {
        while (cursor < targets.length) {
          const session = targets[cursor];
          cursor += 1;
          const key = sessionKey(session);
          const loaded = await loadMessages(session.instanceId, session.id, session.directory).catch(() => null);
          if (loaded) cacheMessages(key, loaded);
          entries.push([key, loaded ? previewOf(loaded) : null, session.updated]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(PREVIEW_CONCURRENCY, targets.length) }, () => loadNext())
      );
      if (cancelled) return;
      const successful = entries.filter(
        (entry): entry is readonly [string, string, number | undefined] => entry[1] !== null
      );
      if (successful.length > 0) {
        setPreviews((prev) => ({
          ...prev,
          ...Object.fromEntries(successful.map(([key, preview]) => [key, preview])),
        }));
        setPreviewVersions((prev) => ({
          ...prev,
          ...Object.fromEntries(successful.map(([key, , updated]) => [key, updated])),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessions]);

  // Messages for the open session. Switching shows the cached transcript at once; the poll
  // below (and message events) keep it fresh while the agent is working.
  React.useEffect(() => {
    if (!selected) {
      setTranscript({ key: null, messages: [], status: 'ready' });
      return;
    }
    const key = sessionKey(selected);
    const cached = messageCacheRef.current.get(key);
    setTranscript({ key, messages: cached ?? [], status: cached ? 'ready' : 'loading' });
    void refreshMessages(selected);
  }, [selected, refreshMessages]);

  const selectedLive = Boolean(selected && liveInstances[selected.instanceId]);
  usePoll(
    async () => {
      if (selected) await refreshMessages(selected);
    },
    selectedLive ? MESSAGES_POLL_LIVE_MS : STATE_POLL_MS,
    selected !== null
  );

  const toggleInstance = (instanceId: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });

  /**
   * Turn YOLO mode on/off for a session. Writes the server-side policy when the instance has
   * it (optimistically, then reconciled by the next poll); otherwise records a local override
   * and Ember auto-replies itself while the session is open.
   */
  const setYolo = async (ref: SessionRef, enabled: boolean, directory?: string): Promise<void> => {
    const key = sessionKey(ref);
    const policy = autoAcceptByInstance[ref.instanceId];
    if (policy && !policy.supported) {
      setBypassOverrides((prev) => ({ ...prev, [key]: enabled }));
      return;
    }
    const previous = policy?.sessions[ref.sessionId];
    setAutoAcceptByInstance((prev) => ({
      ...prev,
      [ref.instanceId]: {
        supported: true,
        sessions: { ...(prev[ref.instanceId]?.sessions ?? {}), [ref.sessionId]: enabled },
      },
    }));
    try {
      const result = await setAutoAccept(ref.instanceId, ref.sessionId, enabled, directory);
      if (result.status === 404) {
        // Older OpenChamber: remember that and use the local fallback from now on.
        setAutoAcceptByInstance((prev) => ({ ...prev, [ref.instanceId]: { supported: false, sessions: {} } }));
        setBypassOverrides((prev) => ({ ...prev, [key]: enabled }));
        return;
      }
      if (!result.ok) throw new Error(`Server refused (${result.status}).`);
    } catch (err) {
      setAutoAcceptByInstance((prev) => {
        const sessions = { ...(prev[ref.instanceId]?.sessions ?? {}) };
        if (previous === undefined) delete sessions[ref.sessionId];
        else sessions[ref.sessionId] = previous;
        return { ...prev, [ref.instanceId]: { supported: true, sessions } };
      });
      showActionError(
        `Could not ${enabled ? 'enable' : 'disable'} YOLO mode. ${err instanceof Error ? err.message : ''}`.trim(),
        () => void setYolo(ref, enabled, directory)
      );
    }
  };

  const beginNewAgent = (instanceId: string) => {
    showActionError(null);
    setSelected(null);
    setNewSessionInstanceId(instanceId);
  };

  const handleCreateSession = async (options: NewSessionOptions): Promise<boolean> => {
    showActionError(null);
    try {
      const created = await createSession(options.instanceId, options.directory);
      if (!created) {
        showActionError('Could not create a new agent.');
        return false;
      }
      const now = Date.now();
      prunePendingCreated((pending) => pending.expiresAt <= now);
      pendingCreatedSessions.current.set(sessionKey(created), {
        session: created,
        expiresAt: now + CREATED_SESSION_GRACE_MS,
      });
      setSessionsByInstance((prev) => ({
        ...prev,
        [options.instanceId]: [created, ...(prev[options.instanceId] ?? [])],
      }));
      setHidden((prev) => {
        if (!prev.has(options.instanceId)) return prev;
        const next = new Set(prev);
        next.delete(options.instanceId);
        return next;
      });
      const ref = { instanceId: options.instanceId, sessionId: created.id };
      setSelected(ref);
      setNewSessionInstanceId(null);
      if (options.bypass) void setYolo(ref, true, created.directory);
      // The optimistic insert above plus the pendingCreatedSessions grace keep the row visible;
      // the next session poll (which includes the selected session's directory) is authoritative.
      return true;
    } catch (err) {
      showActionError(err instanceof Error ? err.message : 'Could not create a new agent.');
      return false;
    }
  };

  const handleSend = async (input: PromptInput): Promise<boolean> => {
    if (!selected) return false;
    showActionError(null);
    const { instanceId, sessionId } = selected;
    const { model, text, attachments = [], variant } = input;
    const key = sessionKey(selected);
    const directory = selectedSession?.directory;

    // Show the user's message immediately so it doesn't look like it vanished.
    const createdAt = Date.now();
    const optimisticId = createClientMessageId(createdAt);
    const parts: ChatMessage['parts'] = [
      ...(text.trim()
        ? [{ type: 'text' as const, id: `${optimisticId}-text`, text: text.trim() }]
        : []),
      ...attachments.map((file, index) => ({
        type: 'file' as const,
        id: `${optimisticId}-file-${index}`,
        file,
      })),
    ];
    const optimistic: ChatMessage = {
      id: optimisticId,
      role: 'user',
      text: text.trim(),
      parts,
      model: model ? { providerID: model.providerID, modelID: model.modelID, variant } : undefined,
      createdAt,
      completed: true,
    };
    pendingOptimisticIds.current.add(optimisticId);
    updateCachedMessages(key, (prev) => [...prev, optimistic]);
    setSendingKeys((prev) => new Set(prev).add(key));

    const removeOptimistic = () =>
      updateCachedMessages(key, (prev) => prev.filter((message) => message.id !== optimisticId));
    let accepted = false;

    try {
      const sent = await sendPrompt(instanceId, sessionId, input, directory, optimisticId);
      // Keep the optimistic id registered until the transcript below is reconciled; the 3s
      // poller can land in between and would otherwise drop the bubble for one tick.
      if (!sent.ok) {
        pendingOptimisticIds.current.delete(optimisticId);
        removeOptimistic();
        showActionError(
          responseError(sent.data, 'Message could not be sent.'),
          () => void handleSend(input)
        );
        return false;
      }
      accepted = true;
      const updated = Date.now();
      // Mirror what the next session poll will report so the recents list moves right away.
      setSessionsByInstance((prev) => ({
        ...prev,
        [instanceId]: (prev[instanceId] ?? []).map((session) =>
          session.id === sessionId
            ? {
                ...session,
                updated,
                model: model ? { providerID: model.providerID, modelID: model.modelID, variant } : session.model,
              }
            : session
        ),
      }));
      const loaded = await loadMessages(instanceId, sessionId, directory);
      // The server may not have indexed the user turn yet; keep the bubble until it does.
      const next = reconcilePolledMessages(
        messageCacheRef.current.get(key) ?? [],
        loaded,
        pendingOptimisticIds.current
      );
      releaseReconciledOptimistic(next);
      const preview = previewOf(next);
      cacheMessages(key, next);
      if (selectedKeyRef.current === key) {
        setTranscript((current) =>
          current.key === key ? { key, messages: next, status: 'ready' } : current
        );
      }
      setPreviews((prev) => ({ ...prev, [key]: preview }));
      setPreviewVersions((prev) => ({ ...prev, [key]: updated }));
      return true;
    } catch (err) {
      console.error('Send failed', err);
      if (!accepted) removeOptimistic();
      showActionError(
        accepted
          ? 'Message was sent, but the transcript could not be refreshed yet.'
          : err instanceof Error
            ? err.message
            : 'Message could not be sent.',
        accepted ? undefined : () => void handleSend(input)
      );
      return accepted;
    } finally {
      // Accepted sends keep the id until a poll shows the server copy (see releaseReconciledOptimistic).
      if (!accepted) pendingOptimisticIds.current.delete(optimisticId);
      setSendingKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const queue = useMessageQueue({
    selected,
    selectedSession,
    selectedQueue,
    modelsByInstance,
    setQueuesByInstance,
    showActionError,
    sendPrompt: handleSend,
  });

  const handleReloadSession = async (session: Session) => {
    const key = sessionKey(session);
    if (reloadingKeys.has(key)) return;
    showActionError(null);
    setReloadingKeys((current) => new Set(current).add(key));
    const hints = session.directory ? { [session.instanceId]: [session.directory] } : {};
    const results = await Promise.allSettled([
      loadAllSessions([session.instanceId], hints),
      loadMessages(session.instanceId, session.id, session.directory),
      loadSessionStates(session.instanceId),
      loadPermissions(session.instanceId),
      loadQuestions(session.instanceId, session.directory),
    ] as const);
    const [sessionResult, messageResult, stateResult, permissionResult, questionResult] = results;

    if (sessionResult.status === 'fulfilled' && sessionResult.value[session.instanceId]) {
      setSessionsByInstance((current) =>
        mergePolledSessions(current, sessionResult.value, [session])
      );
    }
    if (messageResult.status === 'fulfilled') {
      const merged = reconcilePolledMessages(
        messageCacheRef.current.get(key) ?? [],
        messageResult.value,
        pendingOptimisticIds.current
      );
      cacheMessages(key, merged);
      if (selectedKeyRef.current === key) {
        setTranscript((current) =>
          current.key === key ? { key, messages: merged, status: 'ready' } : current
        );
      }
      const preview = previewOf(messageResult.value);
      setPreviews((current) => ({ ...current, [key]: preview }));
      setPreviewVersions((current) => ({ ...current, [key]: session.updated }));
    } else if (selectedKeyRef.current === key) {
      setTranscript((current) =>
        current.key === key ? { ...current, status: 'error' } : current
      );
    }
    if (stateResult.status === 'fulfilled' && stateResult.value) {
      setStatesByInstance((current) => ({ ...current, [session.instanceId]: stateResult.value! }));
    }
    if (permissionResult.status === 'fulfilled' && permissionResult.value) {
      setPermissionsByInstance((current) => ({ ...current, [session.instanceId]: permissionResult.value! }));
    }
    if (questionResult.status === 'fulfilled' && questionResult.value) {
      setQuestionsByInstance((current) => ({ ...current, [session.instanceId]: questionResult.value! }));
    }
    if (results.some((result) => result.status === 'rejected')) {
      showActionError(
        'Some session data could not be refreshed.',
        () => void handleReloadSession(session)
      );
    }
    setReloadingKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  // Archive/restore on the source OpenChamber instance, then mirror locally so the
  // row leaves the current view without waiting for the next poll.
  const handleArchive = async (session: Session, archived: boolean) => {
    showActionError(null);
    setActionNotice(null);
    try {
      const ok = await setSessionArchived(session, archived);
      if (!ok) {
        showActionError(
          archived ? 'Could not archive this session.' : 'Could not restore this session.',
          () => void handleArchive(session, archived)
        );
        return;
      }
      setSessionsByInstance((prev) => ({
        ...prev,
        [session.instanceId]: (prev[session.instanceId] ?? []).map((entry) =>
          entry.id === session.id ? { ...entry, archived: archived ? Date.now() : undefined } : entry
        ),
      }));
      if (selectedKey === sessionKey(session)) setSelected(null);
      setActionNotice(
        archived
          ? {
              message: 'Session archived.',
              actionLabel: 'Undo',
              action: () => void handleArchive(session, false),
            }
          : { message: 'Session restored.' }
      );
    } catch (err) {
      showActionError(
        err instanceof Error
          ? err.message
          : archived
            ? 'Could not archive this session.'
            : 'Could not restore this session.',
        () => void handleArchive(session, archived)
      );
    }
  };

  // Drop the card as soon as the server accepts the reply; the next poll is authoritative.
  const handlePermission = async (
    request: PermissionRequest,
    reply: PermissionReply
  ): Promise<boolean> => {
    showActionError(null);
    try {
      const directory = request.directory ?? (sessionsByInstance[request.instanceId] ?? []).find(
        (session) => session.id === request.sessionId
      )?.directory;
      const ok = await replyPermission(request, reply, directory);
      if (!ok) {
        showActionError(
          'Could not reply to this permission request.',
          () => void handlePermission(request, reply)
        );
        return false;
      }
      setPermissionsByInstance((prev) => ({
        ...prev,
        [request.instanceId]: (prev[request.instanceId] ?? []).filter((entry) => entry.id !== request.id),
      }));
      return true;
    } catch (err) {
      showActionError(
        err instanceof Error ? err.message : 'Could not reply to this permission request.',
        () => void handlePermission(request, reply)
      );
      return false;
    }
  };

  // handlePermission is redefined every render; go through a stable wrapper so this effect
  // only re-runs when the permission list or the selection actually changes.
  const autoReplyPermission = useStableCallback(handlePermission);
  React.useEffect(() => {
    // With server-side YOLO the server answers prompts itself; replying here too would race it.
    if (!bypass || !selected || serverYolo) return;
    permissions
      .filter(
        (request) =>
          request.instanceId === selected.instanceId && request.sessionId === selected.sessionId
      )
      .forEach((request) => {
        const key = `${request.instanceId}:${request.id}`;
        if (bypassReplyIds.current.has(key)) return;
        bypassReplyIds.current.add(key);
        void autoReplyPermission(request, 'once').finally(() => bypassReplyIds.current.delete(key));
      });
  }, [bypass, serverYolo, permissions, selected, autoReplyPermission]);

  const sessionDirectory = (instanceId: string, sessionId: string) =>
    (sessionsByInstance[instanceId] ?? []).find((session) => session.id === sessionId)?.directory;

  const dropQuestion = (request: QuestionRequest) =>
    setQuestionsByInstance((prev) => ({
      ...prev,
      [request.instanceId]: (prev[request.instanceId] ?? []).filter((entry) => entry.id !== request.id),
    }));

  const handleQuestion = async (
    request: QuestionRequest,
    answers: QuestionAnswers | null
  ): Promise<boolean> => {
    showActionError(null);
    try {
      const directory = request.directory ?? sessionDirectory(request.instanceId, request.sessionId);
      const ok = answers
        ? await replyQuestion(request, answers, directory)
        : await rejectQuestion(request, directory);
      if (!ok) {
        showActionError(
          answers ? 'Could not submit this answer.' : 'Could not dismiss this question.',
          () => void handleQuestion(request, answers)
        );
        return false;
      }
      dropQuestion(request);
      return true;
    } catch (err) {
      showActionError(
        err instanceof Error
          ? err.message
          : answers
            ? 'Could not submit this answer.'
            : 'Could not dismiss this question.',
        () => void handleQuestion(request, answers)
      );
      return false;
    }
  };

  const handleAbort = async () => {
    if (!selectedSession) return;
    showActionError(null);
    const key = sessionKey(selectedSession);
    try {
      const aborted = await abortSession(selectedSession);
      if (!aborted) {
        showActionError('Could not stop this agent.', () => void handleAbort());
        return;
      }
      const next = await loadMessages(
        selectedSession.instanceId,
        selectedSession.id,
        selectedSession.directory
      );
      cacheMessages(key, next);
      if (selectedKeyRef.current === key) {
        setTranscript((current) =>
          current.key === key
            ? {
                key,
                messages: sameMessages(current.messages, next) ? current.messages : next,
                status: 'ready',
              }
            : current
        );
      }
    } catch (err) {
      console.error('Abort refresh failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Could not stop this agent.',
        () => void handleAbort()
      );
    }
  };

  const handleAvatarOverride = (scopeKey: string, override: AvatarOverride | null) => {
    const next = { ...settings.avatarOverrides };
    if (override) next[scopeKey] = override;
    else delete next[scopeKey];
    handleSettings({ avatarOverrides: next });
  };

  React.useEffect(() => {
    if (
      Object.keys(projectsByInstance).length > 0 &&
      !sameNumberRecord(allocatedProjectColors, settings.projectColorAssignments)
    ) {
      handleSettings({ projectColorAssignments: allocatedProjectColors });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSettings is recreated per render; it only needs the compared values
  }, [projectsByInstance, allocatedProjectColors, settings.projectColorAssignments]);

  // Scheduled-task identity is one request per project (70+ on a busy instance), so it polls
  // rarely; the `scheduled-task-ran` event covers the moment it actually matters.
  const projectsKnown = Object.keys(projectsByInstance).length > 0;
  usePoll(() => refreshScheduled(deadIdsRef.current), SCHEDULE_POLL_MS, projectsKnown && deadIds.length > 0);
  usePoll(() => refreshScheduled(liveIdsRef.current), SCHEDULE_POLL_LIVE_MS, projectsKnown && liveIds.length > 0);

  const handleTogglePin = (message: ChatMessage) => {
    if (!selected) return;
    const key = messagePinKey(selected, message.id);
    handleSettings({
      pinnedMessages: settings.pinnedMessages.includes(key)
        ? settings.pinnedMessages.filter((entry) => entry !== key)
        : [...settings.pinnedMessages, key],
    });
  };

  const handleComposerDraftsChange = (drafts: Record<string, StoredComposerDraft>) => {
    const composerDrafts = Object.fromEntries(
      Object.entries(drafts)
        .filter(([key, draft]) =>
          key.length > 0 &&
          key.length <= 500 &&
          (draft.text.trim() || draft.modelId || draft.variant)
        )
        .slice(-50)
        .map(([key, draft]) => [key, {
          text: draft.text.slice(0, 200_000),
          ...(draft.modelId ? { modelId: draft.modelId } : {}),
          ...(draft.variant ? { variant: draft.variant } : {}),
          updatedAt: draft.updatedAt || Date.now(),
        }])
    );
    if (composerDraftSignature(composerDrafts) === composerDraftSignature(settings.composerDrafts)) return;
    handleSettings({ composerDrafts }, { preserveActionError: true });
  };

  const handleSessionNotes = (notes: SessionNote[]) => {
    if (!selectedKey) return;
    const sessionNotes = { ...settings.sessionNotes };
    const clean = notes
      .map((note) => ({ id: note.id, text: note.text.slice(0, 20_000) }))
      .filter((note) => note.text.trim())
      .slice(-100);
    if (clean.length) sessionNotes[selectedKey] = clean;
    else delete sessionNotes[selectedKey];
    handleSettings({ sessionNotes });
  };

  const handleDeleteSessionNote = (deleted: SessionNote) => {
    if (!selectedKey) return;
    const key = selectedKey;
    const current = settingsRef.current.sessionNotes[key] ?? [];
    const index = current.findIndex((note) => note.id === deleted.id);
    if (index < 0) return;
    handleSessionNotes(current.filter((note) => note.id !== deleted.id));
    showActionError(null);
    setActionNotice({
      message: 'Note deleted.',
      actionLabel: 'Undo',
      action: () => {
        const latest = settingsRef.current.sessionNotes[key] ?? [];
        if (latest.some((note) => note.id === deleted.id)) return;
        const restored = [...latest];
        restored.splice(Math.min(index, restored.length), 0, deleted);
        handleSettings({
          sessionNotes: { ...settingsRef.current.sessionNotes, [key]: restored },
        });
        setActionNotice({ message: 'Note restored.' });
      },
    });
  };

  const selectedModels = selected ? modelsByInstance[selected.instanceId] : undefined;
  const modelInstanceId = selected?.instanceId ?? newSessionInstanceId;
  const modelInstanceSessions = modelInstanceId ? sessionsByInstance[modelInstanceId] : undefined;
  const recentModels = React.useMemo(
    () => recentModelKeys(modelInstanceSessions ?? []),
    [modelInstanceSessions]
  );
  const selectedPermissions = React.useMemo(() => forSession(permissions, selected), [permissions, selected]);
  const selectedQuestions = React.useMemo(() => forSession(questions, selected), [questions, selected]);

  React.useEffect(() => {
    if (!selectedKey) {
      lastStatusAnnouncementRef.current = null;
      announceStatus('');
      return;
    }
    const previous = lastStatusAnnouncementRef.current;
    const sessionLabel = selectedSession?.title ?? 'selected session';
    const requestSignature = [
      ...selectedPermissions.map((request) => `p:${request.id}`),
      ...selectedQuestions.map((request) => `q:${request.id}`),
      ...(selectedQueue?.items.map((item) => `m:${item.id}`) ?? []),
      selectedQueue?.sendingId ? `s:${selectedQueue.sendingId}` : '',
    ].join('|');
    let message = '';
    if (selectedPermissions.length > 0) {
      message = `Agent in ${sessionLabel} is waiting for approval.`;
    } else if (selectedQuestions.length > 0) {
      message = `Agent in ${sessionLabel} has a question.`;
    } else if (selectedQueue?.sendingId) {
      message = `Sending a queued message in ${sessionLabel}.`;
    } else if (selectedQueue?.items.length) {
      const count = selectedQueue.items.length;
      message = selectedState === 'active'
        ? `Agent in ${sessionLabel} is working; ${count} ${count === 1 ? 'message is' : 'messages are'} queued.`
        : `${count} queued ${count === 1 ? 'message' : 'messages'} in ${sessionLabel}.`;
    } else if (selectedState === 'active') {
      message = `Agent in ${sessionLabel} is working.`;
    } else if (selectedState === 'error') {
      message = `Agent in ${sessionLabel} stopped with an error.`;
    } else if (
      previous?.key === selectedKey &&
      previous.state === 'active' &&
      selectedState === 'idle'
    ) {
      message = `Agent in ${sessionLabel} finished.`;
    }
    const signature = `${selectedState}:${requestSignature}:${message}`;
    if (previous?.key !== selectedKey || previous.signature !== signature) {
      announceStatus(message);
    }
    lastStatusAnnouncementRef.current = { key: selectedKey, state: selectedState, signature };
  }, [selectedKey, selectedSession, selectedState, selectedPermissions, selectedQuestions, selectedQueue, announceStatus]);

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {statusAnnouncement}
          </div>
          <InstanceBar
            instances={instances}
            hidden={hidden}
            live={liveInstances}
            refreshing={refreshing}
              onToggle={toggleInstance}
              onToggleNavigation={() => setMobileRailOpen((open) => !open)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onRefresh={() => void refreshInstances()}
              onOpenSettings={() => {
              setSettingsView('instances');
              setSettingsActivated(true);
              setSettingsOpen(true);
            }}
          />

          <div className="relative flex min-h-0 flex-1">
            {mobileRailOpen ? (
              <button
                type="button"
                className="fixed inset-x-0 bottom-0 top-[calc(2.75rem+env(safe-area-inset-top))] z-30 bg-black/35 backdrop-blur-[1px] md:hidden"
                onClick={() => setMobileRailOpen(false)}
                aria-label="Close sessions sidebar"
              />
            ) : null}
            <LeftRail
              instances={instances}
              projectsByInstance={projectsByInstance}
              instanceDefaults={settings.instanceDefaults}
              sessions={sessions}
              states={states}
              previews={previews}
              selectedKey={selectedKey}
              selectedSession={selectedSession}
              avatarIdentities={avatarIdentities}
              blobStyle={settings.blobStyle}
              loading={loading}
              mobileOpen={mobileRailOpen}
              reloadingKeys={reloadingKeys}
              windowLabel={
                SESSION_WINDOWS.find((option) => option.hours === sessionWindowHours && option.hours > 0)
                  ?.label ?? null
              }
              showArchived={showArchived}
              showScheduled={showScheduled}
              onShowArchived={(value) => {
                setShowArchived(value);
                if (value) setShowScheduled(false);
              }}
              onShowScheduled={(value) => {
                setShowScheduled(value);
                if (value) setShowArchived(false);
              }}
              onSelectSession={(session) => {
                setNewSessionInstanceId(null);
                setSelected({ instanceId: session.instanceId, sessionId: session.id });
                setMobileRailOpen(false);
              }}
              onReload={(session) => void handleReloadSession(session)}
              onArchive={(session, archived) => void handleArchive(session, archived)}
              onCustomizeAppearance={setAvatarPickerSession}
              onNewAgent={(instanceId) => {
                beginNewAgent(instanceId);
                setMobileRailOpen(false);
              }}
              onOpenSettings={() => {
                setMobileRailOpen(false);
                setSettingsView('general');
                setSettingsActivated(true);
                setSettingsOpen(true);
              }}
            />

            <ChatView
              session={selectedSession}
              instance={selectedInstance}
              instanceMarkerColor={selected?.instanceId ? settings.instanceDefaults[selected.instanceId]?.markerColor : undefined}
              newSessionInstanceId={newSessionInstanceId}
              instances={instances}
              projectsByInstance={projectsByInstance}
              modelsByInstance={modelsByInstance}
              instanceDefaults={settings.instanceDefaults}
              seed={selectedKey ?? ''}
              identity={selectedIdentity}
              state={selectedKey ? states[selectedKey] ?? 'idle' : 'idle'}
              blobStyle={settings.blobStyle}
              messages={messages}
              messagesStatus={messagesStatus}
              permissions={selectedPermissions}
              questions={selectedQuestions}
              models={selectedModels?.models ?? []}
              defaultModelId={selectedModels?.defaultModelId ?? null}
              recentModels={recentModels}
              sending={sending}
              queue={selectedQueue}
              reloading={selectedKey ? reloadingKeys.has(selectedKey) : false}
              bypass={bypass}
              pinnedMessageIds={pinnedMessageIds}
              sessionNotes={selectedKey ? settings.sessionNotes[selectedKey] ?? [] : []}
              savedComposerDrafts={settings.composerDrafts}
              composerDraftsHydrated={settingsLoaded}
              onComposerDraftsChange={handleComposerDraftsChange}
              onTogglePin={handleTogglePin}
              onSessionNotesChange={handleSessionNotes}
              onDeleteNote={handleDeleteSessionNote}
              onBypassChange={(enabled) => {
                if (selected) void setYolo(selected, enabled, selectedSession?.directory);
              }}
              onNewSessionInstanceChange={setNewSessionInstanceId}
              onCreateSession={handleCreateSession}
              onCancelNewSession={() => setNewSessionInstanceId(null)}
              onSend={handleSend}
              onQueue={queue.queueMessage}
              onSendQueued={queue.sendQueuedMessage}
              onQueuedModelChange={queue.changeQueuedModel}
              onMoveQueued={queue.moveQueued}
              onRemoveQueued={queue.removeQueued}
              onReload={() => {
                if (selectedSession) void handleReloadSession(selectedSession);
              }}
              onAbort={() => void handleAbort()}
              onPermission={handlePermission}
              onQuestion={handleQuestion}
            />
          </div>

          <React.Suspense fallback={null}>
            <CommandPalette
              open={commandPaletteOpen}
              sessions={allSessions}
              states={states}
              instances={instances}
              sessionNotes={settings.sessionNotes}
              onOpenChange={setCommandPaletteOpen}
              onSelectSession={(session) => {
                setNewSessionInstanceId(null);
                setSelected({ instanceId: session.instanceId, sessionId: session.id });
                setMobileRailOpen(false);
              }}
              onNewAgent={(instanceId) => {
                beginNewAgent(instanceId);
                setMobileRailOpen(false);
              }}
            />
          </React.Suspense>

          {settingsActivated ? (
            <React.Suspense fallback={<DialogFallback label="Loading settings…" />}>
              <SettingsPanel
                open={settingsOpen}
                view={settingsView}
                settings={settings}
                instances={instances}
                projectsByInstance={projectsByInstance}
                modelsByInstance={modelsByInstance}
                onChange={handleSettings}
                onOpenChange={setSettingsOpen}
              />
            </React.Suspense>
          ) : null}

          {avatarPickerSession ? (
            <React.Suspense fallback={<DialogFallback label="Loading appearance…" />}>
              <AvatarPicker
                open
                title={avatarPickerSession.title ?? avatarPickerSession.id}
                style={settings.blobStyle}
                identity={avatarPickerIdentity}
                scopes={avatarPickerScopes}
                overrides={settings.avatarOverrides}
                onSave={handleAvatarOverride}
                onOpenChange={(open) => {
                  if (!open) setAvatarPickerSession(null);
                }}
              />
            </React.Suspense>
          ) : null}

          {actionError || actionNotice ? (
            <div className="fixed top-[calc(3.5rem+env(safe-area-inset-top))] right-3 left-3 z-[100] flex max-w-[420px] flex-col gap-2 sm:top-auto sm:right-3 sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:left-auto">
              {actionError ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-popover px-3 py-2.5 text-[12px] shadow-lg"
                >
                  <span className="min-w-0 flex-1">{actionError}</span>
                  {actionErrorRetry ? (
                    <button
                      type="button"
                      className="rounded font-medium text-highlight hover:underline focus-visible:outline-2"
                      onClick={() => actionErrorRetry()}
                      aria-label="Retry failed action"
                    >
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
                    onClick={() => {
                      void copyText(actionError).then((copied) => setErrorCopied(copied));
                    }}
                    aria-label="Copy error message"
                  >
                    {errorCopied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
                    onClick={() => showActionError(null)}
                    aria-label="Dismiss error"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {actionNotice ? (
                <div
                  role="status"
                  aria-live="polite"
                  onFocusCapture={() => setNoticePaused(true)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setNoticePaused(false);
                    }
                  }}
                  onPointerEnter={() => setNoticePaused(true)}
                  onPointerLeave={() => setNoticePaused(false)}
                  className="flex items-start gap-3 rounded-lg border border-highlight/35 bg-popover px-3 py-2.5 text-[12px] shadow-lg"
                >
                  <span className="min-w-0 flex-1">{actionNotice.message}</span>
                  {actionNotice.actionLabel && actionNotice.action ? (
                    <button
                      type="button"
                      className="rounded font-medium text-highlight hover:underline focus-visible:outline-2"
                      onClick={() => {
                        const action = actionNotice.action;
                        setActionNotice(null);
                        action?.();
                      }}
                    >
                      {actionNotice.actionLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
                    onClick={() => setActionNotice(null)}
                    aria-label="Dismiss message"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
