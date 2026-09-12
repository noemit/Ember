import * as React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import Blob from '../blob/Blob';
import { blobStripLayout } from '@/lib/projectGroups';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SessionContextMenuContent } from './SessionRow';
import { sessionKey } from '../types';
import type { AvatarIdentity, BallMood, BlobStyle, Project, Session } from '../types';

// The rail is 320px wide; strip sits inside px-1.5 rail + px-2 card padding.
const STRIP_WIDTH = 280;

type Props = {
  project: Project;
  instanceId: string;
  instanceLabel: string | undefined;
  markerColor: number | undefined;
  sessions: Session[];
  moods: Record<string, BallMood>;
  selectedKey: string | null;
  avatarIdentities: Record<string, AvatarIdentity>;
  blobStyle: BlobStyle;
  reloadingKeys: Set<string>;
  archivingKeys: Set<string>;
  /** Opens every session in this project (most recent as columns, the rest as tabs). */
  onOpenProject: () => void;
  onNewAgent: (instanceId: string, directory?: string) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

/**
 * A project with two or more sessions: its name, a `+` that starts a session in that project's
 * directory, and a strip of mood-carrying blobs. Clicking the card opens the project (all its
 * sessions as tabs, the most recent ones as columns); the blobs are display-only, though
 * right-clicking one still offers the per-session menu. One-session projects use a plain row.
 */
export default function ProjectCard({
  project,
  instanceId,
  instanceLabel,
  markerColor,
  sessions,
  moods,
  selectedKey,
  avatarIdentities,
  blobStyle,
  reloadingKeys,
  archivingKeys,
  onOpenProject,
  onNewAgent,
  onReload,
  onArchive,
  onCustomizeAppearance,
}: Props) {
  const layout = blobStripLayout(sessions.length, STRIP_WIDTH, 48, 30);
  const visible = sessions.slice(0, layout.visible);

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
          <span className="truncate text-[10px] text-muted-foreground">{instanceLabel}</span>
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
      </div>

      <div className="mt-1 flex min-h-[30px] items-center px-1" style={{ gap: 4 }}>
        {visible.map((session) => {
          const key = sessionKey(session);
          const title = session.title ?? session.id;
          const selected = key === selectedKey;
          return (
            <ContextMenu key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ContextMenuTrigger asChild>
                    <span
                      className={cn(
                        'flex-none rounded-full',
                        selected ? 'ring-2 ring-highlight ring-offset-1 ring-offset-card' : undefined
                      )}
                      aria-label={title}
                    >
                      <Blob
                        style={blobStyle}
                        seed={key}
                        identity={avatarIdentities[key]}
                        size={layout.size}
                        mood={moods[key] ?? 'idle'}
                      />
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
          <span
            className="flex-none text-[12px] tabular-nums text-muted-foreground"
            title={`${layout.overflow} more`}
          >
            +{layout.overflow}
          </span>
        ) : null}

        {sessions.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/60">No sessions</span>
        ) : null}
      </div>
    </motion.div>
  );
}
