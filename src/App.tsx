import * as React from 'react';
import InstanceBar from './components/InstanceBar';
import LeftRail from './components/LeftRail';
import ChatView from './components/ChatView';
import SettingsPanel from './components/SettingsPanel';
import BlobShowcase from './blob/BlobShowcase';
import { TooltipProvider } from '@/components/ui/tooltip';
import { applyTheme, DEFAULT_THEME_ID } from './themes';
import {
  createSession,
  listInstances,
  loadAllProjects,
  loadAllSessions,
  loadAllSessionStates,
  loadMessages,
  loadModelMru,
  loadModels,
  loadSessionPreview,
  loadSessions,
  saveModelMru,
  sendPrompt,
  type ModelList,
} from './api';
import { sessionKey } from './types';
import type {
  BallState,
  ChatMessage,
  EmberSettings,
  Instance,
  ModelOption,
  Project,
  Session,
  SessionRef,
} from './types';

const STATE_POLL_MS = 3000;
const SESSION_POLL_MS = 10_000;
const PREVIEW_COUNT = 24;

const DEFAULT_SETTINGS: EmberSettings = { theme: DEFAULT_THEME_ID, blobStyle: 'grok' };

const sameMessages = (a: ChatMessage[], b: ChatMessage[]): boolean =>
  a.length === b.length && a.every((m, i) => m.id === b[i].id && m.text === b[i].text);

