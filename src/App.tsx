import * as React from 'react';
import InstanceBar from './components/InstanceBar';
import LeftRail from './components/LeftRail';
import ChatView from './components/ChatView';
import SettingsPanel from './components/SettingsPanel';
import BlobShowcase from './blob/BlobShowcase';
import { applyTheme, DEFAULT_THEME_ID } from './themes';
import {
  createSession,
  listInstances,
  loadMessages,
  loadModels,
  loadModelMru,
  saveModelMru,
  loadProjects,
  loadSessionPreview,
  loadSessionStates,
  loadSessions,
  sendPrompt,
} from './api';
import type { BallState, ChatMessage, Instance, ModelOption, Project, Session } from './types';

export default function App() {
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [instanceId, setInstanceId] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [states, setStates] = React.useState<Record<string, BallState>>({});
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [defaultModelId, setDefaultModelId] = React.useState<string | null>(null);
  const [modelMru, setModelMru] = React.useState<string[]>([]);
  const [firstPromptBySession, setFirstPromptBySession] = React.useState<Record<string, string>>({});
  const [showcaseOpen, setShowcaseOpen] = React.useState(false);
  const [themeId, setThemeId] = React.useState<string>(DEFAULT_THEME_ID);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const instance = instances.find((entry) => entry.id === instanceId) ?? null;

  const sessionSeeds = React.useMemo(() => {
    const map: Record<string, string> = {};
    sessions.forEach((session) => {
      map[session.id] = firstPromptBySession[session.id] ?? session.id;
    });
    return map;
  }, [sessions, firstPromptBySession]);

  React.useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const [list, current] = await Promise.all([listInstances(), window.ember.windowInstance()]);
      if (cancelled) return;
      setInstances(list);
      if (current) setInstanceId(current);
    };

    void bootstrap();
    const unsubscribe = window.ember.onInstanceChanged((next) => setInstanceId(next));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;

    const load = async () => {
      const [theme, nextProjects, nextSessions, modelList] = await Promise.all([
        window.ember.getTheme(instanceId),
        loadProjects(instanceId),
        loadSessions(instanceId),
        loadModels(instanceId),
      ]);
      if (cancelled) return;
      setThemeId(theme || DEFAULT_THEME_ID);
      setProjects(nextProjects);
      setSessions(nextSessions);
      setModels(modelList.models);
      setDefaultModelId(modelList.defaultModelId);
      setModelMru(await loadModelMru(instanceId));
      setPreviews({});
      setSelectedSessionId(null);
      setMessages([]);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  React.useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;

    const poll = async () => {
      const nextStates = await loadSessionStates(instanceId);
      if (!cancelled) setStates(nextStates);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [instanceId]);

  React.useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;

    const targets = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .slice(0, 20)
      .filter((session) => !(session.id in previews));

    if (targets.length === 0) return;

    const load = async () => {
      const entries = await Promise.all(
        targets.map(async (session) => {
          const preview = await loadSessionPreview(instanceId, session.id);
          return [session.id, preview] as const;
        })
      );
      if (cancelled) return;

      setPreviews((prev) => {
        const next: Record<string, string> = { ...prev };
        entries.forEach(([id, preview]) => {
          next[id] = preview;
        });
        return next;
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [instanceId, sessions]);

  React.useEffect(() => {
    if (!instanceId || !selectedSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;

    void loadMessages(instanceId, selectedSessionId).then((next) => {
      if (!cancelled) {
        setMessages(next);
        const firstUser = next.find((message) => message.role === 'user');
        if (firstUser) {
          setFirstPromptBySession((prev) =>
            prev[selectedSessionId] === firstUser.text
              ? prev
              : { ...prev, [selectedSessionId]: firstUser.text }
          );
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [instanceId, selectedSessionId]);

  const handleOpenInstance = (nextId: string, mode: 'replace' | 'new') => {
    void window.ember.openInstance(nextId, mode);
  };

  const refreshInstances = React.useCallback(async () => {
    setInstances(await listInstances());
  }, []);

  const handleNewAgent = async () => {
    if (!instanceId) return;
    const created = await createSession(instanceId, projects[0]?.path);
    if (!created) return;
    setSessions(await loadSessions(instanceId));
    setSelectedSessionId(created.id);
  };

  const handleSend = async (text: string, model: ModelOption | undefined, mode: string) => {
    if (!instanceId || !selectedSessionId) return;
    await sendPrompt(instanceId, selectedSessionId, text, model, mode);
    setMessages(await loadMessages(instanceId, selectedSessionId));
    setSessions(await loadSessions(instanceId));
    const preview = await loadSessionPreview(instanceId, selectedSessionId);
    setPreviews((prev) => ({ ...prev, [selectedSessionId]: preview }));

    const key = model ? `${model.providerID}/${model.modelID}` : '';
    if (key) {
      const next = [key, ...modelMru.filter((entry) => entry !== key)].slice(0, 8);
      setModelMru(next);
      void saveModelMru(instanceId, next);
    }
  };

  const handlePickTheme = (nextThemeId: string) => {
    setThemeId(nextThemeId);
    if (instanceId) void window.ember.setTheme(instanceId, nextThemeId);
  };

  return (
    <div className="app">
      <InstanceBar
        instances={instances}
        currentId={instanceId}
        onOpen={handleOpenInstance}
        onRefresh={() => void refreshInstances()}
      />

      <div className="body-row">
        <LeftRail
          projects={projects}
          sessions={sessions}
          states={states}
          previews={previews}
          seeds={sessionSeeds}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onNewAgent={() => void handleNewAgent()}
          onOpenSettings={() => setSettingsOpen(true)}
          onShowcase={() => setShowcaseOpen(true)}
        />

        <ChatView
          sessionId={selectedSessionId}
          sessionTitle={sessions.find((s) => s.id === selectedSessionId)?.title ?? selectedSessionId}
          seed={selectedSessionId ? (sessionSeeds[selectedSessionId] ?? selectedSessionId) : 'ember'}
          state={selectedSessionId ? (states[selectedSessionId] ?? 'idle') : 'idle'}
          messages={messages}
          models={models}
          defaultModelId={defaultModelId}
          mru={modelMru}
          onSend={(text, model, mode) => void handleSend(text, model, mode)}
        />
      </div>

      {settingsOpen ? (
        <SettingsPanel
          instance={instance}
          themeId={themeId}
          onPick={handlePickTheme}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {showcaseOpen ? <BlobShowcase onClose={() => setShowcaseOpen(false)} /> : null}
    </div>
  );
}
