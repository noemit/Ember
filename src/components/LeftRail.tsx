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
const LIMIT = 10;

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

  // Top 10 most recent sessions across all projects
  const recentSessions = React.useMemo(() => {
    return sortedSessions.slice(0, LIMIT);
  }, [sortedSessions]);

  // All loose/unassigned sessions (no directory match to a project)
  const looseSessions = React.useMemo(() => {
    return sortedSessions.filter((session) => {
      const directory = session.directory ? normalizeDir(session.directory) : '';
      const hasMatch = projects.some((project) => {
        if (!project.path) return false;
        const base = normalizeDir(project.path);
        return directory === base || directory.startsWith(`${base}/`);
      });
      return !hasMatch;
    });
  }, [sortedSessions, projects]);

  // Group sessions by project path prefix, limiting each folder to top 10
  const projectGroups = React.useMemo(() => {
    const byProject = new Map<string, Session[]>();

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

      if (bestId) {
        const list = byProject.get(bestId) ?? [];
        if (list.length < LIMIT) {
          byProject.set(bestId, [...list, session]);
        }
      }
    });

    // Show all projects in the rail, even empty ones
    const result: Group[] = projects.map((project) => ({
      key: project.id,
      label: project.name,
      sessions: byProject.get(project.id) ?? [],
    }));

    // Sort folders by most recent activity within them (or name if sorter is name)
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

  const renderSectionHeader = (label: string, count: number, key: string) => (
    <button
      className="project-header"
      onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }))}
    >
      <span>{collapsed[key] ? '▸' : '▾'}</span>
      <span className="project-name">{label}</span>
      <span className="instance-meta">{count}</span>
    </button>
  );

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
        {/* Recent Section: Top 10 sessions across all folders */}
        {recentSessions.length > 0 && (
          <div className="project">
            {renderSectionHeader('Recent', recentSessions.length, '__recent')}
            {collapsed['__recent'] ? null : (
              <div className="session-list">{recentSessions.map(renderSession)}</div>
            )}
          </div>
        )}

        {/* Chats Section: Sessions without matching project folder (top 10) */}
        {looseSessions.length > 0 && (
          <div className="project">
            {renderSectionHeader('Chats', looseSessions.length, '__chats')}
            {collapsed['__chats'] ? null : (
              <div className="session-list">{looseSessions.slice(0, LIMIT).map(renderSession)}</div>
            )}
          </div>
        )}

        {/* Project Folders */}
        {projectGroups.map((group) => (
          <div className="project" key={group.key}>
            {renderSectionHeader(group.label, group.sessions.length, group.key)}
            {collapsed[group.key] ? null : (
              <div className="session-list">
                {group.sessions.map(renderSession)}
              </div>
            )}
          </div>
        ))}

        {projects.length === 0 && sessions.length === 0 ? (
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
