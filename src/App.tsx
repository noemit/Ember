import * as React from 'react';
import { MotionConfig } from 'motion/react';
import InstanceBar from './components/InstanceBar';
import LeftRail from './components/LeftRail';
import ChatView from './components/ChatView';
import { TooltipProvider } from '@/components/ui/tooltip';
import { applyTheme, DEFAULT_THEME_ID } from './themes';
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
  enqueueMessage,
  errorMessageOf,
  listInstances,
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
  loadSessionPreview,
  loadSessions,
  loadScheduledIdentityData,
  mergePolledSessions,
  previewOf,
  reconcilePolledMessages,
  rejectQuestion,
  removeQueuedMessage,
  replyPermission,
  replyQuestion,
  sendPrompt,
  setSessionArchived,
  type ModelList,
  type PromptInput,
} from './api';
import { modelRefKey, SESSION_WINDOWS, sessionKey } from './types';
import type {
  AvatarOverride,
  BallState,
  ChatMessage,
  MessagesStatus,
  MessageQueueSession,
  EmberSettings,
  EmberSettingsPatch,
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

const STATE_POLL_MS = 3000;
const SESSION_POLL_MS = 10_000;
const SCHEDULE_POLL_MS = 30_000;
const PREVIEW_COUNT = 24;
const PREVIEW_CONCURRENCY = 4;
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

const DEFAULT_SETTINGS: EmberSettings = {
  theme: DEFAULT_THEME_ID,
  blobStyle: 'grok',
  sessionWindowHours: 48,
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

// Tool calls change status without the text changing, so compare the parts too.
const messageSignature = (message: ChatMessage): string =>
  `${message.id}|${message.completed ? 1 : 0}|${message.createdAt ?? ''}|${message.completedAt ?? ''}|${message.model ? modelRefKey(message.model) : ''}|${message.error ?? ''}|${message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') return part.text;
      if (part.type === 'file') return `${part.file.mime}:${part.file.filename}:${part.file.url}`;
      const { call } = part;
      return `${call.id}:${call.status}:${call.title ?? ''}:${call.error ?? ''}:${JSON.stringify(call.input ?? null)}:${call.output ?? ''}:${call.diff ?? ''}`;
    })
    .join('\u0001')}`;

const sameMessages = (a: ChatMessage[], b: ChatMessage[]): boolean =>
  a.length === b.length && a.every((m, i) => messageSignature(m) === messageSignature(b[i]));

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
      return [key, draft.text, draft.modelId ?? '', draft.variant ?? '', draft.mode ?? ''];
    })
  );

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
};

const responseError = (data: unknown, fallback: string): string =>
  errorMessageOf(data) ?? fallback;

