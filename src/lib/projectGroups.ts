import { projectForSession, projectIdentityKey } from '../blob/seed';
import { sessionKey } from '../types';
import type { Project, Session } from '../types';

export type ProjectEntry = {
  kind: 'project';
  /** `projectIdentityKey(instanceId, project.id)`. */
  id: string;
  instanceId: string;
  project: Project;
  /** Active sessions in the project, most recent first. */
  sessions: Session[];
  /** Most recent session activity, or the project's last-opened time when empty. */
  updated: number;
};

export type SessionEntry = {
  kind: 'session';
  /** `sessionKey(session)`. */
  id: string;
  session: Session;
  updated: number;
};

export type RailEntry = ProjectEntry | SessionEntry;

const byRecency = (a: Session, b: Session) => (b.updated ?? 0) - (a.updated ?? 0);

const nameOf = (entry: RailEntry): string =>
  entry.kind === 'project' ? entry.project.name : entry.session.title ?? entry.session.id;

/**
 * Builds the rail's single recency-ordered list. Sessions that sit inside a configured project
 * (`projectForSession`) group under that project's card; everything else stays a standalone row.
 * Project cards and standalone rows interleave by most-recent activity.
 *
 * Only projects that own at least one of the given sessions appear: an empty project has nothing
 * to open, and starting one is the New-agent flow's job. The archive screen groups archived
 * sessions the same way.
 */
export const buildRailEntries = (
  sessions: Session[],
  projectsByInstance: Record<string, Project[]>
): RailEntry[] => {
  const projects = new Map<string, ProjectEntry>();
  const standalone: SessionEntry[] = [];

  sessions.forEach((session) => {
    const project = projectForSession(session, projectsByInstance[session.instanceId] ?? []);
    if (project) {
      const id = projectIdentityKey(session.instanceId, project.id);
      const existing = projects.get(id);
      if (existing) existing.sessions.push(session);
      else {
        projects.set(id, {
          kind: 'project',
          id,
          instanceId: session.instanceId,
          project,
          sessions: [session],
          updated: session.updated ?? 0,
        });
      }
    } else {
      standalone.push({
        kind: 'session',
        id: sessionKey(session),
        session,
        updated: session.updated ?? 0,
      });
    }
  });

  const entries: RailEntry[] = [...projects.values(), ...standalone];
  entries.forEach((entry) => {
    if (entry.kind !== 'project') return;
    entry.sessions.sort(byRecency);
    entry.updated = entry.sessions[0]?.updated ?? 0;
  });
  entries.sort((a, b) => {
    if (b.updated !== a.updated) return b.updated - a.updated;
    return nameOf(a).localeCompare(nameOf(b)) || a.id.localeCompare(b.id);
  });
  return entries;
};

export type BlobStrip = {
  size: number;
  /** How many blobs to draw; the rest are represented by `overflow`. */
  visible: number;
  overflow: number;
};

/**
 * How a project card's blob strip lays out: full size for a handful, shrinking toward `minSize`
 * as the count grows, and a `+N` overflow chip once even the minimum size no longer fits.
 */
export const blobStripLayout = (
  count: number,
  availableWidth: number,
  maxSize = 30,
  minSize = 18,
  gap = 4
): BlobStrip => {
  if (count <= 0) return { size: maxSize, visible: 0, overflow: 0 };
  const size = count <= 4 ? maxSize : Math.max(minSize, maxSize - (count - 4) * 2);
  let visible = count;
  while (visible > 1) {
    const overflow = count - visible;
    const chipWidth = overflow > 0 ? Math.max(size, 22) : 0;
    const total =
      visible * size + (visible - 1) * gap + (overflow > 0 ? gap + chipWidth : 0);
    if (total <= availableWidth) break;
    visible -= 1;
  }
  return { size, visible, overflow: count - visible };
};

/**
 * Where a session's notes live. A session inside a configured project shares its notes with every
 * other session in that project (so a note saved in one shows up in them all); a standalone session
 * keeps its own notes under its session key.
 */
export const notesKeyForSession = (session: Session, projects: Project[]): string => {
  const project = projectForSession(session, projects);
  return project ? projectIdentityKey(session.instanceId, project.id) : sessionKey(session);
};
