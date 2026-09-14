import * as React from 'react';
import { MotionConfig } from 'motion/react';
import InstanceBar from './components/InstanceBar';
import LeftRail from './components/LeftRail';
import ChatView from './components/ChatView';
import ColumnTabStrip, { type WorkspaceTab } from './components/ColumnTabStrip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { applyTheme } from './themes';
import {
  allocateProjectColors,
  avatarColorKeys,
  projectForSession,
  projectIdentityKey,
  resolveAvatarIdentity,
  seedIdentity,
  sessionAvatarKey,
} from './blob/seed';
import { moodFrom } from './blob/mood';
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
  loadMessageTail,
  loadPermissions,
  loadQuestions,
  loadSessionStates,
  loadModels,
  loadScheduledIdentityData,
  mergePolledSessions,
  rejectQuestion,
  replyPermission,
  replyQuestion,
  runScheduledTask,
  sendPrompt,
  setAutoAccept,
  setSessionArchived,
  updateScheduledTaskModel,
  compactSession,
  forkSession,
  HANDOFF_PROMPT,
  type AutoAcceptPolicy,
  type ModelList,
  type PromptInput,
  type ScheduledTask,
} from './api';
import { useStableCallback } from '@/lib/useStableCallback';
import { copyText } from '@/lib/clipboard';
import { summarizeMessages, type SessionMessageSummary } from '@/lib/messageSummary';
import {
  reconcileFullTranscript,
  reconcileTranscriptTail,
} from '@/lib/transcriptReconciliation';
import { useEmberSettings } from './hooks/useEmberSettings';
import { useFeedback } from './hooks/useFeedback';
import { mergePolledQueues, useMessageQueue, type QueueTarget } from './hooks/useMessageQueue';
import { usePoll } from './hooks/usePoll';
import { newSessionDirectoryPrefill, newSessionModelPrefill } from './lib/newSessionDefaults';
import { notesKeyForSession } from './lib/projectGroups';
import { InvalidationQueue, invalidationsFor, parseEmberEvent, type Invalidation } from '@/lib/invalidation';
import {
  MAX_OPEN_SESSIONS,
  MIN_COLUMN_WIDTH,
  numberShortcutSlot,
  parseSessionKey,
  pruneWorkspace,
  sameWorkspace,
  visibleColumns,
  type Workspace,
} from './lib/workspace';
import { DEFAULT_MODEL, modelRefKey, SESSION_WINDOWS, sessionKey } from './types';
import type {
  AvatarIdentity,
  AvatarOverride,
  BallMood,
  BallState,
  ChatMessage,
  MessagesStatus,
  MessageQueueSession,
  Instance,
  ModelRef,
  PermissionReply,
  PermissionRequest,
  Project,
  QuestionAnswers,
  QuestionRequest,
  Session,
  SessionRef,
  StoredComposerDraft,
  NewSessionOptions,
} from './types';

const SettingsPanel = React.lazy(() => import('./components/SettingsPanel'));
const ViewOptionsDialog = React.lazy(() => import('./components/ViewOptionsDialog'));
const AvatarPicker = React.lazy(() => import('./components/AvatarPicker'));
const CommandPalette = React.lazy(() => import('./components/CommandPalette'));
const ArchiveDialog = React.lazy(() => import('./components/ArchiveDialog'));
const ModelPicker = React.lazy(() => import('./components/ModelPicker'));

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
// Progressive tails for rail previews, largest last: stop as soon as a preview is found.
const PREVIEW_LIMITS = [8, 32, 128] as const;
// Transcripts kept warm for instant switching. Preview warming writes summaries only, never the
// message cache, so this covers the visible columns plus a little slack for quick switches.
const MESSAGE_CACHE_LIMIT = MAX_OPEN_SESSIONS + 4;
const RECENT_MODEL_COUNT = 5;
const CREATED_SESSION_GRACE_MS = 2 * 60_000;
// Stable empty set for the draft/empty pane, so Transcript's memo isn't defeated each render.
const NO_PINS = new Set<string>();

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

const sameSummary = (a: SessionMessageSummary, b: SessionMessageSummary): boolean =>
  a.preview === b.preview && a.failed === b.failed && a.thinking === b.thinking && a.version === b.version;

const composerDraftSignature = (drafts: Record<string, StoredComposerDraft>): string =>
  JSON.stringify(
    Object.keys(drafts).sort().map((key) => {
      const draft = drafts[key];
      return [key, draft.text, draft.modelId ?? '', draft.variant ?? ''];
    })
  );

const responseError = (data: unknown, fallback: string, source?: string): string => {
  const detail = errorMessageOf(data);
  const message = detail ?? fallback;
  // Middle-process errors already say "Ember → …"; don't double-label those.
  const origin = data && typeof data === 'object' ? (data as Record<string, unknown>).source : undefined;
  return source && origin !== 'ember' ? `${source}: ${message}` : message;
};

const messagePinKey = (session: SessionRef, messageId: string): string =>
  `${sessionKey(session)}::${messageId}`;