export default function App() {
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [projectsByInstance, setProjectsByInstance] = React.useState<Record<string, Project[]>>({});
  const [sessionsByInstance, setSessionsByInstance] = React.useState<Record<string, Session[]>>({});
  const [statesByInstance, setStatesByInstance] = React.useState<
    Record<string, Record<string, BallState>>
  >({});
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState<SessionRef | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [modelsByInstance, setModelsByInstance] = React.useState<Record<string, ModelList>>({});
  const [mruByInstance, setMruByInstance] = React.useState<Record<string, string[]>>({});
  const [firstPromptByKey, setFirstPromptByKey] = React.useState<Record<string, string>>({});
  const [settings, setSettings] = React.useState<EmberSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [showcaseOpen, setShowcaseOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const readyIds = React.useMemo(
    () => instances.filter((instance) => instance.attachable).map((instance) => instance.id),
    [instances]
  );
  // Stable key so effects re-run only when the set of connected instances changes.
  const readyKey = readyIds.join('\u0000');

  const sessions = React.useMemo(
    () =>
      Object.entries(sessionsByInstance)
        .filter(([instanceId]) => readyIds.includes(instanceId) && !hidden.has(instanceId))
        .flatMap(([, list]) => list),
    [sessionsByInstance, readyIds, hidden]
  );

  const states = React.useMemo(
    () => Object.assign({}, ...Object.values(statesByInstance)) as Record<string, BallState>,
    [statesByInstance]
  );

  // Seeds cover every known session (not just visible ones) so an open chat keeps
  // its blob when its instance is filtered out of the rail.
  const seeds = React.useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(sessionsByInstance).forEach((list) =>
      list.forEach((session) => {
        const key = sessionKey(session);
        map[key] = firstPromptByKey[key] ?? session.id;
      })
    );
    return map;
  }, [sessionsByInstance, firstPromptByKey]);

  const selectedKey = selected ? sessionKey(selected) : null;
  const selectedSession = selected
    ? (sessionsByInstance[selected.instanceId] ?? []).find((s) => s.id === selected.sessionId) ?? null
    : null;
  const selectedInstance = selected
    ? instances.find((instance) => instance.id === selected.instanceId) ?? null
    : null;

  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const refreshInstances = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setInstances(await listInstances());
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, list] = await Promise.all([window.ember.getSettings(), listInstances()]);
      if (cancelled) return;
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
      setInstances(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-instance data that rarely changes: projects, models, MRU.
  React.useEffect(() => {
    if (readyIds.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      const [projects, modelLists, mrus] = await Promise.all([
        loadAllProjects(readyIds),
        Promise.all(readyIds.map(async (id) => [id, await loadModels(id)] as const)),
        Promise.all(readyIds.map(async (id) => [id, await loadModelMru(id)] as const)),
      ]);
      if (cancelled) return;
      setProjectsByInstance(projects);
      setModelsByInstance(Object.fromEntries(modelLists));
      setMruByInstance(Object.fromEntries(mrus));
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

    const poll = async () => {
      const next = await loadAllSessions(readyIds);
      if (cancelled) return;
      setSessionsByInstance((prev) => ({ ...prev, ...next }));
      setLoading(false);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), SESSION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  React.useEffect(() => {
    if (readyIds.length === 0) return;
    let cancelled = false;

    const poll = async () => {
      const next = await loadAllSessionStates(readyIds);
      if (!cancelled) setStatesByInstance((prev) => ({ ...prev, ...next }));
    };

    void poll();
    const timer = window.setInterval(() => void poll(), STATE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  React.useEffect(() => {
    const targets = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .slice(0, PREVIEW_COUNT)
      .filter((session) => !(sessionKey(session) in previews));
    if (targets.length === 0) return;
    let cancelled = false;

    void (async () => {
      const entries = await Promise.all(
        targets.map(
          async (session) =>
            [sessionKey(session), await loadSessionPreview(session.instanceId, session.id)] as const
        )
      );
      if (cancelled) return;
      setPreviews((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();

    return () => {
      cancelled = true;
    };
  }, [sessions, previews]);

  // Messages for the open session, kept fresh while the agent is working.
  React.useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const key = sessionKey(selected);

    const load = async () => {
      const next = await loadMessages(selected.instanceId, selected.sessionId);
      if (cancelled) return;
      setMessages((prev) => (sameMessages(prev, next) ? prev : next));
      const last = next[next.length - 1];
      if (last) {
        const preview = last.text.replace(/\s+/g, ' ').trim().slice(0, 160);
        setPreviews((prev) => (prev[key] === preview ? prev : { ...prev, [key]: preview }));
      }
      const firstUser = next.find((message) => message.role === 'user');
      if (firstUser) {
        setFirstPromptByKey((prev) =>
          prev[key] === firstUser.text ? prev : { ...prev, [key]: firstUser.text }
        );
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), STATE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selected]);

  const toggleInstance = (instanceId: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });

  const handleNewAgent = async (instanceId: string) => {
    const created = await createSession(instanceId, projectsByInstance[instanceId]?.[0]?.path);
    if (!created) return;
    setSessionsByInstance((prev) => ({
      ...prev,
      [instanceId]: [created, ...(prev[instanceId] ?? [])],
    }));
    setHidden((prev) => {
      if (!prev.has(instanceId)) return prev;
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });
    setSelected({ instanceId, sessionId: created.id });
    const fresh = await loadSessions(instanceId);
    if (fresh) setSessionsByInstance((prev) => ({ ...prev, [instanceId]: fresh }));
  };

  const handleSend = async (text: string, model: ModelOption | undefined, mode: string) => {
    if (!selected) return;
    const { instanceId, sessionId } = selected;
    const key = sessionKey(selected);
    setSending(true);
    try {
      await sendPrompt(instanceId, sessionId, text, model, mode);
      const [next, preview] = await Promise.all([
        loadMessages(instanceId, sessionId),
        loadSessionPreview(instanceId, sessionId),
      ]);
      setMessages(next);
      setPreviews((prev) => ({ ...prev, [key]: preview }));
      setSessionsByInstance((prev) => ({
        ...prev,
        [instanceId]: (prev[instanceId] ?? []).map((session) =>
          session.id === sessionId ? { ...session, updated: Date.now() } : session
        ),
      }));
    } finally {
      setSending(false);
    }

    if (model) {
      const modelKey = `${model.providerID}/${model.modelID}`;
      const current = mruByInstance[instanceId] ?? [];
      const next = [modelKey, ...current.filter((entry) => entry !== modelKey)].slice(0, 8);
      setMruByInstance((prev) => ({ ...prev, [instanceId]: next }));
      void saveModelMru(instanceId, next);
    }
  };

  const handleSettings = (patch: Partial<EmberSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    void window.ember.setSettings(patch);
  };

  const selectedModels = selected ? modelsByInstance[selected.instanceId] : undefined;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <InstanceBar
          instances={instances}
          hidden={hidden}
          refreshing={refreshing}
          onToggle={toggleInstance}
          onRefresh={() => void refreshInstances()}
        />

        <div className="flex min-h-0 flex-1">
          <LeftRail
            instances={instances}
            projectsByInstance={projectsByInstance}
            sessions={sessions}
            states={states}
            previews={previews}
            seeds={seeds}
            selectedKey={selectedKey}
            blobStyle={settings.blobStyle}
            loading={loading}
            onSelectSession={(session) =>
              setSelected({ instanceId: session.instanceId, sessionId: session.id })
            }
            onNewAgent={(instanceId) => void handleNewAgent(instanceId)}
            onOpenSettings={() => setSettingsOpen(true)}
            onShowcase={() => setShowcaseOpen(true)}
          />

          <ChatView
            session={selectedSession}
            instance={selectedInstance}
            seed={selectedKey ? seeds[selectedKey] ?? selected?.sessionId ?? '' : ''}
            state={selectedKey ? states[selectedKey] ?? 'idle' : 'idle'}
            blobStyle={settings.blobStyle}
            messages={messages}
            models={selectedModels?.models ?? []}
            defaultModelId={selectedModels?.defaultModelId ?? null}
            mru={selected ? mruByInstance[selected.instanceId] ?? [] : []}
            sending={sending}
            onSend={(text, model, mode) => void handleSend(text, model, mode)}
          />
        </div>

        <SettingsPanel
          open={settingsOpen}
          settings={settings}
          onChange={handleSettings}
          onOpenChange={setSettingsOpen}
        />

        <BlobShowcase open={showcaseOpen} blobStyle={settings.blobStyle} onOpenChange={setShowcaseOpen} />
      </div>
    </TooltipProvider>
  );
}
