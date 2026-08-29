import * as React from 'react';
import AgentBall from './AgentBall';
import type { BallState, Project, Session } from '../types';

type Props = {
  projects: Project[];
  sessions: Session[];
  states: Record<string, BallState>;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewAgent: () => void;
  onOpenSettings: () => void;
};

type Sorter = 'recent' | 'name';

export default function LeftRail({
  projects,
  sessions,
  states,
  selectedSessionId,
  onSelectSession,
  onNewAgent,
  onOpenSettings,
}: Props) {
  const [sorter, setSorter] = React.useState<Sorter>('recent');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const sortedSessions = React.useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) =>
      sorter === 'name'
        ? (a.title ?? a.id).localeCompare(b.title ?? b.id)
        : (b.updated ?? 0) - (a.updated ?? 0)
    );
    return copy;
  }, [sessions, sorter]);

  const sortedProjects = React.useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  const grouped = React.useMemo(() => {
    const byProject = new Map<string, Session[]>();
    const loose: Session[] = [];

    sortedSessions.forEach((session) => {
      const project = projects.find(
        (candidate) => candidate.path && candidate.path === session.directory
      );
      if (project) {
        byProject.set(project.id, [...(byProject.get(project.id) ?? []), session]);
      } else {
        loose.push(session);
      }
    });

    return { byProject, loose };
  }, [sortedSessions, projects]);

  const renderSession = (session: Session) => (
    <button
      className="session"
      key={session.id}
      data-selected={session.id === selectedSessionId}
      onClick={() => onSelectSession(session.id)}
    >
      <AgentBall state={states[session.id] ?? 'idle'} />
      <span className="session-title">{session.title ?? session.id}</span>
    </button>
  );

  const renderProject = (project: Project) => {
    const items = grouped.byProject.get(project.id) ?? [];
    const isCollapsed = collapsed[project.id] ?? false;

    return (
      <div className="project" key={project.id}>
        <button
          className="project-header"
          onClick={() => setCollapsed((prev) => ({ ...prev, [project.id]: !isCollapsed }))}
        >
          <span>{isCollapsed ? '▸' : '▾'}</span>
          <span className="project-name">{project.name}</span>
          <span className="instance-meta">{items.length}</span>
        </button>
        {isCollapsed ? null : <div className="session-list">{items.map(renderSession)}</div>}
      </div>
    );
  };

  return (
    <div className="rail">
      <div className="rail-top">
        <button className="primary-button" onClick={onNewAgent}>
          + New agent
        </button>
        <select
          className="sorter"
          value={sorter}
          onChange={(event) => setSorter(event.target.value as Sorter)}
        >
          <option value="recent">Sort: recent activity</option>
          <option value="name">Sort: name</option>
        </select>
      </div>

      <div className="rail-list">
        {sortedProjects.map(renderProject)}

        {grouped.loose.length > 0 ? (
          <div className="project">
            <div className="project-header">
              <span>▾</span>
              <span className="project-name">Other</span>
              <span className="instance-meta">{grouped.loose.length}</span>
            </div>
            <div className="session-list">{grouped.loose.map(renderSession)}</div>
          </div>
        ) : null}

        {sortedProjects.length === 0 && grouped.loose.length === 0 ? (
          <div className="instance-meta" style={{ padding: 8 }}>
            No projects or sessions yet.
          </div>
        ) : null}
      </div>

      <div className="rail-bottom">
        <button className="icon-button" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}
