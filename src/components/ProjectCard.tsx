import * as React from 'react';
import { motion } from 'motion/react';
import { Archive, Box, Pin, Plus } from 'lucide-react';
import Blob from '../blob/Blob';
import { blobStripLayout } from '@/lib/projectGroups';
import { ARCHIVE_AGE_OPTIONS, bulkArchiveTargets } from '@/lib/bulkArchive';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SessionContextMenuContent } from './SessionRow';
import ProjectCleanupMenu from './ProjectCleanupMenu';
import { sessionKey } from '../types';
import type { AvatarIdentity, BallMood, BlobStyle, Project, Session } from '../types';

// The rail is 320px wide; strip sits inside px-1.5 rail + px-2 card padding.
const STRIP_WIDTH = 280;
// Each blob carries its title as a two-line chip beneath it (hard-clipped — no ellipsis).
const LABEL_WIDTH = 56;

type Props = {
  project: Project;
  instanceId: string;
  instanceLabel: string | undefined;
  markerColor: number | undefined;
  sessions: Session[];
  moods: Record<string, BallMood>;
  /** Session keys shown as workspace columns; each visible blob gets an underline. */
  visibleKeys: Set<string>;
  avatarIdentities: Record<string, AvatarIdentity>;
  blobStyle: BlobStyle;
  reloadingKeys: Set<string>;
  archivingKeys: Set<string>;
  /** Session key → pinned-message count, for the blob badges. */
  pinnedCounts: Record<string, number>;
  /** Opens every session in this project (most recent as columns, the rest as tabs). */
  onOpenProject: () => void;
  /** Opens just the clicked session, adding it to the current workspace. */
  onOpenSession: (session: Session) => void;
  onNewAgent: (instanceId: string, directory?: string) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  /** Bulk archive from the `+N` menu; one notice/undo covers the whole batch. */
  onArchiveMany: (sessions: Session[]) => void;
  onCustomizeAppearance: (session: Session) => void;
};

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

/**
 * A project with two or more sessions: its name, a `+` that starts a session in that project's
 * directory, and a strip of mood-carrying blobs. Clicking the project name/body opens every
 * session (most recent as columns, the rest as tabs); clicking an individual blob opens just that
 * session, adding it to the current workspace. Right-clicking a blob still offers the per-session
 * menu. One-session projects use a plain row.
 */