let noteSequence = 0;
const createNoteId = (): string =>
  `note-${Date.now().toString(36)}-${(noteSequence = (noteSequence + 1) % 0xffff).toString(36)}`;

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
  const [summaries, setSummaries] = React.useState<Record<string, SessionMessageSummary>>({});
  // Last `session.updated` the user has seen per session, for the unread mood. In-memory: a fresh
  // launch seeds every session as read so the rail doesn't open fully "unread".
  const [lastReadAt, setLastReadAt] = React.useState<Record<string, number>>({});
  const [openSessions, setOpenSessions] = React.useState<string[]>([]);
  const [activeSession, setActiveSession] = React.useState<string | null>(null);
  const [minimizedSessions, setMinimizedSessions] = React.useState<Set<string>>(() => new Set());
  const [newSessionInstanceId, setNewSessionInstanceId] = React.useState<string | null>(null);
  const [newSessionDirectory, setNewSessionDirectory] = React.useState<string | null>(null);
  const [transcripts, setTranscripts] = React.useState<
    Record<string, { messages: ChatMessage[]; status: MessagesStatus }>
  >({});
  const [modelsByInstance, setModelsByInstance] = React.useState<Record<string, ModelList>>({});
  const [scheduledTaskNames, setScheduledTaskNames] = React.useState<Record<string, string>>({});
  const [scheduledTasksByKey, setScheduledTasksByKey] = React.useState<Record<string, ScheduledTask>>({});
  const [runningScheduledKeys, setRunningScheduledKeys] = React.useState<Set<string>>(() => new Set());
  const [scheduledModelTarget, setScheduledModelTarget] = React.useState<ScheduledTask | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [instancesLoaded, setInstancesLoaded] = React.useState(false);
  // Width of the column area, measured with a ResizeObserver; how many columns fit depends on it.
  const [workspaceWidth, setWorkspaceWidth] = React.useState(0);
  const [sendingKeys, setSendingKeys] = React.useState<Set<string>>(() => new Set());
  const [reloadingKeys, setReloadingKeys] = React.useState<Set<string>>(() => new Set());
  const [archivingKeys, setArchivingKeys] = React.useState<Set<string>>(() => new Set());
  const [compactingKeys, setCompactingKeys] = React.useState<Set<string>>(() => new Set());
  const [handoffKeys, setHandoffKeys] = React.useState<Set<string>>(() => new Set());
  // Local fallback for instances whose OpenChamber predates server-side auto-accept.
  const [bypassOverrides, setBypassOverrides] = React.useState<Record<string, boolean>>({});
  const [autoAcceptByInstance, setAutoAcceptByInstance] = React.useState<Record<string, AutoAcceptPolicy>>({});
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [viewOptionsOpen, setViewOptionsOpen] = React.useState(false);
  const [viewOptionsActivated, setViewOptionsActivated] = React.useState(false);
  const [settingsActivated, setSettingsActivated] = React.useState(false);
  const [avatarPickerSession, setAvatarPickerSession] = React.useState<Session | null>(null);
  const [settingsView, setSettingsView] = React.useState<'general' | 'instances'>('general');
  const [archiveOpen, setArchiveOpen] = React.useState(false);
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
  const activeKeyRef = React.useRef<string | null>(null);
  const openSessionsRef = React.useRef<string[]>([]);
  const minimizedKeysRef = React.useRef<Set<string>>(new Set());
  // Per-project workspace memory: leaving a project saves its columns/tabs/active so returning
  // restores the exact layout instead of re-opening every session.
  const projectLayoutsRef = React.useRef<Map<string, Workspace>>(new Map());
  const workspaceHydratedRef = React.useRef(false);
  const workspaceRef = React.useRef<HTMLDivElement | null>(null);
  const sessionsByInstanceRef = React.useRef<Record<string, Session[]>>({});
  const projectsByInstanceRef = React.useRef<Record<string, Project[]>>({});
  // Directories named by prompt events (question/permission). OpenCode scopes prompts by directory,
  // and the event's directory is authoritative, so keep asking for it even when it isn't the
  // session folder we already know.
  const promptDirectoriesRef = React.useRef<Record<string, string[]>>({});
  const pendingCreatedSessions = React.useRef(new Map<string, { session: Session; expiresAt: number }>());
  // Snapshot the entries first: deleting from a Map while `forEach`-ing it can skip entries.
  const prunePendingCreated = (shouldDrop: (pending: { session: Session; expiresAt: number }) => boolean) => {
    [...pendingCreatedSessions.current.entries()].forEach(([key, pending]) => {
      if (shouldDrop(pending)) pendingCreatedSessions.current.delete(key);
    });
  };
  // Pending optimistic sends, scoped per session so one column's fetch can never release another's.
  const pendingOptimisticIds = React.useRef(new Map<string, Set<string>>());
  const pendingFor = (key: string): Set<string> => {
    let ids = pendingOptimisticIds.current.get(key);
    if (!ids) {
      ids = new Set();
      pendingOptimisticIds.current.set(key, ids);
    }
    return ids;
  };
  const releaseOptimistic = (key: string, ids: readonly string[]) => {
    if (ids.length === 0) return;
    const pending = pendingOptimisticIds.current.get(key);
    if (!pending) return;
    ids.forEach((id) => pending.delete(id));
    if (pending.size === 0) pendingOptimisticIds.current.delete(key);
  };
  const bypassReplyIds = React.useRef(new Set<string>());
  const messageCacheRef = React.useRef(new Map<string, ChatMessage[]>());
  // A rendered transcript can outlive its LRU cache entry; read it through a ref so a tail still
  // merges against what is on screen rather than treating the column as empty.
  const transcriptsRef = React.useRef(transcripts);
  transcriptsRef.current = transcripts;
  const summariesRef = React.useRef<Record<string, SessionMessageSummary>>(summaries);
  summariesRef.current = summaries;
  // One deduplicated full repair per session when a tail has no safe overlap to merge.
  const fullRepairRef = React.useRef<(key: string) => void>(() => {});
  const fullRepairInFlight = React.useRef(new Set<string>());
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
  };

  const setTranscriptFor = (
    key: string,
    messagesForSession: ChatMessage[],
    status: MessagesStatus = 'ready'
  ) => {
    setTranscripts((prev) => {
      const current = prev[key];
      if (current && current.messages === messagesForSession && current.status === status) return prev;
      return { ...prev, [key]: { messages: messagesForSession, status } };
    });
  };

  const commitSummary = React.useCallback(
    (key: string, messagesForSession: ChatMessage[], complete: boolean, version?: number) => {
      const summary = summarizeMessages(messagesForSession, {
        previous: summariesRef.current[key],
        complete,
        version,
      });
      setSummaries((prev) => {
        const existing = prev[key];
        if (existing && sameSummary(existing, summary)) return prev;
        return { ...prev, [key]: summary };
      });
    },
    []
  );

  const requestFullRepair = React.useCallback((key: string) => {
    if (fullRepairInFlight.current.has(key)) return;
    fullRepairInFlight.current.add(key);
    fullRepairRef.current(key);
  }, []);

  /**
   * The single transcript commit path. Every fetched full or tail response goes through here so
   * structural sharing, optimistic reconciliation, the message cache and the compact summary stay
   * in lockstep no matter which caller issued the fetch.
   */
  const commitFetchedTranscript = useStableCallback(
    (key: string, fetched: ChatMessage[], mode: 'full' | 'tail', version?: number) => {
      const current =
        messageCacheRef.current.get(key) ?? transcriptsRef.current[key]?.messages ?? [];
      const pending = pendingOptimisticIds.current.get(key) ?? new Set<string>();
      const outcome =
        mode === 'tail'
          ? reconcileTranscriptTail(current, fetched, pending)
          : reconcileFullTranscript(current, fetched, pending);
      if (outcome.reconciledOptimisticIds.length > 0) {
        releaseOptimistic(key, outcome.reconciledOptimisticIds);
      }
      cacheMessages(key, outcome.messages);
      setTranscriptFor(key, outcome.messages, 'ready');
      commitSummary(key, outcome.messages, mode === 'full', version);
      if (outcome.needsFullFetch) requestFullRepair(key);
    }
  );

  const updateCachedMessages = (
    key: string,
    updater: (messagesForSession: ChatMessage[]) => ChatMessage[]
  ) => {
    const next = updater(
      messageCacheRef.current.get(key) ?? transcriptsRef.current[key]?.messages ?? []
    );
    cacheMessages(key, next);
    setTranscriptFor(key, next, 'ready');
  };

  const readyIds = React.useMemo(
    () => instances.filter((instance) => instance.attachable).map((instance) => instance.id),
    [instances]
  );
  // Stable key so effects re-run only when the set of connected instances changes.
  const readyKey = readyIds.join('\u0000');

  // The rail lists active sessions only; archived sessions live behind the top-bar archive
  // screen. The recency window still trims the active list. Date.now() is read inside the memo,
  // so the cut-off refreshes with every session poll rather than needing a timer.
  const { sessionWindowHours } = settings;
  const sessions = React.useMemo(() => {
    const cutoff = sessionWindowHours > 0 ? Date.now() - sessionWindowHours * 3_600_000 : 0;
    return Object.entries(sessionsByInstance)
      .filter(([instanceId]) => readyIds.includes(instanceId) && (showScheduled || !hidden.has(instanceId)))
      .flatMap(([, list]) => list)
      .filter((session) => {
        if (showScheduled) return Boolean(settings.scheduledSessionBindings[sessionKey(session)]);
        return !session.archived && (!cutoff || (session.updated ?? 0) >= cutoff);
      });
  }, [sessionsByInstance, readyIds, hidden, showScheduled, sessionWindowHours, settings.scheduledSessionBindings]);

  /** Session key → the scheduled task its latest run belongs to, when Ember has both. */
  const scheduledTaskBySession = React.useMemo(() => {
    const map: Record<string, ScheduledTask> = {};
    for (const [key, taskKey] of Object.entries(settings.scheduledSessionBindings)) {
      const task = scheduledTasksByKey[taskKey];
      if (task) map[key] = task;
    }
    return map;
  }, [settings.scheduledSessionBindings, scheduledTasksByKey]);

  const archivedSessions = React.useMemo(
    () =>
      Object.entries(sessionsByInstance)
        .filter(([instanceId]) => readyIds.includes(instanceId))
        .flatMap(([, list]) => list)
        .filter((session) => Boolean(session.archived)),
    [readyIds, sessionsByInstance]
  );

  // Active + archived, ignoring the recency window, for the rail's broadened search.
  const everySession = React.useMemo(
    () =>
      Object.entries(sessionsByInstance)
        .filter(([instanceId]) => readyIds.includes(instanceId) && !hidden.has(instanceId))
        .flatMap(([, list]) => list),
    [readyIds, sessionsByInstance, hidden]
  );

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
    Object.entries(summaries).forEach(([key, summary]) => {
      if (summary.failed && (merged[key] ?? 'idle') === 'idle') merged[key] = 'error';
    });
    [...permissions, ...questions].forEach((request) => {
      merged[sessionKey({ instanceId: request.instanceId, sessionId: request.sessionId })] = 'needs-input';
    });
    return merged;
  }, [statesByInstance, permissions, questions, summaries]);

  // Which kind of pending prompt a session has, so the blob can show a lock vs a question.
  const promptKinds = React.useMemo(() => {
    const kinds: Record<string, 'input' | 'question'> = {};
    permissions.forEach((request) => {
      kinds[sessionKey({ instanceId: request.instanceId, sessionId: request.sessionId })] = 'input';
    });
    questions.forEach((request) => {
      kinds[sessionKey({ instanceId: request.instanceId, sessionId: request.sessionId })] = 'question';
    });
    return kinds;
  }, [permissions, questions]);

  const selected = React.useMemo(() => parseSessionKey(activeSession), [activeSession]);
  const selectedKey = activeSession;
  // Rail previews are derived from the compact summaries, which survive transcript-cache eviction.
  const previews = React.useMemo(
    () => Object.fromEntries(Object.entries(summaries).map(([key, summary]) => [key, summary.preview])),
    [summaries]
  );
  // Thinking = an active session whose latest assistant turn is streaming with no tool running.
  // Summaries carry this even for sessions whose full transcript was never cached.
  const thinkingKeys = React.useMemo(() => {
    const keys = new Set<string>();
    Object.entries(summaries).forEach(([key, summary]) => {
      if (summary.thinking && (states[key] ?? 'idle') === 'active') keys.add(key);
    });
    return keys;
  }, [states, summaries]);
  // Seed newly-seen sessions as read, so a fresh launch doesn't flag the whole rail as unread.
  React.useEffect(() => {
    setLastReadAt((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.values(sessionsByInstance)
        .flat()
        .forEach((session) => {
          const key = sessionKey(session);
          if (next[key] === undefined) {
            next[key] = session.updated ?? 0;
            changed = true;
          }
        });
      return changed ? next : prev;
    });
  }, [sessionsByInstance]);

  // A finished turn on a session that isn't the active column is unread; busy/error/needs-input
  // moods take priority over it.
  const unreadKeys = React.useMemo(() => {
    const keys = new Set<string>();
    Object.entries(sessionsByInstance).forEach(([, list]) =>
      list.forEach((session) => {
        if (session.archived) return;
        const key = sessionKey(session);
        if ((states[key] ?? 'idle') !== 'idle') return;
        const updated = session.updated ?? 0;
        if (updated > (lastReadAt[key] ?? updated)) keys.add(key);
      })
    );
    return keys;
  }, [sessionsByInstance, states, lastReadAt]);

  const moods = React.useMemo(() => {
    const map: Record<string, BallMood> = {};
    Object.entries(sessionsByInstance).forEach(([, list]) =>
      list.forEach((session) => {
        const key = sessionKey(session);
        map[key] = moodFrom(
          states[key] ?? 'idle',
          promptKinds[key],
          thinkingKeys.has(key),
          unreadKeys.has(key)
        );
      })
    );
    return map;
  }, [sessionsByInstance, states, promptKinds, thinkingKeys, unreadKeys]);
  // A retry belongs to the session it failed on; the banner text may still apply.
  React.useEffect(() => {
    clearActionErrorRetry();
  }, [selectedKey, clearActionErrorRetry]);
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
  // The active column counts as read: viewing it (or a response landing while it's active) clears
  // the unread mood.
  React.useEffect(() => {
    if (!selectedKey) return;
    const updated = selectedSession?.updated ?? 0;
    setLastReadAt((prev) =>
      (prev[selectedKey] ?? 0) >= updated ? prev : { ...prev, [selectedKey]: updated }
    );
  }, [selectedKey, selectedSession]);
  const selectedInstance = selected
    ? instances.find((instance) => instance.id === selected.instanceId) ?? null
    : null;
  const selectedQueue = selected
    ? (queuesByInstance[selected.instanceId] ?? []).find((queue) => queue.sessionId === selected.sessionId) ?? null
    : null;
  // Configured projects plus the sessions currently on screen (and the selected one, which the rail
  // pins even when filtered), so directory-only "projects" draw from the same queue without the
  // persisted map growing forever. Collapsed to a stable signature so session polls (fresh objects
  // every few seconds) don't re-run allocation or re-derive every avatar.
  const avatarColorKeySignature = React.useMemo(() => {
    const relevant =
      selectedSession && !sessions.some((session) => sessionKey(session) === sessionKey(selectedSession))
        ? [...sessions, selectedSession]
        : sessions;
    return avatarColorKeys(projectsByInstance, relevant).join('\u0000');
  }, [projectsByInstance, sessions, selectedSession]);
  const allocatedProjectColors = React.useMemo(
    () =>
      allocateProjectColors(
        avatarColorKeySignature ? avatarColorKeySignature.split('\u0000') : [],
        settings.projectColorAssignments
      ),
    [avatarColorKeySignature, settings.projectColorAssignments]
  );
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
  // The blob a new-agent draft will get: resolve it from the folder being used, so the draft shows
  // the destination project's colour (and its override) rather than a generic placeholder.
  const resolveDraftIdentity = React.useCallback(
    (instanceId: string, directory: string): AvatarIdentity =>
      resolveAvatarIdentity(
        { id: `draft:${instanceId}`, instanceId, directory },
        projectsByInstance[instanceId] ?? [],
        settings.scheduledSessionBindings,
        settings.avatarOverrides,
        allocatedProjectColors
      ),
    [projectsByInstance, settings.scheduledSessionBindings, settings.avatarOverrides, allocatedProjectColors]
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
  // Appearance belongs to the project/folder, so that scope comes first and is the picker's
  // default; the scheduled-task and single-session scopes stay available underneath it.
  const avatarPickerFolderName = avatarPickerSession?.directory
    ? avatarPickerSession.directory.split(/[\\/]/).filter(Boolean).pop() ?? avatarPickerSession.directory
    : null;
  const avatarPickerScopes = avatarPickerSession
    ? [
        ...(avatarPickerIdentity.projectKey
          ? [{
              key: avatarPickerIdentity.projectKey,
              kind: 'project' as const,
              label: avatarPickerProject ? `Project: ${avatarPickerProject.name}` : `Folder: ${avatarPickerFolderName}`,
            }]
          : []),
        ...(avatarPickerIdentity.taskKey
          ? [{
              key: avatarPickerIdentity.taskKey,
              kind: 'task' as const,
              label: `Scheduled task: ${scheduledTaskNames[avatarPickerIdentity.taskKey] ?? 'this task'}`,
            }]
          : []),
        { key: sessionAvatarKey(avatarPickerSession), kind: 'session' as const, label: 'This session' },
      ]
    : [];
  const pinnedMessageIdsFor = (ref: SessionRef): Set<string> => {
    const prefix = `${sessionKey(ref)}::`;
    return new Set(
      settings.pinnedMessages
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
    );
  };

  // Sync the ref every render so the poller always sees the current directory.
  selectedSessionRef.current = selectedSession;
  activeKeyRef.current = selectedKey;
  openSessionsRef.current = openSessions;
  minimizedKeysRef.current = minimizedSessions;
  sessionsByInstanceRef.current = sessionsByInstance;
  projectsByInstanceRef.current = projectsByInstance;
  scheduledBindingsRef.current = settings.scheduledSessionBindings;

  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // The Dock icon mirrors the selected session's blob (and its mood) so a glance at the Dock
  // says which agent this window is on. Theme is a dependency because the tile and the
  // contrast-adjusted palettes come from the current CSS variables.
  const selectedState: BallState = selectedKey ? states[selectedKey] ?? 'idle' : 'idle';
  const selectedMood: BallMood = selectedKey ? moods[selectedKey] ?? 'idle' : 'idle';
  React.useEffect(() => {
    if (!selectedKey) return;
    let cancelled = false;
    void import('./blob/dockIcon')
      .then(({ renderDockIcon }) =>
        renderDockIcon(settings.blobStyle, selectedIdentity, selectedMood)
      )
      .then((dataUrl) => {
        if (!cancelled) return window.ember.setDockIcon(dataUrl);
      })
      .catch((err) => console.warn('Dock icon render failed', err));
    return () => {
      cancelled = true;
    };
  }, [selectedKey, selectedIdentity, selectedMood, settings.blobStyle, settings.theme]);

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
        setInstancesLoaded(true);
        // Restore the workspace before the persistence effect can fire, so the first open
        // session list isn't overwritten with the empty defaults.
        setOpenSessions(stored.openSessions ?? []);
        setActiveSession(stored.activeSession ?? null);
        setMinimizedSessions(new Set(stored.minimizedSessions ?? []));
        workspaceHydratedRef.current = true;
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

  // ---- Workspace: open columns, the active one, and sticky minimized sessions. ----
  // The helpers below are the only writers of workspace state; `activeSession` is the single
  // source of truth for `selected`, so existing selection-driven code keeps working unchanged.

  /** The project identity the current open group belongs to, or a standalone bucket. */
  const currentContextKey = React.useCallback((): string | null => {
    const first = openSessionsRef.current[0];
    if (!first) return null;
    const ref = parseSessionKey(first);
    if (!ref) return null;
    const session = (sessionsByInstanceRef.current[ref.instanceId] ?? []).find((s) => s.id === ref.sessionId);
    const project = session
      ? projectForSession(session, projectsByInstanceRef.current[ref.instanceId] ?? [])
      : null;
    return project ? projectIdentityKey(ref.instanceId, project.id) : `standalone:${ref.instanceId}`;
  }, []);
  /** Remember the current workspace under its project before switching away. */
  const saveCurrentLayout = React.useCallback(() => {
    const contextKey = currentContextKey();
    if (!contextKey) return;
    projectLayoutsRef.current.set(contextKey, {
      open: [...openSessionsRef.current],
      active: activeKeyRef.current,
      minimized: [...minimizedKeysRef.current],
    });
  }, [currentContextKey]);

  /**
   * Open a session. Sessions from the same configured project stay together as one group;
   * opening anything outside the current project starts a fresh workspace (Ember doesn't mix
   * two projects' columns by default). `known` lets callers supply the session before the
   * session list has caught up (a just-created or restored session).
   */
  const openSession = React.useCallback((ref: SessionRef, known?: Session | null) => {
    const key = sessionKey(ref);
    const session =
      known ?? (sessionsByInstanceRef.current[ref.instanceId] ?? []).find((entry) => entry.id === ref.sessionId) ?? null;
    const project = session
      ? projectForSession(session, projectsByInstanceRef.current[ref.instanceId] ?? [])
      : null;
    const current = openSessionsRef.current;
    const sameGroup =
      current.length > 0 &&
      project !== null &&
      current.every((entry) => {
        const currentRef = parseSessionKey(entry);
        if (!currentRef || currentRef.instanceId !== ref.instanceId) return false;
        const currentSession = (sessionsByInstanceRef.current[currentRef.instanceId] ?? []).find(
          (candidate) => candidate.id === currentRef.sessionId
        );
        if (!currentSession) return false;
        const currentProject = projectForSession(
          currentSession,
          projectsByInstanceRef.current[currentRef.instanceId] ?? []
        );
        return currentProject?.id === project.id;
      });

    if (sameGroup) {
      setOpenSessions((prev) => {
        if (prev.includes(key)) return prev;
        const next = [...prev, key];
        return next.length > MAX_OPEN_SESSIONS ? next.slice(next.length - MAX_OPEN_SESSIONS) : next;
      });
    } else {
      // Switching to another project: stash the current layout so returning restores it.
      saveCurrentLayout();
      setOpenSessions([key]);
    }
    setMinimizedSessions((prev) => {
      const base = sameGroup ? prev : new Set([...prev].filter((entry) => entry === key));
      if (!base.has(key)) return base;
      const next = new Set(base);
      next.delete(key);
      return next;
    });
    setActiveSession(key);
    setNewSessionInstanceId(null);
    setNewSessionDirectory(null);
  }, [saveCurrentLayout]);

  /**
   * Open a project. `projectSessions` is exactly what the project's card showed, so opening it
   * never pulls in out-of-window or archived sessions that share the directory. If it was open
   * before, restore the exact columns/tabs/active it had; otherwise open the most recent sessions.
   * An empty set opens a draft instead.
   */
  const openProject = React.useCallback((instanceId: string, project: Project, projectSessions: Session[]) => {
    showActionError(null);
    const owned = projectSessions.filter((session) => !session.archived && !session.parentId);
    const validKeys = new Set(owned.map(sessionKey));
    const projectKey = projectIdentityKey(instanceId, project.id);
    saveCurrentLayout();
    if (owned.length === 0) {
      projectLayoutsRef.current.delete(projectKey);
      setActiveSession(null);
      setNewSessionInstanceId(instanceId);
      setNewSessionDirectory(project.path ?? null);
      return;
    }
    // Restore exactly what this project looked like when it was last open.
    const saved = projectLayoutsRef.current.get(projectKey);
    if (saved) {
      const open = saved.open.filter((key) => validKeys.has(key)).slice(0, MAX_OPEN_SESSIONS);
      if (open.length > 0) {
        const minimized = new Set(saved.minimized.filter((key) => open.includes(key)));
        setOpenSessions(open);
        setMinimizedSessions(minimized);
        setActiveSession(
          saved.active && open.includes(saved.active) && !minimized.has(saved.active)
            ? saved.active
            : open.find((key) => !minimized.has(key)) ?? open[0]
        );
        setNewSessionInstanceId(null);
        setNewSessionDirectory(null);
        return;
      }
    }
    const keys = [...owned]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .map(sessionKey)
      .slice(0, MAX_OPEN_SESSIONS);
    setOpenSessions(keys);
    // Keep sticky minimized flags only for sessions still in this group.
    setMinimizedSessions((prev) => new Set([...prev].filter((entry) => keys.includes(entry))));
    setActiveSession(keys[0] ?? null);
    setNewSessionInstanceId(null);
    setNewSessionDirectory(null);
  }, [showActionError, saveCurrentLayout]);

  const activateSession = React.useCallback((key: string) => {
    setActiveSession(key);
    // Leaving the new-agent draft for an existing session discards the draft pane.
    setNewSessionInstanceId(null);
    setNewSessionDirectory(null);
    setMinimizedSessions((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const minimizeSession = React.useCallback((key: string) => {
    setMinimizedSessions((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    setActiveSession((current) => {
      if (current !== key) return current;
      // Hand the active slot to the next still-visible session (if any).
      return (
        openSessionsRef.current.find(
          (entry) => entry !== key && !minimizedKeysRef.current.has(entry)
        ) ?? null
      );
    });
  }, []);

  const restoreSession = React.useCallback((key: string) => {
    setMinimizedSessions((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setActiveSession(key);
  }, []);

  const closeSession = React.useCallback((key: string) => {
    const remaining = openSessionsRef.current.filter((entry) => entry !== key);
    setOpenSessions(remaining);
    setMinimizedSessions((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setActiveSession((current) => {
      if (current !== key) return current;
      return remaining.find((entry) => !minimizedKeysRef.current.has(entry)) ?? remaining[0] ?? null;
    });
  }, []);

  // Measure the column area so the number of side-by-side columns matches the available width.
  React.useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const update = () => setWorkspaceWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Open sessions that fit as columns, active first when it would otherwise overflow. The rest
  // stay open as numbered tabs in the strip.
  const columns = React.useMemo(() => {
    const base = visibleColumns(openSessions, minimizedSessions, workspaceWidth, MIN_COLUMN_WIDTH);
    if (
      activeSession &&
      openSessions.includes(activeSession) &&
      !minimizedSessions.has(activeSession) &&
      !base.includes(activeSession)
    ) {
      return [...base.slice(0, Math.max(0, base.length - 1)), activeSession];
    }
    return base;
  }, [openSessions, minimizedSessions, workspaceWidth, activeSession]);
  const columnsRef = React.useRef<string[]>([]);
  columnsRef.current = columns;
  const columnKeySet = React.useMemo(() => new Set(columns), [columns]);

  // Cmd/Ctrl+1–9 jumps to that slot in the open list (columns and tabs share the numbering).
  // `activateSession` also clears the sticky minimized flag, so a tab restores on jump.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const slot = numberShortcutSlot(event);
      if (slot === null) return;
      const key = openSessionsRef.current[slot];
      if (!key) return;
      event.preventDefault();
      activateSession(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activateSession]);


  // Persist the workspace after the initial restore. The guarded ref keeps the first render
  // (empty defaults) from clobbering what main just handed back.
  React.useEffect(() => {
    if (!workspaceHydratedRef.current) return;
    handleSettings({
      openSessions,
      activeSession,
      minimizedSessions: [...minimizedSessions],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSettings is recreated per render; only the workspace values should retrigger
  }, [openSessions, activeSession, minimizedSessions]);

  // Drop persisted keys once the instance/session it names is gone, archived, or a subagent.
  // A missing session list means "not loaded yet", so those keys survive startup.
  React.useEffect(() => {
    if (!workspaceHydratedRef.current) return;
    const check = (ref: SessionRef): boolean | undefined => {
      if (instancesLoaded && !instances.some((instance) => instance.id === ref.instanceId)) return false;
      const list = sessionsByInstance[ref.instanceId];
      if (!list) return undefined;
      const session = list.find((entry) => entry.id === ref.sessionId);
      if (!session) return false;
      return !session.archived && !session.parentId;
    };
    const current: Workspace = {
      open: openSessions,
      active: activeSession,
      minimized: [...minimizedSessions],
    };
    const next = pruneWorkspace(current, check);
    if (sameWorkspace(next, current)) return;
    setOpenSessions(next.open);
    setActiveSession(next.active);
    setMinimizedSessions(new Set(next.minimized));
  }, [sessionsByInstance, instances, instancesLoaded, openSessions, activeSession, minimizedSessions]);

  // Notes used to be stored per session. Move a project session's old notes onto the shared
  // project key once that session is known. Idempotent: after the move there's nothing to find.
  React.useEffect(() => {
    if (!settingsLoaded) return;
    const current = settingsRef.current.sessionNotes;
    const next: typeof current = { ...current };
    let changed = false;
    Object.entries(current).forEach(([key, notes]) => {
      const ref = parseSessionKey(key);
      if (!ref) return;
      const session = (sessionsByInstance[ref.instanceId] ?? []).find(
        (entry) => entry.id === ref.sessionId
      );
      if (!session) return;
      const project = projectForSession(session, projectsByInstance[session.instanceId] ?? []);
      if (!project) return;
      const projectKey = projectIdentityKey(session.instanceId, project.id);
      if (projectKey === key) return;
      next[projectKey] = [...(next[projectKey] ?? []), ...notes].slice(-100);
      delete next[key];
      changed = true;
    });
    if (changed) handleSettings({ sessionNotes: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idempotent; sessions/projects loading is what retriggers it
  }, [settingsLoaded, sessionsByInstance, projectsByInstance]);

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
    const add = (instanceId: string | undefined, directory: string | undefined) => {
      if (!instanceId || !directory || !instanceIds.includes(instanceId)) return;
      const list = hints[instanceId] ?? (hints[instanceId] = []);
      if (!list.includes(directory)) list.push(directory);
    };
    // Every open session (columns and tabs), not just the active one: OpenCode scopes prompts by
    // directory, so a question in a background column must still be listed for its card to appear.
    add(selectedSessionRef.current?.instanceId, selectedSessionRef.current?.directory);
    openSessionsRef.current.forEach((key) => {
      const ref = parseSessionKey(key);
      if (!ref) return;
      const session = (sessionsByInstanceRef.current[ref.instanceId] ?? []).find(
        (entry) => entry.id === ref.sessionId
      );
      add(ref.instanceId, session?.directory);
    });
    // The exact directory a pending prompt event reported, when it differs from the session folder.
    instanceIds.forEach((instanceId) => {
      (promptDirectoriesRef.current[instanceId] ?? []).forEach((directory) => add(instanceId, directory));
    });
    return hints;
  };

  /**
   * OpenCode scopes pending prompts by project, so a refresh only sees the directories it asks for.
   * Keep asking for every directory that already holds a pending permission/question; otherwise
   * browsing to another session drops the old directory and the prompt vanishes from the UI.
   */
  const promptHintsFor = (
    instanceIds: string[],
    known: Record<string, Array<{ directory?: string }>>
  ): Record<string, string[]> => {
    const hints = directoryHintsFor(instanceIds);
    instanceIds.forEach((instanceId) => {
      const directories = new Set(hints[instanceId] ?? []);
      (known[instanceId] ?? []).forEach((entry) => {
        if (entry.directory) directories.add(entry.directory);
      });
      if (directories.size > 0) hints[instanceId] = [...directories];
    });
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
    const next = await loadAllPermissions(instanceIds, promptHintsFor(instanceIds, permissionsByInstance)).catch(() => ({}));
    setPermissionsByInstance((prev) => ({ ...prev, ...next }));
  });

  const refreshQuestions = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const next = await loadAllQuestions(instanceIds, promptHintsFor(instanceIds, questionsByInstance)).catch(() => ({}));
    setQuestionsByInstance((prev) => ({ ...prev, ...next }));
  });

  const refreshQueues = useStableCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    const next = await loadAllMessageQueues(instanceIds).catch(() => ({}));
    setQueuesByInstance((prev) => mergePolledQueues(prev, next));
  });

  /** Directory + `updated` for a session, read through the ref so pollers stay stable. */
  const sessionMetaFor = (ref: SessionRef): { directory?: string; updated?: number } => {
    const session = (sessionsByInstanceRef.current[ref.instanceId] ?? []).find(
      (entry) => entry.id === ref.sessionId
    );
    return { directory: session?.directory, updated: session?.updated };
  };

  /** Refetch one transcript in full; authoritative for removals, compaction and terminal events. */
  const refreshMessages = useStableCallback(async (ref: SessionRef) => {
    const key = sessionKey(ref);
    const { directory, updated } = sessionMetaFor(ref);
    try {
      const next = await loadMessages(ref.instanceId, ref.sessionId, directory);
      commitFetchedTranscript(key, next, 'full', updated);
    } catch (err) {
      console.error('Failed to load messages', err);
      setTranscripts((prev) => {
        const current = prev[key];
        if (current?.status === 'ready') return prev;
        return {
          ...prev,
          [key]: { messages: current?.messages ?? messageCacheRef.current.get(key) ?? [], status: 'error' },
        };
      });
    } finally {
      fullRepairInFlight.current.delete(key);
    }
  });

  /** Bounded tail refresh for a visible column while a turn streams. */
  const refreshMessageTail = useStableCallback(async (ref: SessionRef) => {
    const key = sessionKey(ref);
    const { directory, updated } = sessionMetaFor(ref);
    try {
      const tail = await loadMessageTail(ref.instanceId, ref.sessionId, directory);
      commitFetchedTranscript(key, tail, 'tail', updated);
    } catch (err) {
      console.error('Failed to load message tail', err);
    }
  });

  /** Background sessions refresh only their summary; they never touch the transcript cache. */
  const refreshMessageSummary = useStableCallback(async (ref: SessionRef) => {
    const key = sessionKey(ref);
    const { directory, updated } = sessionMetaFor(ref);
    try {
      const tail = await loadMessageTail(ref.instanceId, ref.sessionId, directory);
      commitSummary(key, tail, false, updated);
    } catch (err) {
      console.warn('Failed to load message summary', err);
    }
  });

  // A tail with no safe overlap asks for one full repair; route it through the normal loader.
  fullRepairRef.current = (key: string) => {
    const ref = parseSessionKey(key);
    if (ref) void refreshMessages(ref);
    else fullRepairInFlight.current.delete(key);
  };

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
      // Replace each refreshed instance's tasks wholesale so a deleted task can't linger; other
      // instances keep their last good snapshot.
      const refreshed = new Set(targets);
      setScheduledTasksByKey((prev) => {
        const next: Record<string, ScheduledTask> = {};
        for (const [key, task] of Object.entries(prev)) {
          if (!refreshed.has(task.instanceId)) next[key] = task;
        }
        results.forEach((result) =>
          result.tasks.forEach((task) => {
            next[task.key] = task;
          })
        );
        return next;
      });
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

  /** Re-run a task now. The server creates a fresh session with the task's prompt and model. */
  const handleRunScheduledTask = useStableCallback(async (task: ScheduledTask) => {
    setRunningScheduledKeys((prev) => new Set(prev).add(task.key));
    try {
      const result = await runScheduledTask(task.instanceId, task);
      if (!result.ok) {
        showActionError(result.error ?? `Could not run “${task.name}”.`);
        return;
      }
      setActionNotice({ message: `Started “${task.name}”.` });
      void refreshScheduled([task.instanceId]);
      // The instance needs a beat to create the session before the next list fetch can see it.
      window.setTimeout(() => void refreshSessions([task.instanceId]), 900);
    } catch (err) {
      showActionError(err instanceof Error ? err.message : `Could not run “${task.name}”.`);
    } finally {
      setRunningScheduledKeys((prev) => {
        const next = new Set(prev);
        next.delete(task.key);
        return next;
      });
    }
  });

  const handleChangeScheduledTaskModel = useStableCallback((task: ScheduledTask) =>
    setScheduledModelTarget(task)
  );

  /**
   * Persist a task's new model, then run it — the point of the flow is to fix an errored task and
   * retry it with a working model. The task's own JSON is replayed so schedule/prompt survive.
   */
  const handleScheduledModelSelect = async (task: ScheduledTask, key: string, variant: string) => {
    const models = modelsByInstance[task.instanceId];
    let model: ModelRef | null = null;
    if (key === DEFAULT_MODEL) {
      const fallback = models?.models.find((option) => modelRefKey(option) === models.defaultModelId);
      if (fallback) model = { providerID: fallback.providerID, modelID: fallback.modelID };
    } else {
      const slash = key.indexOf('/');
      if (slash > 0) model = { providerID: key.slice(0, slash), modelID: key.slice(slash + 1) };
    }
    if (!model) {
      showActionError('Pick a concrete model for the scheduled task.');
      return;
    }
    if (variant) model.variant = variant;
    const result = await updateScheduledTaskModel(task.instanceId, task, model);
    if (!result.ok) {
      showActionError(result.error ?? `Could not update “${task.name}”.`);
      return;
    }
    const updated = result.task ?? { ...task, model };
    setScheduledTasksByKey((prev) => ({ ...prev, [updated.key]: updated }));
    setActionNotice({
      message: `Updated “${task.name}” to ${model.providerID}/${model.modelID} — starting a run.`,
    });
    void refreshScheduled([task.instanceId]);
    void handleRunScheduledTask(updated);
  };

  // ---- Event streams: hints invalidate, refreshers refetch. ----
  const [liveInstances, setLiveInstances] = React.useState<Record<string, boolean>>({});
  const liveInstancesRef = React.useRef(liveInstances);
  const refetch = useStableCallback(async ({ instanceId, resource, sessionId, messageMode }: Invalidation) => {
    switch (resource) {
      case 'sessions': await refreshSessions([instanceId]); break;
      case 'states': await refreshStates([instanceId]); break;
      case 'permissions': await refreshPermissions([instanceId]); break;
      case 'questions': await refreshQuestions([instanceId]); break;
      case 'queues': await refreshQueues([instanceId]); break;
      case 'autoAccept': await refreshAutoAccept([instanceId]); break;
      case 'scheduled': await refreshScheduled([instanceId]); break;
      case 'messages':
        if (sessionId) {
          if (messageMode === 'full') await refreshMessages({ instanceId, sessionId });
          else await refreshMessageTail({ instanceId, sessionId });
        }
        break;
      case 'messageSummary':
        if (sessionId) await refreshMessageSummary({ instanceId, sessionId });
        break;
    }
  });
  const invalidationQueue = React.useMemo(() => new InvalidationQueue(refetch), [refetch]);

  React.useEffect(() => {
    const bridge = window.ember;
    if (!bridge.onEvent) return;
    const readySet = new Set(readyIds);
    // A message hint is worth a transcript fetch only for a session shown as a column; other
    // sessions (tabs, minimized) fall back to refreshing the session list.
    const isLoaded = (instanceId: string, sessionId: string) =>
      columnsRef.current.includes(sessionKey({ instanceId, sessionId }));

    const catchUp = (instanceId: string) => {
      // The stream just (re)connected; anything that changed while it was down was missed.
      (['sessions', 'states', 'permissions', 'questions', 'queues', 'autoAccept'] as const).forEach((resource) =>
        invalidationQueue.push({ instanceId, resource })
      );
      columnsRef.current.forEach((key) => {
        const ref = parseSessionKey(key);
        if (ref?.instanceId === instanceId) {
          invalidationQueue.push({
            instanceId,
            resource: 'messages',
            sessionId: ref.sessionId,
            messageMode: 'full',
          });
        }
      });
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
      if (event.directory && (event.type.startsWith('question.') || event.type.startsWith('permission.'))) {
        const list =
          promptDirectoriesRef.current[event.instanceId] ??
          (promptDirectoriesRef.current[event.instanceId] = []);
        if (!list.includes(event.directory)) {
          list.push(event.directory);
          if (list.length > 40) list.splice(0, list.length - 40);
        }
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

  // Preview warming writes only compact summaries; it never inserts a transcript into the message
  // cache. The effect reads summaries through a ref so a poll that lands mid-batch doesn't cancel it.
  React.useEffect(() => {
    const targets = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .slice(0, PREVIEW_COUNT)
      .filter((session) => {
        const summary = summariesRef.current[sessionKey(session)];
        return !summary || summary.version !== session.updated;
      });
    if (targets.length === 0) return;
    let cancelled = false;

    void (async () => {
      const results: Array<readonly [string, SessionMessageSummary]> = [];
      let cursor = 0;
      const loadNext = async (): Promise<void> => {
        while (cursor < targets.length) {
          const session = targets[cursor];
          cursor += 1;
          const key = sessionKey(session);
          const previous = summariesRef.current[key];
          let summary: SessionMessageSummary | null = null;
          for (const limit of PREVIEW_LIMITS) {
            const tail = await loadMessageTail(
              session.instanceId,
              session.id,
              session.directory,
              limit
            ).catch(() => null);
            // A failed request leaves the prior summary in place.
            if (!tail) break;
            summary = summarizeMessages(tail, { previous, complete: false, version: session.updated });
            // Stop once a previewable turn is found, or once the transcript is exhausted; otherwise
            // expand through 32 and 128. A tool-only tail at the largest limit retains `previous`.
            if (summary.preview || summary.failed || tail.length < limit) break;
          }
          if (summary) results.push([key, summary]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(PREVIEW_CONCURRENCY, targets.length) }, () => loadNext())
      );
      if (cancelled || results.length === 0) return;
      setSummaries((prev) => {
        let changed = false;
        const next = { ...prev };
        results.forEach(([key, summary]) => {
          const existing = prev[key];
          if (existing && sameSummary(existing, summary)) return;
          next[key] = summary;
          changed = true;
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sessions]);

  // Selecting a column refreshes it immediately; the poll below (and message events) keep it
  // fresh while the agent is working. Cached messages render before the fetch lands.
  React.useEffect(() => {
    if (!selected) return;
    void refreshMessages(selected);
  }, [selected, refreshMessages]);

  // Only the columns actually on screen poll their transcripts; overflow/minimized tabs rely on
  // the preview cache and the session list's `updated`.
  const columnsLive =
    columns.length > 0 &&
    columns.every((key) => {
      const ref = parseSessionKey(key);
      return ref ? liveInstances[ref.instanceId] === true : false;
    });
  usePoll(
    async () => {
      await Promise.all(
        columnsRef.current.map((key) => {
          const ref = parseSessionKey(key);
          return ref ? refreshMessages(ref) : Promise.resolve();
        })
      );
    },
    columnsLive ? MESSAGES_POLL_LIVE_MS : STATE_POLL_MS,
    columns.length > 0
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

  const beginNewAgent = (instanceId: string, directory?: string) => {
    showActionError(null);
    // Keep the open columns; the draft simply takes the active pane (no session key yet). A
    // project's `+` passes its directory so the draft starts there instead of the instance default.
    setActiveSession(null);
    setNewSessionInstanceId(instanceId);
    setNewSessionDirectory(directory ?? null);
  };

  const cancelNewAgent = () => {
    setNewSessionInstanceId(null);
    setNewSessionDirectory(null);
  };

  /** Create the session from the draft, then send the first message into it. */
  const handleCreateAndSend = async (options: NewSessionOptions, input: PromptInput): Promise<boolean> => {
    showActionError(null);
    let created: Session | null;
    try {
      created = await createSession(options.instanceId, options.directory);
    } catch (err) {
      showActionError(err instanceof Error ? err.message : 'Could not create a new agent.');
      return false;
    }
    if (!created) {
      showActionError('Could not create a new agent.');
      return false;
    }
    const session = created;
    const now = Date.now();
    prunePendingCreated((pending) => pending.expiresAt <= now);
    pendingCreatedSessions.current.set(sessionKey(session), {
      session,
      expiresAt: now + CREATED_SESSION_GRACE_MS,
    });
    setSessionsByInstance((prev) => ({
      ...prev,
      [options.instanceId]: [session, ...(prev[options.instanceId] ?? [])],
    }));
    setHidden((prev) => {
      if (!prev.has(options.instanceId)) return prev;
      const next = new Set(prev);
      next.delete(options.instanceId);
      return next;
    });
    const ref = { instanceId: options.instanceId, sessionId: session.id };
    openSession(ref, session);
    if (options.bypass) void setYolo(ref, true, session.directory);
    // The optimistic insert above plus the pendingCreatedSessions grace keep the row visible;
    // the next session poll (which includes the selected session's directory) is authoritative.
    // A failed send here lands the user in the new, empty session with the normal retry notice;
    // ChatView keeps the draft text for that session.
    return sendTo(ref, session.directory, input);
  };

  const handleSend = (input: PromptInput): Promise<boolean> =>
    selected ? sendTo(selected, selectedSession?.directory, input) : Promise.resolve(false);

  const instanceLabelOf = (instanceId: string): string =>
    instances.find((instance) => instance.id === instanceId)?.label ?? instanceId;

  const sendTo = async (target: SessionRef, directory: string | undefined, input: PromptInput): Promise<boolean> => {
    showActionError(null);
    const { instanceId, sessionId } = target;
    const { model, text, attachments = [], variant } = input;
    const key = sessionKey(target);

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
    pendingFor(key).add(optimisticId);
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
        releaseOptimistic(key, [optimisticId]);
        removeOptimistic();
        showActionError(
          responseError(sent.data, 'Message could not be sent.', instanceLabelOf(instanceId)),
          () => void sendTo(target, directory, input)
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
      // The server may not have indexed the user turn yet; reconcile keeps the bubble until it does.
      commitFetchedTranscript(key, loaded, 'full', updated);
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
        accepted ? undefined : () => void sendTo(target, directory, input)
      );
      return accepted;
    } finally {
      // Accepted sends keep the id until a poll shows the server copy (see releaseOptimistic).
      if (!accepted) releaseOptimistic(key, [optimisticId]);
      setSendingKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const queue = useMessageQueue({
    modelsByInstance,
    setQueuesByInstance,
    showActionError,
  });

  /** Queue handlers are built per column; this binds one to its session. */
  const queueTargetFor = (ref: SessionRef, session: Session | null): QueueTarget => ({
    ref,
    session,
    queue:
      (queuesByInstance[ref.instanceId] ?? []).find((entry) => entry.sessionId === ref.sessionId) ??
      null,
    send: (input) => sendTo(ref, session?.directory, input),
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
      commitFetchedTranscript(key, messageResult.value, 'full', session.updated);
    } else {
      setTranscriptFor(key, messageCacheRef.current.get(key) ?? [], 'error');
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
    const key = sessionKey(session);
    if (archivingKeys.has(key)) return;
    showActionError(null);
    setActionNotice(null);
    setArchivingKeys((current) => new Set(current).add(key));
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
      // Archived sessions never stay open; a neighbour takes over if this was the active column.
      if (archived) closeSession(sessionKey(session));
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
    } finally {
      setArchivingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  /** From the archive screen: restore, then open the session as a column. */
  const handleRestoreAndOpen = async (session: Session) => {
    await handleArchive(session, false);
    openSession({ instanceId: session.instanceId, sessionId: session.id }, session);
    setArchiveOpen(false);
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

  const handleAbort = async (session: Session) => {
    showActionError(null);
    const key = sessionKey(session);
    try {
      const aborted = await abortSession(session);
      if (!aborted) {
        showActionError('Could not stop this agent.', () => void handleAbort(session));
        return;
      }
      const next = await loadMessages(session.instanceId, session.id, session.directory);
      commitFetchedTranscript(key, next, 'full', session.updated);
    } catch (err) {
      console.error('Abort refresh failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Could not stop this agent.',
        () => void handleAbort(session)
      );
    }
  };

  // Summarize/compact the session's context on the instance, then pull the rewritten transcript.
  const handleCompact = async (session: Session) => {
    const key = sessionKey(session);
    if (compactingKeys.has(key)) return;
    showActionError(null);
    setCompactingKeys((current) => new Set(current).add(key));
    try {
      const ok = await compactSession(session);
      if (!ok) {
        showActionError('Could not compact this session.', () => void handleCompact(session));
        return;
      }
      const next = await loadMessages(session.instanceId, session.id, session.directory);
      commitFetchedTranscript(key, next, 'full', session.updated);
      setActionNotice({ message: 'Context compacted.' });
    } catch (err) {
      console.error('Compact failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Could not compact this session.',
        () => void handleCompact(session)
      );
    } finally {
      setCompactingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  // Fork the session into a fresh one seeded with a handoff prompt, leaving the source untouched.
  /** Poll until the session's turn finishes, so a fresh fork can be compacted after it lands. */
  const waitForSessionIdle = async (
    instanceId: string,
    sessionId: string,
    timeoutMs = 60_000
  ): Promise<void> => {
    const key = sessionKey({ instanceId, sessionId });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const states = await loadSessionStates(instanceId).catch(() => null);
      if (states && states[key] === 'idle') return;
    }
  };

  const handleHandoff = async (session: Session) => {
    const key = sessionKey(session);
    if (handoffKeys.has(key)) return;
    showActionError(null);
    setHandoffKeys((current) => new Set(current).add(key));
    try {
      const forkedId = await forkSession(session, HANDOFF_PROMPT);
      if (!forkedId) {
        showActionError('Could not start a new session from this one.', () => void handleHandoff(session));
        return;
      }
      const forked: Session = { id: forkedId, instanceId: session.instanceId, directory: session.directory };
      // The fork copies the full context; wait for the handoff summary to land, then compact it so
      // the new session carries the summary rather than the whole prior conversation. The source
      // session is left untouched either way.
      await waitForSessionIdle(session.instanceId, forkedId);
      const compacted = await compactSession(forked, session.model);
      await refreshSessions([session.instanceId]);
      openSession({ instanceId: session.instanceId, sessionId: forkedId }, forked);
      setActionNotice({
        message: compacted
          ? 'Started a new session from a compacted summary.'
          : 'Started a new session; the handoff summary could not be compacted.',
      });
    } catch (err) {
      console.error('Handoff failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Could not start the new session.',
        () => void handleHandoff(session)
      );
    } finally {
      setHandoffKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
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
      Object.keys(allocatedProjectColors).length > 0 &&
      !sameNumberRecord(allocatedProjectColors, settings.projectColorAssignments)
    ) {
      handleSettings({ projectColorAssignments: allocatedProjectColors });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSettings is recreated per render; it only needs the compared values
  }, [allocatedProjectColors, settings.projectColorAssignments]);

  // Scheduled-task identity is one request per project (70+ on a busy instance), so it polls
  // rarely; the `scheduled-task-ran` event covers the moment it actually matters.
  const projectsKnown = Object.keys(projectsByInstance).length > 0;
  usePoll(() => refreshScheduled(deadIdsRef.current), SCHEDULE_POLL_MS, projectsKnown && deadIds.length > 0);
  usePoll(() => refreshScheduled(liveIdsRef.current), SCHEDULE_POLL_LIVE_MS, projectsKnown && liveIds.length > 0);

  const handleTogglePin = (ref: SessionRef, message: ChatMessage) => {
    const key = messagePinKey(ref, message.id);
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

  const handleSaveNote = (key: string, text: string) => {
    if (!key) return;
    const clean = text.trim().slice(0, 20_000);
    if (!clean) return;
    const current = settingsRef.current.sessionNotes;
    const notes = [...(current[key] ?? []), { id: createNoteId(), text: clean }].slice(-100);
    handleSettings({ sessionNotes: { ...current, [key]: notes } });
  };

  const handleDeleteNote = (key: string, noteId: string) => {
    if (!key) return;
    const current = settingsRef.current.sessionNotes;
    const existing = current[key];
    if (!existing) return;
    const notes = existing.filter((note) => note.id !== noteId);
    const sessionNotes = { ...current };
    if (notes.length) sessionNotes[key] = notes;
    else delete sessionNotes[key];
    handleSettings({ sessionNotes });
  };

  const newSessionInstanceDefaults = newSessionInstanceId ? settings.instanceDefaults[newSessionInstanceId] : undefined;
  const newSessionPrefill = React.useMemo(() => {
    if (!newSessionInstanceId) return null;
    const sessions = sessionsByInstance[newSessionInstanceId] ?? [];
    const defaults = newSessionInstanceDefaults ?? {};
    return {
      directory:
        newSessionDirectory ??
        newSessionDirectoryPrefill(sessions, projectsByInstance[newSessionInstanceId] ?? [], defaults),
      model: newSessionModelPrefill(sessions, defaults),
      bypass: defaults.bypass === true,
    };
  }, [newSessionInstanceId, newSessionDirectory, newSessionInstanceDefaults, sessionsByInstance, projectsByInstance]);

  const modelInstanceId = selected?.instanceId ?? newSessionInstanceId;
  const selectedModels = modelInstanceId ? modelsByInstance[modelInstanceId] : undefined;
  const modelInstanceSessions = modelInstanceId ? sessionsByInstance[modelInstanceId] : undefined;
  const recentModels = React.useMemo(
    () => recentModelKeys(modelInstanceSessions ?? []),
    [modelInstanceSessions]
  );
  const recentModelsByInstance = React.useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [id, list] of Object.entries(sessionsByInstance)) out[id] = recentModelKeys(list);
    return out;
  }, [sessionsByInstance]);
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

  const sessionByKey = React.useMemo(() => {
    const map = new Map<string, Session>();
    Object.values(sessionsByInstance)
      .flat()
      .forEach((session) => map.set(sessionKey(session), session));
    return map;
  }, [sessionsByInstance]);

  const multiInstance = readyIds.length > 1;

  // The column the user is working in: whichever they last clicked, focused or scrolled. Before
  // any interaction (or if that session left), the most recently updated visible column stands in
  // using data already in hand — no polling. If timestamps are missing, any non-idle column will do.
  const featuredKey = React.useMemo(() => {
    if (activeSession && columns.includes(activeSession)) return activeSession;
    let best: string | null = null;
    let bestUpdated = -Infinity;
    for (const key of columns) {
      const updated = sessionByKey.get(key)?.updated ?? 0;
      if (updated > bestUpdated) {
        bestUpdated = updated;
        best = key;
      }
    }
    if (best && bestUpdated > 0) return best;
    return columns.find((key) => (states[key] ?? 'idle') !== 'idle') ?? columns[0] ?? null;
  }, [activeSession, columns, sessionByKey, states]);

  // The strip lists only sessions that are NOT already shown as columns (overflow + minimized),
  // so it's empty when everything fits on screen.
  const workspaceTabs: WorkspaceTab[] = React.useMemo(
    () =>
      openSessions.flatMap((key, index) => {
        if (columnKeySet.has(key)) return [];
        const session = sessionByKey.get(key);
        if (!session) return [];
        const ref = parseSessionKey(key);
        return [
          {
            key,
            title: session.title ?? session.id,
            instanceLabel: multiInstance
              ? instances.find((instance) => instance.id === ref?.instanceId)?.label
              : undefined,
            identity: avatarIdentities[key],
            mood: moods[key] ?? 'idle',
            number: index + 1,
            active: key === activeSession,
            minimized: minimizedSessions.has(key),
            archiving: archivingKeys.has(key),
          } satisfies WorkspaceTab,
        ];
      }),
    [openSessions, sessionByKey, multiInstance, instances, avatarIdentities, moods, activeSession, columnKeySet, minimizedSessions, archivingKeys]
  );

  /** One side-by-side column for an open session, with its own transcript, queue and handlers. */
  const renderColumn = (key: string) => {
    const ref = parseSessionKey(key);
    const session = sessionByKey.get(key);
    if (!ref || !session) return null;
    const instance = instances.find((entry) => entry.id === ref.instanceId) ?? null;
    const transcript = transcripts[key];
    const cached = messageCacheRef.current.get(key);
    const notesKey = notesKeyForSession(session, projectsByInstance[ref.instanceId] ?? []);
    const columnPermissions = permissions.filter(
      (request) => request.instanceId === ref.instanceId && request.sessionId === ref.sessionId
    );
    const columnQuestions = questions.filter(
      (request) => request.instanceId === ref.instanceId && request.sessionId === ref.sessionId
    );
    const models = modelsByInstance[ref.instanceId];
    const policy = autoAcceptByInstance[ref.instanceId];
    const serverAutoAccept = Boolean(policy?.supported);
    const columnBypass = serverAutoAccept
      ? policy?.sessions[ref.sessionId] ?? false
      : bypassOverrides[key] ?? settings.instanceDefaults[ref.instanceId]?.bypass ?? false;
    const target = queueTargetFor(ref, session);
    return (
      <div
        key={key}
        style={{ flexGrow: key === featuredKey ? 1.12 : 1 }}
        className="flex min-h-0 min-w-0 flex-1 basis-0 border-r transition-[flex-grow] duration-200 ease-out last:border-r-0"
        onWheelCapture={() => {
          if (key !== activeSession) activateSession(key);
        }}
      >
        <ChatView
          session={session}
          instance={instance}
          active={key === featuredKey}
          instanceMarkerColor={settings.instanceDefaults[ref.instanceId]?.markerColor}
          newSessionInstanceId={null}
          newSessionPrefill={null}
          instances={instances}
          projectsByInstance={projectsByInstance}
          seed={key}
          identity={avatarIdentities[key] ?? seedIdentity(key)}
          resolveDraftIdentity={resolveDraftIdentity}
          state={states[key] ?? 'idle'}
          mood={moods[key] ?? 'idle'}
          blobStyle={settings.blobStyle}
          messages={transcript?.messages ?? cached ?? []}
          messagesStatus={transcript?.status ?? (cached ? 'ready' : 'loading')}
          permissions={columnPermissions}
          questions={columnQuestions}
          models={models?.models ?? []}
          defaultModelId={models?.defaultModelId ?? null}
          recentModels={recentModelKeys(sessionsByInstance[ref.instanceId] ?? [])}
          sending={sendingKeys.has(key)}
          queue={target.queue}
          reloading={reloadingKeys.has(key)}
          bypass={columnBypass}
          hideToolCalls={settings.hideToolCalls}
          reasoningDisplay={settings.reasoningDisplay}
          pinnedMessageIds={pinnedMessageIdsFor(ref)}
          sessionNotes={settings.sessionNotes[notesKey] ?? []}
          notesKey={notesKey}
          savedComposerDrafts={settings.composerDrafts}
          composerDraftsHydrated={settingsLoaded}
          onComposerDraftsChange={handleComposerDraftsChange}
          onTogglePin={(message) => handleTogglePin(ref, message)}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
          onHideToolCallsChange={(hide) => handleSettings({ hideToolCalls: hide })}
          onReasoningDisplayChange={(mode) => handleSettings({ reasoningDisplay: mode })}
          onBypassChange={(enabled) => void setYolo(ref, enabled, session.directory)}
          onNewSessionInstanceChange={() => {}}
          onCreateAndSend={handleCreateAndSend}
          onCancelNewSession={cancelNewAgent}
          onSend={(input) => sendTo(ref, session.directory, input)}
          onQueue={(input) => queue.queueMessage(input, target)}
          onSendQueued={(itemId) => queue.sendQueuedMessage(itemId, target)}
          onQueuedModelChange={(itemId, model) => queue.changeQueuedModel(itemId, model, target)}
          onMoveQueued={(itemId, direction) => queue.moveQueued(itemId, direction, target)}
          onRemoveQueued={(itemId) => queue.removeQueued(itemId, target)}
          onRetryQueued={(itemId) => queue.retryQueued(itemId, target)}
          onDiscardQueued={(itemId) => queue.discardQueued(itemId, target)}
          onReload={() => void handleReloadSession(session)}
          onAbort={() => void handleAbort(session)}
          onPermission={handlePermission}
          onQuestion={handleQuestion}
          compacting={compactingKeys.has(key)}
          onCompact={() => void handleCompact(session)}
          handoffing={handoffKeys.has(key)}
          onHandoff={() => void handleHandoff(session)}
          onMinimize={() => minimizeSession(key)}
          onClose={() => closeSession(key)}
          onActivate={() => activateSession(key)}
          onArchive={() => void handleArchive(session, true)}
        />
      </div>
    );
  };

  // Error + notice toasts. They render inline at the very top of the window, next to the search
  // button, and both self-dismiss (errors after three minutes).
  const feedbackBanner =
    actionError || actionNotice ? (
      <>
        {actionError ? (
          <div
            role="alert"
            className="animate-in fade-in flex h-7 min-w-0 items-center gap-2 rounded-full border border-destructive/40 bg-popover px-2.5 text-[11.5px] shadow-sm"
          >
            <span className="min-w-0 max-w-[44ch] truncate" title={actionError}>
              {actionError}
            </span>
            {actionErrorRetry ? (
              <button
                type="button"
                className="shrink-0 rounded font-medium text-highlight hover:underline focus-visible:outline-2"
                onClick={() => actionErrorRetry()}
                aria-label="Retry failed action"
              >
                Retry
              </button>
            ) : null}
            <button
              type="button"
              className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
              onClick={() => {
                void copyText(actionError).then((copied) => setErrorCopied(copied));
              }}
              aria-label="Copy error message"
            >
              {errorCopied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
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
            className="animate-in fade-in flex h-7 min-w-0 items-center gap-2 rounded-full border border-highlight/35 bg-popover px-2.5 text-[11.5px] shadow-sm"
          >
            <span className="min-w-0 max-w-[44ch] truncate" title={actionNotice.message}>
              {actionNotice.message}
            </span>
            {actionNotice.actionLabel && actionNotice.action ? (
              <button
                type="button"
                className="shrink-0 rounded font-medium text-highlight hover:underline focus-visible:outline-2"
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
              className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
              onClick={() => setActionNotice(null)}
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </>
    ) : null;

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
            banner={feedbackBanner}
            onToggle={toggleInstance}
            onToggleNavigation={() => setMobileRailOpen((open) => !open)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onRefresh={() => void refreshInstances()}
            onOpenViewOptions={() => {
              setViewOptionsActivated(true);
              setViewOptionsOpen(true);
            }}
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
              everySession={everySession}
              moods={moods}
              previews={previews}
              selectedKey={selectedKey}
              selectedSession={selectedSession}
              avatarIdentities={avatarIdentities}
              blobStyle={settings.blobStyle}
              loading={loading}
              mobileOpen={mobileRailOpen}
              reloadingKeys={reloadingKeys}
              archivingKeys={archivingKeys}
              windowLabel={
                SESSION_WINDOWS.find((option) => option.hours === sessionWindowHours && option.hours > 0)
                  ?.label ?? null
              }
              showScheduled={showScheduled}
              onShowScheduled={setShowScheduled}
              scheduledTaskBySession={scheduledTaskBySession}
              runningScheduledKeys={runningScheduledKeys}
              onRunScheduledTask={(task) => void handleRunScheduledTask(task)}
              onChangeScheduledTaskModel={handleChangeScheduledTaskModel}
              onOpenArchive={() => setArchiveOpen(true)}
              onSelectSession={(session) => {
                openSession({ instanceId: session.instanceId, sessionId: session.id }, session);
                setMobileRailOpen(false);
              }}
              onOpenProject={(instanceId, project, projectSessions) => {
                openProject(instanceId, project, projectSessions);
                setMobileRailOpen(false);
              }}
              onReload={(session) => void handleReloadSession(session)}
              onArchive={(session, archived) => void handleArchive(session, archived)}
              onCustomizeAppearance={setAvatarPickerSession}
              onNewAgent={(instanceId, directory) => {
                beginNewAgent(instanceId, directory);
                setMobileRailOpen(false);
              }}
              onOpenSettings={() => {
                setMobileRailOpen(false);
                setSettingsView('general');
                setSettingsActivated(true);
                setSettingsOpen(true);
              }}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* The strip lives over the columns (right of the rail), aligned with the session header. */}
              <ColumnTabStrip
                tabs={workspaceTabs}
                blobStyle={settings.blobStyle}
                onActivate={activateSession}
                onMinimize={minimizeSession}
                onRestore={restoreSession}
                onArchive={(key) => {
                  const ref = parseSessionKey(key);
                  if (!ref) return;
                  const session = (sessionsByInstance[ref.instanceId] ?? []).find(
                    (entry) => entry.id === ref.sessionId
                  );
                  if (session) void handleArchive(session, true);
                }}
                onClose={closeSession}
              />
              <div ref={workspaceRef} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
              {newSessionInstanceId || columns.length === 0 ? (
                <ChatView
                  session={null}
                  instance={selectedInstance}
                  instanceMarkerColor={undefined}
                  newSessionInstanceId={newSessionInstanceId}
                  newSessionPrefill={newSessionPrefill}
                  instances={instances}
                  projectsByInstance={projectsByInstance}
                  seed={selectedKey ?? (newSessionInstanceId ? `new:${newSessionInstanceId}` : '')}
                  identity={selectedIdentity}
                  resolveDraftIdentity={resolveDraftIdentity}
                  state="idle"
                  mood={selectedMood}
                  blobStyle={settings.blobStyle}
                  messages={[]}
                  messagesStatus="ready"
                  permissions={[]}
                  questions={[]}
                  models={selectedModels?.models ?? []}
                  defaultModelId={selectedModels?.defaultModelId ?? null}
                  recentModels={recentModels}
                  sending={false}
                  queue={null}
                  reloading={false}
                  bypass={false}
                  hideToolCalls={settings.hideToolCalls}
                  reasoningDisplay={settings.reasoningDisplay}
                  pinnedMessageIds={NO_PINS}
                  sessionNotes={[]}
                  notesKey=""
                  savedComposerDrafts={settings.composerDrafts}
                  composerDraftsHydrated={settingsLoaded}
                  onComposerDraftsChange={handleComposerDraftsChange}
                  onTogglePin={() => {}}
                  onSaveNote={handleSaveNote}
                  onDeleteNote={handleDeleteNote}
                  onHideToolCallsChange={(hide) => handleSettings({ hideToolCalls: hide })}
                  onReasoningDisplayChange={(mode) => handleSettings({ reasoningDisplay: mode })}
                  onBypassChange={() => {}}
                  onNewSessionInstanceChange={(instanceId) => {
                    setNewSessionInstanceId(instanceId);
                    setNewSessionDirectory(null);
                  }}
                  onCreateAndSend={handleCreateAndSend}
                  onCancelNewSession={cancelNewAgent}
                  onSend={handleSend}
                  onQueue={async () => false}
                  onSendQueued={async () => false}
                  onQueuedModelChange={async () => false}
                  onMoveQueued={async () => false}
                  onRemoveQueued={async () => false}
                  onRetryQueued={async () => false}
                  onDiscardQueued={() => false}
                  onReload={() => {}}
                  onAbort={() => {}}
                  onPermission={handlePermission}
                  onQuestion={handleQuestion}
                  compacting={false}
                  onCompact={() => {}}
                  handoffing={false}
                  onHandoff={() => {}}
                />
              ) : (
                columns.map(renderColumn)
              )}
              </div>
            </div>
          </div>

          <React.Suspense fallback={null}>
            <CommandPalette
              open={commandPaletteOpen}
              sessions={allSessions}
              states={states}
              instances={instances}
              projectsByInstance={projectsByInstance}
              sessionNotes={settings.sessionNotes}
              onOpenChange={setCommandPaletteOpen}
              onSelectSession={(session) => {
                openSession({ instanceId: session.instanceId, sessionId: session.id }, session);
                setMobileRailOpen(false);
              }}
              onNewAgent={(instanceId) => {
                beginNewAgent(instanceId);
                setMobileRailOpen(false);
              }}
            />
          </React.Suspense>

          {archiveOpen ? (
            <React.Suspense fallback={<DialogFallback label="Loading archive…" />}>
              <ArchiveDialog
                open
                onOpenChange={setArchiveOpen}
                sessions={archivedSessions}
                projectsByInstance={projectsByInstance}
                instances={instances}
                moods={moods}
                previews={previews}
                avatarIdentities={avatarIdentities}
                blobStyle={settings.blobStyle}
                instanceDefaults={settings.instanceDefaults}
                reloadingKeys={reloadingKeys}
                archivingKeys={archivingKeys}
                onRestoreSession={(session) => void handleRestoreAndOpen(session)}
                onReload={(session) => void handleReloadSession(session)}
                onArchive={(session, archived) => void handleArchive(session, archived)}
                onCustomizeAppearance={setAvatarPickerSession}
              />
            </React.Suspense>
          ) : null}

          {settingsActivated ? (
            <React.Suspense fallback={<DialogFallback label="Loading settings…" />}>
              <SettingsPanel
                open={settingsOpen}
                view={settingsView}
                settings={settings}
                instances={instances}
                projectsByInstance={projectsByInstance}
                modelsByInstance={modelsByInstance}
                recentModelsByInstance={recentModelsByInstance}
                onChange={handleSettings}
                onOpenChange={setSettingsOpen}
                onViewChange={setSettingsView}
              />
            </React.Suspense>
          ) : null}

          {viewOptionsActivated ? (
            <React.Suspense fallback={null}>
              <ViewOptionsDialog
                open={viewOptionsOpen}
                onOpenChange={setViewOptionsOpen}
                hideToolCalls={settings.hideToolCalls}
                reasoningDisplay={settings.reasoningDisplay}
                onHideToolCallsChange={(hide) => handleSettings({ hideToolCalls: hide })}
                onReasoningDisplayChange={(mode) => handleSettings({ reasoningDisplay: mode })}
              />
            </React.Suspense>
          ) : null}

          {avatarPickerSession ? (
            <React.Suspense fallback={<DialogFallback label="Loading appearance…" />}>
              <AvatarPicker
                open
                title={
                  avatarPickerProject
                    ? `Project: ${avatarPickerProject.name}`
                    : avatarPickerFolderName
                      ? `Folder: ${avatarPickerFolderName}`
                      : avatarPickerSession.title ?? avatarPickerSession.id
                }
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

          {scheduledModelTarget ? (
            <React.Suspense fallback={null}>
              <ModelPicker
                open
                models={modelsByInstance[scheduledModelTarget.instanceId]?.models ?? []}
                recentModels={recentModelsByInstance[scheduledModelTarget.instanceId] ?? []}
                value={scheduledModelTarget.model ? modelRefKey(scheduledModelTarget.model) : ''}
                variant={scheduledModelTarget.model?.variant ?? ''}
                defaultModelId={modelsByInstance[scheduledModelTarget.instanceId]?.defaultModelId ?? null}
                collapseProviders
                onSelect={(key, variant) => void handleScheduledModelSelect(scheduledModelTarget, key, variant)}
                onOpenChange={(open) => {
                  if (!open) setScheduledModelTarget(null);
                }}
              />
            </React.Suspense>
          ) : null}

        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
