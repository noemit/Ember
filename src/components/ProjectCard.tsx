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
  multiInstance: boolean;
  markerColor: number | undefined;
  sessions: Session[];
  moods: Record<string, BallMood>;
  selectedKey: string | null;
  /** Session keys currently open as workspace columns, for the ring. */
  openKeys: Set<string>;
  avatarIdentities: Record<string, AvatarIdentity>;
  blobStyle: BlobStyle;
  reloadingKeys: Set<string>;
  archivingKeys: Set<string>;
  onSelectSession: (session: Session) => void;
  onNewAgent: (instanceId: string, directory?: string) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

/**
 * A project in the rail: its name, a `+` that starts a session in that project's directory, and a
 * strip of its sessions as mood-carrying blobs. Clicking a blob opens that session; right-click
 * opens the usual session menu. The strip shrinks as the project fills and overflows to `+N`.
 */
export default function ProjectCard({
  project,
  instanceId,
  instanceLabel,
  multiInstance,
  markerColor,
  sessions,
  moods,
  selectedKey,
  openKeys,
  avatarIdentities,
  blobStyle,
  reloadingKeys,
  archivingKeys,
  onSelectSession,
  onNewAgent,
  onReload,
  onArchive,
  onCustomizeAppearance,
}: Props) {
  const layout = blobStripLayout(sessions.length, STRIP_WIDTH);
  const visible = sessions.slice(0, layout.visible);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={spring}
      className="rounded-lg border bg-card/40 px-2 py-1.5"
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
        {multiInstance && instanceLabel ? (
          <span className="truncate text-[10px] text-muted-foreground">{instanceLabel}</span>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onNewAgent(instanceId, project.path)}
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
          const open = openKeys.has(key);
          return (
            <ContextMenu key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelectSession(session)}
                      aria-label={title}
                      aria-current={selected ? 'true' : undefined}
                      className={cn(
                        'flex-none rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-highlight',
                        selected
                          ? 'ring-2 ring-highlight ring-offset-1 ring-offset-card'
                          : open
                            ? 'ring-1 ring-highlight/50 ring-offset-1 ring-offset-card'
                            : undefined
                      )}
                    >
                      <Blob
                        style={blobStyle}
                        seed={key}
                        identity={avatarIdentities[key]}
                        size={layout.size}
                        mood={moods[key] ?? 'idle'}
                      />
                    </button>
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