export default function ProjectCard({
  project,
  instanceId,
  instanceLabel,
  markerColor,
  sessions,
  moods,
  visibleKeys,
  avatarIdentities,
  blobStyle,
  reloadingKeys,
  archivingKeys,
  pinnedCounts,
  onOpenProject,
  onOpenSession,
  onNewAgent,
  onReload,
  onArchive,
  onArchiveMany,
  onCustomizeAppearance,
}: Props) {
  const layout = blobStripLayout(sessions.length, STRIP_WIDTH, 48, 30, 4, LABEL_WIDTH);
  const visible = sessions.slice(0, layout.visible);
  // Recomputed per render so the menu's counts stay current with the session list.
  const inactiveTargets = bulkArchiveTargets(sessions, moods, { now: Date.now() });

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={spring}
      role="button"
      tabIndex={0}
      aria-label={`Open ${project.name}`}
      onClick={onOpenProject}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenProject();
        }
      }}
      className="cursor-pointer rounded-lg border bg-card/40 px-2 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-highlight"
    >
      <div className="flex items-center gap-1.5 px-1">
        <span
          className="min-w-0 truncate text-[11.5px] font-semibold text-foreground"
          style={markerColor === undefined ? undefined : {
            textDecoration: 'underline',
            textDecorationColor: `var(--instance-marker-${markerColor})`,
            textDecorationThickness: '2px',
            textUnderlineOffset: '3px',
          }}
        >
          {project.name}
        </span>
        {instanceLabel ? (
          <span className="flex min-w-0 items-center gap-0.5 text-[10px] text-muted-foreground">
            <Box className="size-2.5 flex-none" aria-hidden="true" />
            <span className="truncate">{instanceLabel}</span>
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onNewAgent(instanceId, project.path);
              }}
              aria-label={`New session in ${project.name}`}
              className="ml-auto flex size-6 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">New session in {project.name}</TooltipContent>
        </Tooltip>
        <ProjectCleanupMenu name={project.name} sessions={sessions} moods={moods} onArchiveMany={onArchiveMany} />
      </div>
      <div className="mt-1 flex min-h-[30px] items-center px-1" style={{ gap: 4 }}>
        {visible.map((session) => {
          const key = sessionKey(session);
          const title = session.title ?? session.id;
          const visible = visibleKeys.has(key);
          return (
            <ContextMenu key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ContextMenuTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      data-session-key={key}
                      data-visible-column={visible ? 'true' : undefined}
                      className="relative flex flex-none cursor-pointer flex-col items-center rounded-md outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-1 focus-visible:ring-offset-card"
                      style={{ width: Math.max(layout.size, LABEL_WIDTH) }}
                      aria-label={title}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenSession(session);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.stopPropagation();
                          event.preventDefault();
                          onOpenSession(session);
                        }
                      }}
                    >
                      <span className="relative">
                        <Blob
                          style={blobStyle}
                          seed={key}
                          identity={avatarIdentities[key]}
                          size={layout.size}
                          mood={moods[key] ?? 'idle'}
                        />
                        {pinnedCounts[key] ? (
                          <span
                            className="pointer-events-none absolute -bottom-0.5 -left-0.5 flex size-3 items-center justify-center rounded-full bg-background text-highlight ring-1 ring-border"
                            title={`${pinnedCounts[key]} pinned message${pinnedCounts[key] === 1 ? '' : 's'}`}
                            aria-label={`${pinnedCounts[key]} pinned`}
                          >
                            <Pin className="size-1.5" />
                          </span>
                        ) : null}
                      </span>
                      <span data-blob-label className="mt-0.5 block max-h-[26px] w-full overflow-hidden text-center">
                        <span className="rounded-sm bg-muted px-1 py-px text-[10px] leading-[13px] break-words text-muted-foreground [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                          {title}
                        </span>
                      </span>
                      {visible ? (
                        <span
                          data-column-underline
                          aria-hidden="true"
                          className="pointer-events-none absolute -bottom-1 left-1/2 h-[3px] w-[55%] min-w-3 -translate-x-1/2 rounded-full bg-highlight"
                        />
                      ) : null}
                    </span>
                  </ContextMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">{title}</TooltipContent>
              </Tooltip>
              <SessionContextMenuContent
                session={session}
                reloading={reloadingKeys.has(key)}
                archiving={archivingKeys.has(key)}
                onReload={onReload}
                onArchive={onArchive}
                onCustomizeAppearance={onCustomizeAppearance}
              />
            </ContextMenu>
          );
        })}

        {layout.overflow > 0 ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <span
                className="flex-none cursor-context-menu text-[12px] tabular-nums text-muted-foreground"
                title={`${layout.overflow} more — right-click to tidy up`}
                aria-label={`${layout.overflow} more sessions`}
              >
                +{layout.overflow}
              </span>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-[11px] text-muted-foreground">
                Tidy up {project.name}
              </ContextMenuLabel>
              <ContextMenuItem
                disabled={inactiveTargets.length === 0}
                onSelect={() => onArchiveMany(inactiveTargets)}
              >
                <Archive />
                Archive {inactiveTargets.length} inactive
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuLabel className="text-[11px] text-muted-foreground">Older than…</ContextMenuLabel>
              {ARCHIVE_AGE_OPTIONS.map((option) => {
                const targets = bulkArchiveTargets(sessions, moods, {
                  olderThanHours: option.hours,
                  now: Date.now(),
                });
                return (
                  <ContextMenuItem
                    key={option.label}
                    disabled={targets.length === 0}
                    onSelect={() => onArchiveMany(targets)}
                  >
                    <span>{option.label}</span>
                    <span className="ml-auto pl-3 tabular-nums text-muted-foreground">{targets.length}</span>
                  </ContextMenuItem>
                );
              })}
            </ContextMenuContent>
          </ContextMenu>
        ) : null}

        {sessions.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/60">No sessions</span>
        ) : null}
      </div>
    </motion.div>
  );
}
