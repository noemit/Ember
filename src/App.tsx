import * as React from 'react';
import InstanceBar from './components/InstanceBar';
import LeftRail from './components/LeftRail';
import ChatView from './components/ChatView';
import SettingsPanel from './components/SettingsPanel';
import { applyTheme, DEFAULT_THEME_ID } from './themes';
import {
  createSession,
  listInstances,
  loadMessages,
  loadModels,
  loadProjects,
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
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [themeId, setThemeId] = React.useState<string>(DEFAULT_THEME_ID);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const instance = instances.find((entry) => entry.id === instanceId) ?? null;

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
      const [theme, nextProjects, nextSessions, nextModels] = await Promise.all([
        window.ember.getTheme(instanceId),
        loadProjects(instanceId),
        loadSessions(instanceId),
        loadModels(instanceId),
      ]);
      if (cancelled) return;
      setThemeId(theme || DEFAULT_THEME_ID);
      setProjects(nextProjects);
      setSessions(nextSessions);
      setModels(nextModels);
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
    if (!instanceId || !selectedSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;

    void loadMessages(instanceId, selectedSessionId).then((next) => {
      if (!cancelled) setMessages(next);
    });

    return () => {
      cancelled = true;
    };
  }, [instanceId, selectedSessionId]);

  const handleOpenInstance = (nextId: string, mode: 'replace' | 'new') => {
    void window.ember.openInstance(nextId, mode);
  };

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
  };

  const handlePickTheme = (nextThemeId: string) => {
    setThemeId(nextThemeId);
    if (instanceId) void window.ember.setTheme(instanceId, nextThemeId);
  };

  return (
    <div className="app">
      <InstanceBar instances={instances} currentId={instanceId} onOpen={handleOpenInstance} />

      <div className="body-row">
        <LeftRail
          projects={projects}
          sessions={sessions}
          states={states}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onNewAgent={() => void handleNewAgent()}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <ChatView
          sessionId={selectedSessionId}
          messages={messages}
          models={models}
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
    </div>
  );
}
