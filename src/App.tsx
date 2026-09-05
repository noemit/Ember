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
  errorMessageOf,
  listInstances,
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
  EmberSettings,
  EmberSettingsPatch,
  Instance,
  PermissionReply,
  PermissionRequest,
  Project,
  QuestionAnswers,
  QuestionRequest,
  Session,
  SessionRef,
  NewSessionOptions,
} from './types';

const SettingsPanel = React.lazy(() => import('./components/SettingsPanel'));
const AvatarPicker = React.lazy(() => import('./components/AvatarPicker'));

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
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [previewVersions, setPreviewVersions] = React.useState<Record<string, number | undefined>>({});
  const [selected, setSelected] = React.useState<SessionRef | null>(null);
  const [newSessionInstanceId, setNewSessionInstanceId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = React.useState<MessagesStatus>('ready');
  const [modelsByInstance, setModelsByInstance] = React.useState<Record<string, ModelList>>({});
  const [scheduledTaskNames, setScheduledTaskNames] = React.useState<Record<string, string>>({});
  const [settings, setSettings] = React.useState<EmberSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [sendingKeys, setSendingKeys] = React.useState<Set<string>>(() => new Set());
  const [reloadingKeys, setReloadingKeys] = React.useState<Set<string>>(() => new Set());
  const [bypassOverrides, setBypassOverrides] = React.useState<Record<string, boolean>>({});
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsActivated, setSettingsActivated] = React.useState(false);
  const [avatarPickerSession, setAvatarPickerSession] = React.useState<Session | null>(null);
  const [settingsView, setSettingsView] = React.useState<'general' | 'instances'>('general');
  const [showArchived, setShowArchived] = React.useState(false);
  const [showScheduled, setShowScheduled] = React.useState(false);
  const [mobileRailOpen, setMobileRailOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileRailOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileRailOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileRailOpen]);

  // Keep a live ref to the selected session so pollers can read its
  // directory (for routing) without re-running the effect on every session list refresh.
  const selectedSessionRef = React.useRef<Session | null>(null);
  const selectedKeyRef = React.useRef<string | null>(null);
  const pendingCreatedSessions = React.useRef(new Map<string, { session: Session; expiresAt: number }>());
  const pendingOptimisticIds = React.useRef(new Set<string>());
  const bypassReplyIds = React.useRef(new Set<string>());
  const settingsRevision = React.useRef(0);
  const scheduledBindingsRef = React.useRef<Record<string, string>>({});

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
    setActionError(null);
    try {
      setInstances(await listInstances());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reprobe instances.');
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
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setActionError(err instanceof Error ? err.message : 'Ember could not finish starting.');
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
          setActionError(err instanceof Error ? err.message : 'Could not load instance metadata.');
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
        const [nextStates, nextPermissions, nextQuestions] = await Promise.all([
          loadAllSessionStates(readyIds),
          loadAllPermissions(readyIds),
          loadAllQuestions(readyIds, directoryHints),
        ]);
        if (cancelled) return;
        setStatesByInstance((prev) => ({ ...prev, ...nextStates }));
        setPermissionsByInstance((prev) => ({ ...prev, ...nextPermissions }));
        setQuestionsByInstance((prev) => ({ ...prev, ...nextQuestions }));
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
    setActionError(null);
    setSelected(null);
    setNewSessionInstanceId(instanceId);
  };

  const handleCreateSession = async (options: NewSessionOptions): Promise<boolean> => {
    setActionError(null);
    try {
      const created = await createSession(options.instanceId, options.directory);
      if (!created) {
        setActionError('Could not create a new agent.');
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
      setActionError(err instanceof Error ? err.message : 'Could not create a new agent.');
      return false;
    }
  };

  const handleSend = async (input: PromptInput) => {
    if (!selected) return;
    setActionError(null);
    const { instanceId, sessionId } = selected;
    const { model, text, attachments = [] } = input;
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
      model: model ? { providerID: model.providerID, modelID: model.modelID } : undefined,
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
        setActionError(responseError(sent.data, 'Message could not be sent.'));
        return;
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
                model: model ? { providerID: model.providerID, modelID: model.modelID } : session.model,
              }
            : session
        ),
      }));
      const next = await loadMessages(instanceId, sessionId, directory);
      const preview = previewOf(next);
      if (selectedKeyRef.current === key) setMessages(next);
      setPreviews((prev) => ({ ...prev, [key]: preview }));
      setPreviewVersions((prev) => ({ ...prev, [key]: updated }));
    } catch (err) {
      console.error('Send failed', err);
      if (!accepted) removeOptimistic();
      setActionError(
        accepted
          ? 'Message was sent, but the transcript could not be refreshed yet.'
          : err instanceof Error
            ? err.message
            : 'Message could not be sent.'
      );
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

  const handleReloadSession = async (session: Session) => {
    const key = sessionKey(session);
    if (reloadingKeys.has(key)) return;
    setActionError(null);
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
      setActionError('Some session data could not be refreshed. Ember will keep retrying.');
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
    setActionError(null);
    try {
      const ok = await setSessionArchived(session, archived);
      if (!ok) {
        setActionError(archived ? 'Could not archive this session.' : 'Could not restore this session.');
        return;
      }
      setSessionsByInstance((prev) => ({
        ...prev,
        [session.instanceId]: (prev[session.instanceId] ?? []).map((entry) =>
          entry.id === session.id ? { ...entry, archived: archived ? Date.now() : undefined } : entry
        ),
      }));
      if (selectedKey === sessionKey(session)) setSelected(null);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : archived
            ? 'Could not archive this session.'
            : 'Could not restore this session.'
      );
    }
  };

  // Drop the card as soon as the server accepts the reply; the next poll is authoritative.
  const handlePermission = async (
    request: PermissionRequest,
    reply: PermissionReply
  ): Promise<boolean> => {
    setActionError(null);
    try {
      const directory = (sessionsByInstance[request.instanceId] ?? []).find(
        (session) => session.id === request.sessionId
      )?.directory;
      const ok = await replyPermission(request, reply, directory);
      if (!ok) {
        setActionError('Could not reply to this permission request.');
        return false;
      }
      setPermissionsByInstance((prev) => ({
        ...prev,
        [request.instanceId]: (prev[request.instanceId] ?? []).filter((entry) => entry.id !== request.id),
      }));
      return true;
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not reply to this permission request.'
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
    setActionError(null);
    try {
      const directory = sessionDirectory(request.instanceId, request.sessionId);
      const ok = answers
        ? await replyQuestion(request, answers, directory)
        : await rejectQuestion(request, directory);
      if (!ok) {
        setActionError(answers ? 'Could not submit this answer.' : 'Could not dismiss this question.');
        return false;
      }
      dropQuestion(request);
      return true;
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : answers
            ? 'Could not submit this answer.'
            : 'Could not dismiss this question.'
      );
      return false;
    }
  };

  const handleAbort = async () => {
    if (!selectedSession) return;
    setActionError(null);
    const key = sessionKey(selectedSession);
    try {
      const aborted = await abortSession(selectedSession);
      if (!aborted) {
        setActionError('Could not stop this agent.');
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
      setActionError(err instanceof Error ? err.message : 'Could not stop this agent.');
    }
  };

  const handleSettings = (patch: EmberSettingsPatch) => {
    setActionError(null);
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
        setActionError(err instanceof Error ? err.message : 'Could not save settings.');
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

  const handleSessionNote = (note: string) => {
    if (!selectedKey) return;
    const sessionNotes = { ...settings.sessionNotes };
    if (note) sessionNotes[selectedKey] = note.slice(0, 20_000);
    else delete sessionNotes[selectedKey];
    handleSettings({ sessionNotes });
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

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col">
          <InstanceBar
            instances={instances}
            hidden={hidden}
            refreshing={refreshing}
            onToggle={toggleInstance}
            onToggleNavigation={() => setMobileRailOpen((open) => !open)}
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
              reloading={selectedKey ? reloadingKeys.has(selectedKey) : false}
              bypass={bypass}
              pinnedMessageIds={pinnedMessageIds}
              sessionNote={selectedKey ? settings.sessionNotes[selectedKey] ?? '' : ''}
              onTogglePin={handleTogglePin}
              onSessionNoteChange={handleSessionNote}
              onBypassChange={(enabled) => {
                if (selectedKey) {
                  setBypassOverrides((prev) => ({ ...prev, [selectedKey]: enabled }));
                }
              }}
              onNewSessionInstanceChange={setNewSessionInstanceId}
              onCreateSession={handleCreateSession}
              onCancelNewSession={() => setNewSessionInstanceId(null)}
              onSend={(input) => void handleSend(input)}
              onReload={() => {
                if (selectedSession) void handleReloadSession(selectedSession);
              }}
              onAbort={() => void handleAbort()}
              onPermission={handlePermission}
              onQuestion={handleQuestion}
            />
          </div>

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

          {actionError ? (
            <div
              role="alert"
              className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[100] flex max-w-[420px] items-start gap-3 rounded-lg border border-destructive/40 bg-popover px-3 py-2.5 text-[12px] shadow-lg sm:left-auto"
            >
              <span className="min-w-0 flex-1">{actionError}</span>
              <button
                type="button"
                className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"
                onClick={() => setActionError(null)}
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