type ActionNotice = {
  message: string;
  actionLabel?: string;
  action?: () => void;
};

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
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = React.useState<MessagesStatus>('ready');
  const [modelsByInstance, setModelsByInstance] = React.useState<Record<string, ModelList>>({});
  const [scheduledTaskNames, setScheduledTaskNames] = React.useState<Record<string, string>>({});
  const [settings, setSettings] = React.useState<EmberSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [sendingKeys, setSendingKeys] = React.useState<Set<string>>(() => new Set());
  const [reloadingKeys, setReloadingKeys] = React.useState<Set<string>>(() => new Set());
  const [bypassOverrides, setBypassOverrides] = React.useState<Record<string, boolean>>({});
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionNotice, setActionNotice] = React.useState<ActionNotice | null>(null);
  const [noticePaused, setNoticePaused] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsActivated, setSettingsActivated] = React.useState(false);
  const [avatarPickerSession, setAvatarPickerSession] = React.useState<Session | null>(null);
  const [settingsView, setSettingsView] = React.useState<'general' | 'instances'>('general');
  const [showArchived, setShowArchived] = React.useState(false);
  const [showScheduled, setShowScheduled] = React.useState(false);
  const [mobileRailOpen, setMobileRailOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [actionErrorRetry, setActionErrorRetry] = React.useState<(() => void) | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = React.useState('');
  const [errorCopied, setErrorCopied] = React.useState(false);

  const showActionError = (message: string | null, retry?: () => void) => {
    setActionError(message);
    setActionErrorRetry(() => retry ?? null);
  };

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

  React.useEffect(() => {
    setErrorCopied(false);
  }, [actionError]);

  React.useEffect(() => {
    if (!errorCopied) return;
    const timer = window.setTimeout(() => setErrorCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [errorCopied]);

  React.useEffect(() => {
    setNoticePaused(false);
  }, [actionNotice]);

  React.useEffect(() => {
    if (!actionNotice || noticePaused) return;
    const timer = window.setTimeout(() => setActionNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [actionNotice, noticePaused]);

  // Keep a live ref to the selected session so pollers can read its
  // directory (for routing) without re-running the effect on every session list refresh.
  const selectedSessionRef = React.useRef<Session | null>(null);
  const selectedKeyRef = React.useRef<string | null>(null);
  const pendingCreatedSessions = React.useRef(new Map<string, { session: Session; expiresAt: number }>());
  const pendingOptimisticIds = React.useRef(new Set<string>());
  const bypassReplyIds = React.useRef(new Set<string>());
  const settingsRevision = React.useRef(0);
  const scheduledBindingsRef = React.useRef<Record<string, string>>({});
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const lastStatusAnnouncementRef = React.useRef<{
    key: string;
    state: BallState;
    signature: string;
  } | null>(null);
  const statusAnnouncementTimerRef = React.useRef<number | undefined>(undefined);

  const announceStatus = (message: string) => {
    if (statusAnnouncementTimerRef.current !== undefined) {
      window.clearTimeout(statusAnnouncementTimerRef.current);
      statusAnnouncementTimerRef.current = undefined;
    }
    if (!message) {
      setStatusAnnouncement('');
      return;
    }
    // Clear first so repeated identical messages still trigger the live region.
    setStatusAnnouncement('');
    statusAnnouncementTimerRef.current = window.setTimeout(() => {
      setStatusAnnouncement(message);
      statusAnnouncementTimerRef.current = undefined;
    }, 40);
  };

  React.useEffect(
    () => () => {
      if (statusAnnouncementTimerRef.current !== undefined) {
        window.clearTimeout(statusAnnouncementTimerRef.current);
      }
    },
    []
  );

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

  // A pending approval or question trumps whatever the status endpoint says (it only knows
  // idle/busy): the agent is blocked on us.
  const states = React.useMemo(() => {
    const merged = Object.assign({}, ...Object.values(statesByInstance)) as Record<string, BallState>;
    [...permissions, ...questions].forEach((request) => {
      merged[sessionKey({ instanceId: request.instanceId, sessionId: request.sessionId })] = 'needs-input';
    });
    return merged;
  }, [statesByInstance, permissions, questions]);

  const selectedKey = selected ? sessionKey(selected) : null;
  React.useEffect(() => {
    setActionErrorRetry(null);
  }, [selectedKey]);
  const sending = selectedKey ? sendingKeys.has(selectedKey) : false;
  const bypass = selectedKey && selected
    ? bypassOverrides[selectedKey] ?? settings.instanceDefaults[selected.instanceId]?.bypass ?? false
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
  const avatarIdentities = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(sessionsByInstance).flatMap(([instanceId, list]) =>
          list.map((session) => [
            sessionKey(session),
            resolveAvatarIdentity(
              session,
              projectsByInstance[instanceId] ?? [],
              settings.scheduledSessionBindings,
              settings.avatarOverrides,
              allocatedProjectColors
            ),
          ])
        )
      ),
    [sessionsByInstance, projectsByInstance, settings.scheduledSessionBindings, settings.avatarOverrides, allocatedProjectColors]
  );
  const selectedIdentity = selectedKey
    ? avatarIdentities[selectedKey] ?? seedIdentity(selectedKey)
    : seedIdentity('');
  const selectedIdentitySignature = JSON.stringify(selectedIdentity);
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
  }, [selectedKey, selectedIdentitySignature, selectedState, settings.blobStyle, settings.theme]);

  const refreshInstances = React.useCallback(async () => {
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
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [stored, list] = await Promise.all([window.ember.getSettings(), listInstances()]);
        if (cancelled) return;
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
        setInstances(list);
        setSettingsLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setSettingsLoaded(true);
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
  }, []);

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
        setProjectsByInstance(projects);
        setModelsByInstance(Object.fromEntries(modelLists));
      } catch (err) {
        if (!cancelled) {
          showActionError(err instanceof Error ? err.message : 'Could not load instance metadata.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  // Sessions across every connected instance, refreshed on an interval so new
  // sessions started elsewhere show up without a manual reload.
  React.useEffect(() => {
    if (readyIds.length === 0) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const directoryHints: Record<string, string[]> = {};
        if (selectedSessionRef.current?.directory) {
          directoryHints[selectedSessionRef.current.instanceId] = [selectedSessionRef.current.directory];
        }
        const next = await loadAllSessions(readyIds, directoryHints);
        if (cancelled) return;
        const now = Date.now();
        pendingCreatedSessions.current.forEach((pending, key) => {
          if (
            pending.expiresAt <= now ||
            next[pending.session.instanceId]?.some((session) => session.id === pending.session.id)
          ) pendingCreatedSessions.current.delete(key);
        });
        const preserved = [
          ...(selectedSessionRef.current ? [selectedSessionRef.current] : []),
          ...[...pendingCreatedSessions.current.values()].map((pending) => pending.session),
        ];
        setSessionsByInstance((prev) => mergePolledSessions(prev, next, preserved));
        setLoading(false);
      } catch (err) {
        console.error('Failed to load sessions', err);
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), SESSION_POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  React.useEffect(() => {
    if (readyIds.length === 0) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const directoryHints: Record<string, string[]> = {};
        if (selectedSessionRef.current?.directory) {
          directoryHints[selectedSessionRef.current.instanceId] = [selectedSessionRef.current.directory];
        }
        const [nextStates, nextPermissions, nextQuestions, nextQueues] = await Promise.all([
          loadAllSessionStates(readyIds),
          loadAllPermissions(readyIds, directoryHints),
          loadAllQuestions(readyIds, directoryHints),
          loadAllMessageQueues(readyIds),
        ]);
        if (cancelled) return;
        setStatesByInstance((prev) => ({ ...prev, ...nextStates }));
        setPermissionsByInstance((prev) => ({ ...prev, ...nextPermissions }));
        setQuestionsByInstance((prev) => ({ ...prev, ...nextQuestions }));
        setQueuesByInstance((prev) => ({ ...prev, ...nextQueues }));
      } catch (err) {
        console.error('Failed to load session state', err);
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), STATE_POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey, selectedKey]);

  React.useEffect(() => {
    const targets = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .slice(0, PREVIEW_COUNT)
      .filter((session) => {
        const key = sessionKey(session);
        return !(key in previews) || previewVersions[key] !== session.updated;
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
          entries.push([
            sessionKey(session),
            await loadSessionPreview(session.instanceId, session.id, session.directory),
            session.updated,
          ]);
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
  }, [sessions, previews, previewVersions]);

  // Messages for the open session, kept fresh while the agent is working.
  React.useEffect(() => {
    if (!selected) {
      setMessages([]);
      setMessagesStatus('ready');
      return;
    }
    setMessages([]);
    // Until the first response lands the transcript says "loading", not "no messages" —
    // remote instances can take many seconds, and a failed first attempt is retried by the poll.
    setMessagesStatus('loading');
    let cancelled = false;
    let timer: number | undefined;
    const key = sessionKey(selected);

    const load = async () => {
      try {
        const next = await loadMessages(
          selected.instanceId,
          selected.sessionId,
          selectedSessionRef.current?.directory
        );
        if (cancelled) return;
        setMessages((prev) => {
          const merged = reconcilePolledMessages(prev, next, pendingOptimisticIds.current);
          return sameMessages(prev, merged) ? prev : merged;
        });
        setMessagesStatus('ready');
        const preview = previewOf(next);
        if (preview) {
          setPreviews((prev) => (prev[key] === preview ? prev : { ...prev, [key]: preview }));
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load messages', err);
        setMessagesStatus((prev) => (prev === 'ready' ? prev : 'error'));
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void load(), STATE_POLL_MS);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [selected]);

  const toggleInstance = (instanceId: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });

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
      pendingCreatedSessions.current.forEach((pending, key) => {
        if (pending.expiresAt <= now) pendingCreatedSessions.current.delete(key);
      });
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
      setBypassOverrides((prev) => ({ ...prev, [sessionKey(ref)]: options.bypass }));
      setSelected(ref);
      setNewSessionInstanceId(null);
      const fresh = await loadSessions(options.instanceId, created.directory);
      if (fresh) {
        // Keep the optimistic session at the top while the server catches up.
        const seen = new Set<string>();
        const merged = [created, ...fresh].filter((session) => {
          if (seen.has(session.id)) return false;
          seen.add(session.id);
          return true;
        });
        setSessionsByInstance((prev) => ({ ...prev, [options.instanceId]: merged }));
      }
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
    setMessages((prev) => [...prev, optimistic]);
    setSendingKeys((prev) => new Set(prev).add(key));

    const removeOptimistic = () =>
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
    let accepted = false;

    try {
      const sent = await sendPrompt(instanceId, sessionId, input, directory, optimisticId);
      pendingOptimisticIds.current.delete(optimisticId);
      if (!sent.ok) {
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
      const next = await loadMessages(instanceId, sessionId, directory);
      const preview = previewOf(next);
      if (selectedKeyRef.current === key) setMessages(next);
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
      pendingOptimisticIds.current.delete(optimisticId);
      setSendingKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const applyQueueMutation = (
    instanceId: string,
    mutation: { session: MessageQueueSession } | null
  ) => {
    if (!mutation) return;
    setQueuesByInstance((prev) => {
      const existing = prev[instanceId] ?? [];
      const without = existing.filter((queue) => queue.sessionId !== mutation.session.sessionId);
      return {
        ...prev,
        [instanceId]: mutation.session.items.length || mutation.session.sendingId
          ? [mutation.session, ...without]
          : without,
      };
    });
  };

  const handleQueueMessage = async (input: PromptInput): Promise<boolean> => {
    if (!selected) return false;
    showActionError(null);
    const { instanceId, sessionId } = selected;
    const directory = selectedSession?.directory;
    if (!directory) {
      showActionError('Could not queue this message because the session folder is unknown.');
      return false;
    }
    const modelList = modelsByInstance[instanceId];
    const model = input.model ?? modelList?.models.find(
      (candidate) => modelRefKey(candidate) === modelList.defaultModelId
    );
    if (!model) {
      showActionError('Could not queue this message until the instance default model is known.');
      return false;
    }

    try {
      const queued = await enqueueMessage(instanceId, sessionId, directory, { ...input, model });
      if (!queued.ok || !queued.data) {
        showActionError(
          queued.status === 404
            ? 'This OpenChamber instance does not support message queueing yet.'
            : 'Message could not be queued.',
          queued.status === 404 ? undefined : () => void handleQueueMessage(input)
        );
        return false;
      }
      applyQueueMutation(instanceId, queued.data);
      return true;
    } catch (err) {
      console.error('Queue failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Message could not be queued.',
        () => void handleQueueMessage(input)
      );
      return false;
    }
  };

  const handleRemoveQueuedMessage = async (itemId: string): Promise<boolean> => {
    if (!selected) return false;
    showActionError(null);
    try {
      const removed = await removeQueuedMessage(selected.instanceId, selected.sessionId, itemId);
      if (!removed.ok) {
        showActionError(
          removed.status === 409 ? 'That queued message is already being sent.' : 'Could not remove the queued message.',
          removed.status === 409 ? undefined : () => void handleRemoveQueuedMessage(itemId)
        );
        return false;
      }
      applyQueueMutation(selected.instanceId, removed.data);
      return true;
    } catch (err) {
      console.error('Remove queued message failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Could not remove the queued message.',
        () => void handleRemoveQueuedMessage(itemId)
      );
      return false;
    }
  };

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
      if (selectedKeyRef.current === key) {
        setMessages((current) =>
          reconcilePolledMessages(current, messageResult.value, pendingOptimisticIds.current)
        );
        setMessagesStatus('ready');
      }
      const preview = previewOf(messageResult.value);
      setPreviews((current) => ({ ...current, [key]: preview }));
    } else if (selectedKeyRef.current === key) {
      setMessagesStatus('error');
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

  React.useEffect(() => {
    if (!bypass || !selected) return;
    permissions
      .filter(
        (request) =>
          request.instanceId === selected.instanceId && request.sessionId === selected.sessionId
      )
      .forEach((request) => {
        const key = `${request.instanceId}:${request.id}`;
        if (bypassReplyIds.current.has(key)) return;
        bypassReplyIds.current.add(key);
        void handlePermission(request, 'once').finally(() => bypassReplyIds.current.delete(key));
      });
  }, [bypass, permissions, selected]);

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
      if (selectedKeyRef.current === key) {
        setMessages((prev) => (sameMessages(prev, next) ? prev : next));
      }
    } catch (err) {
      console.error('Abort refresh failed', err);
      showActionError(
        err instanceof Error ? err.message : 'Could not stop this agent.',
        () => void handleAbort()
      );
    }
  };

  const handleSettings = (
    patch: EmberSettingsPatch,
    options?: { preserveActionError?: boolean }
  ) => {
    if (!options?.preserveActionError) showActionError(null);
    const revision = ++settingsRevision.current;
    setSettings((prev) => ({ ...prev, ...patch }));
    void window.ember
      .setSettings(patch)
      .then((stored) => {
        if (settingsRevision.current === revision) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored });
        }
      })
      .catch(async (err) => {
        if (settingsRevision.current !== revision) return;
        showActionError(
          err instanceof Error ? err.message : 'Could not save settings.',
          () => handleSettings(patch, options)
        );
        try {
          const stored = await window.ember.getSettings();
          if (settingsRevision.current === revision) {
            setSettings({ ...DEFAULT_SETTINGS, ...stored });
          }
        } catch {}
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsByInstance, allocatedProjectColors, settings.projectColorAssignments]);

  React.useEffect(() => {
    if (readyIds.length === 0 || Object.keys(projectsByInstance).length === 0) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const results = await Promise.all(
          readyIds.map((instanceId) =>
            loadScheduledIdentityData(instanceId, projectsByInstance[instanceId] ?? [])
          )
        );
        if (cancelled) return;
        const discovered: Record<string, string> = Object.assign(
          {},
          ...results.map((result) => result.bindings)
        );
        const names: Record<string, string> = Object.assign(
          {},
          ...results.map((result) => result.taskNames)
        );
        setScheduledTaskNames(names);
        const merged: Record<string, string> = Object.fromEntries(
          Object.entries({ ...scheduledBindingsRef.current, ...discovered }).slice(-2000)
        );
        if (!sameStringRecord(merged, scheduledBindingsRef.current)) {
          scheduledBindingsRef.current = merged;
          handleSettings({ scheduledSessionBindings: merged });
        }
      } catch (err) {
        console.warn('Failed to load scheduled task identities', err);
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), SCHEDULE_POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey, projectsByInstance]);

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
        .filter(([key, draft]) => key.length > 0 && key.length <= 500 && draft.text.trim())
        .slice(-50)
        .map(([key, draft]) => [key, {
          text: draft.text.slice(0, 200_000),
          ...(draft.modelId ? { modelId: draft.modelId } : {}),
          ...(draft.variant ? { variant: draft.variant } : {}),
          ...(draft.mode ? { mode: draft.mode } : {}),
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
  const forSelected = <T extends { instanceId: string; sessionId: string }>(list: T[]): T[] =>
    selected
      ? list.filter(
          (request) =>
            request.instanceId === selected.instanceId && request.sessionId === selected.sessionId
        )
      : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedPermissions = React.useMemo(() => forSelected(permissions), [permissions, selected]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedQuestions = React.useMemo(() => forSelected(questions), [questions, selected]);

  React.useEffect(() => {
    if (!selectedKey) {
      lastStatusAnnouncementRef.current = null;
      setStatusAnnouncement('');
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
  }, [selectedKey, selectedSession, selectedState, selectedPermissions, selectedQuestions, selectedQueue]);

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
                if (selectedKey) {
                  setBypassOverrides((prev) => ({ ...prev, [selectedKey]: enabled }));
                }
              }}
              onNewSessionInstanceChange={setNewSessionInstanceId}
              onCreateSession={handleCreateSession}
              onCancelNewSession={() => setNewSessionInstanceId(null)}
              onSend={handleSend}
              onQueue={handleQueueMessage}
              onRemoveQueued={handleRemoveQueuedMessage}
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
