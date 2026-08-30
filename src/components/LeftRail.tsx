import * as React from 'react';
import GemBlob from '../blob/GemBlob';
import type { BallState, Project, Session } from '../types';

type Props = {
  projects: Project[];
  sessions: Session[];
  states: Record<string, BallState>;
  previews: Record<string, string>;
  seeds: Record<string, string>;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewAgent: () => void;
  onOpenSettings: () => void;
  onShowcase: () => void;
};

type Sorter = 'recent' | 'name';

type Group = {
  key: string;
  label: string;
  sessions: Session[];
};

const normalizeDir = (value: string): string => value.replace(/\/+$/, '');

export default function LeftRail({
  projects,
  sessions,
  states,
  previews,
  seeds,
  selectedSessionId,
  onSelectSession,
  onNewAgent,
  onOpenSettings,
  onShowcase,
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

  const groups = React.useMemo(() => {
    const byProject = new Map<string, Session[]>();
    const loose: Session[] = [];

    sortedSessions.forEach((session) => {
      const directory = session.directory ? normalizeDir(session.directory) : '';
      let bestId: string | null = null;
      let bestLength = -1;

      projects.forEach((project) => {
        if (!project.path) return;
        const base = normalizeDir(project.path);
        if (directory === base || directory.startsWith(`${base}/`)) {
          if (base.length > bestLength) {
            bestLength = base.length;
            bestId = project.id;
          }
        }
      });

      if (bestId) byProject.set(bestId, [...(byProject.get(bestId) ?? []), session]);
      else loose.push(session);
    });

    const result: Group[] = projects
      .filter((project) => (byProject.get(project.id) ?? []).length > 0)
      .map((project) => ({
        key: project.id,
        label: project.name,
        sessions: byProject.get(project.id) ?? [],
      }));

    if (loose.length > 0) result.push({ key: '__other', label: 'Other', sessions: loose });

    result.sort((a, b) => {
      if (sorter === 'name') {
        return a.label.localeCompare(b.label);
      }
      const aMax = Math.max(0, ...a.sessions.map((s) => s.updated ?? 0));
      const bMax = Math.max(0, ...b.sessions.map((s) => s.updated ?? 0));
      return bMax - aMax;
    });

    return result;
  }, [sortedSessions, projects, sorter]);

  const renderSession = (session: Session) => (
    <button
      className="session"
      key={session.id}
      data-selected={session.id === selectedSessionId}
      onClick={() => onSelectSession(session.id)}
    >
      <GemBlob
        seed={seeds[session.id] ?? session.id}
        size={32}
        state={states[session.id] ?? 'idle'}
      />
      <span className="session-text">
        <span className="session-title">{session.title ?? session.id}</span>
        <span className="session-preview">{previews[session.id] ?? ''}</span>
      </span>
    </button>
  );

  const renderGroup = (group: Group) => {
    const isCollapsed = collapsed[group.key] ?? false;

    return (
      <div className="project" key={group.key}>
        <button
          className="project-header"
          onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isCollapsed }))}
        >
          <span>{isCollapsed ? '▸' : '▾'}</span>
          <span className="project-name">{group.label}</span>
          <span className="instance-meta">{group.sessions.length}</span>
        </button>
        {isCollapsed ? null : <div className="session-list">{group.sessions.map(renderSession)}</div>}
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
        {groups.map(renderGroup)}

        {groups.length === 0 ? (
          <div className="instance-meta" style={{ padding: 8 }}>
            No projects or sessions yet.
          </div>
        ) : null}
      </div>

      <div className="rail-bottom">
        <button className="icon-button" onClick={onShowcase}>
          Blobs
        </button>
        <button className="icon-button" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}
