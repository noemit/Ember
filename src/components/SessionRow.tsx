import * as React from 'react';
import { motion } from 'motion/react';
import { Archive, ArchiveRestore, Loader2, Palette, Pin, Play, Plus, RefreshCw, Sparkles } from 'lucide-react';
import Blob from '../blob/Blob';
import ProjectCleanupMenu from './ProjectCleanupMenu';
import { normalizeDirectory } from '../blob/seed';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { sessionKey } from '../types';
import type { ScheduledTask } from '../api';
import type { AvatarIdentity, BallMood, BlobStyle, Session } from '../types';

const relativeTime = (timestamp: number | undefined, now: number): string => {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Owns its own clock so the 30s tick re-renders one span, not every rail row. */
export const RelativeTime = ({ timestamp, className }: { timestamp: number | undefined; className?: string }) => {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className={className}>{relativeTime(timestamp, now)}</span>;
};

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

export type SessionRowProps = {
  session: Session;
  onArchiveMany?: (sessions: Session[]) => void;
  instanceLabel: string | undefined;
  projectName: string | undefined;
  preview: string | undefined;
  selected: boolean;
  /** True while the session is a workspace column; an underline under the blob marks it. */
  visibleColumn?: boolean;
  mood: BallMood;
  reloading: boolean;
  archiving: boolean;
  /** How many messages are pinned, shown as a small badge on the blob. */
  pinnedCount?: number;
  markerColor: number | undefined;
  identity: AvatarIdentity | undefined;
  blobStyle: BlobStyle;
  /** Overrides the title text; used by a one-session project row to show the project name. */
  titleOverride?: string;
  /** Shown as a small line above the title (e.g. "Project · instance"); moves it out of the meta row. */
  topMeta?: React.ReactNode;
  /** When set, renders a `+` that starts a new session in the row's project. */
  onNewAgent?: () => void;
  /** The scheduled task this session is the latest run of, when the row is in the scheduled view. */
  scheduledTask?: ScheduledTask;
  scheduledRunning?: boolean;
  onRunScheduledTask?: (task: ScheduledTask) => void;
  onChangeScheduledTaskModel?: (task: ScheduledTask) => void;
  onSelect: (session: Session) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

type SessionMenuProps = {
  session: Session;
  reloading: boolean;
  archiving: boolean;
  scheduledTask?: ScheduledTask;
  scheduledRunning?: boolean;
  onRunScheduledTask?: (task: ScheduledTask) => void;
  onChangeScheduledTaskModel?: (task: ScheduledTask) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

/** The reload/customize/archive menu shared by full rows and project-card blobs. */
export const SessionContextMenuContent = ({
  session,
  reloading,
  archiving,
  scheduledTask,
  scheduledRunning,
  onRunScheduledTask,
  onChangeScheduledTaskModel,
  onReload,
  onArchive,
  onCustomizeAppearance,
}: SessionMenuProps) => {
  const archived = Boolean(session.archived);
  const archiveLabel = archived ? 'Restore session' : 'Archive session';
  const archiveBusyLabel = archived ? 'Restoring…' : 'Archiving…';
  const ArchiveIcon = archived ? ArchiveRestore : Archive;
  return (
    <ContextMenuContent>
      <ContextMenuItem disabled={reloading} onSelect={() => onReload(session)}>
        <RefreshCw className={cn(reloading && 'animate-spin')} />
        {reloading ? 'Reloading…' : 'Reload session'}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onCustomizeAppearance(session)}>
        <Palette />
        Customize appearance…
      </ContextMenuItem>
      {scheduledTask ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={scheduledRunning}
            onSelect={() => onRunScheduledTask?.(scheduledTask)}
          >
            {scheduledRunning ? <Loader2 className="animate-spin" /> : <Play />}
            {scheduledRunning ? 'Starting…' : 'Run scheduled task now'}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onChangeScheduledTaskModel?.(scheduledTask)}>
            <Sparkles />
            Change model &amp; run…
          </ContextMenuItem>
        </>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem disabled={archiving} onSelect={() => onArchive(session, !archived)}>
        {archiving ? <Loader2 className="animate-spin" /> : <ArchiveIcon />}
        {archiving ? archiveBusyLabel : archiveLabel}
      </ContextMenuItem>
    </ContextMenuContent>
  );
};

/** One rail row. Memoized: the rail re-renders on every poll, most rows don't change. */
const SessionRow = React.memo(function SessionRow({
  session,
  onArchiveMany,
  instanceLabel,
  projectName,
  preview,
  selected,
  visibleColumn,
  mood,
  reloading,
  archiving,
  pinnedCount,
  markerColor,
  identity,
  blobStyle,
  titleOverride,
  topMeta,
  onNewAgent,
  scheduledTask,
  scheduledRunning,
  onRunScheduledTask,
  onChangeScheduledTaskModel,
  onSelect,
  onReload,
  onArchive,
  onCustomizeAppearance,
}: SessionRowProps) {
  const key = sessionKey(session);
  const title = titleOverride ?? session.title ?? session.id;
  // Per row, not per view: the selected session is pinned into the active list even when
  // it's archived, and its button must offer "Restore" rather than archiving it again.
  const archived = Boolean(session.archived);
  const archiveLabel = archived ? 'Restore session' : 'Archive session';
  const archiveBusyLabel = archived ? 'Restoring…' : 'Archiving…';
  const ArchiveIcon = archived ? ArchiveRestore : Archive;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={spring}
      className="group relative"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            data-selected={selected}
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(session)}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
              selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <div
              className="relative mt-[7px]"
              data-session-key={key}
              data-visible-column={visibleColumn ? 'true' : undefined}
            >
              {/* Project/task/session identity is resolved once in App so every surface stays aligned,
                  including across instances that reuse session ids. */}
              <Blob style={blobStyle} seed={key} identity={identity} size={55} mood={mood} />
              {visibleColumn ? (
                <span
                  data-column-underline
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-1.5 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-highlight"
                />
              ) : null}
              {pinnedCount ? (
                <span
                  className="pointer-events-none absolute -bottom-0.5 -left-0.5 flex size-4 items-center justify-center rounded-full bg-background text-highlight ring-1 ring-border"
                  title={`${pinnedCount} pinned message${pinnedCount === 1 ? '' : 's'}`}
                  aria-label={`${pinnedCount} pinned`}
                >
                  <Pin className="size-2.5" />
                </span>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {topMeta ? (
                <span className="flex min-w-0 items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground">
                  {topMeta}
                </span>
              ) : null}
              <div className="flex items-baseline gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
                  style={markerColor === undefined ? undefined : {
                    textDecoration: 'underline',
                    textDecorationColor: `var(--instance-marker-${markerColor})`,
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '3px',
                  }}
                >
                  {title}
                </span>
                <RelativeTime
                  timestamp={session.updated}
                  className="flex-none text-[10.5px] tabular-nums text-muted-foreground transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
                />
              </div>
              <span className="truncate text-[11.5px] leading-4">
                {preview ?? (session.directory ? normalizeDirectory(session.directory).split(/[\\/]/).pop() : '')}
              </span>
              {mood === 'input' || mood === 'question' || mood === 'error' || (!topMeta && (projectName || instanceLabel)) ? (
                <span className="flex items-center gap-1 truncate text-[10.5px] text-muted-foreground">
                  {mood === 'input' || mood === 'question' ? (
                    <Badge variant="outline" className="flex-none border-highlight/40 px-1 py-0 text-[10px] font-medium text-highlight">
                      Needs input
                    </Badge>
                  ) : mood === 'error' ? (
                    <Badge variant="outline" className="flex-none border-destructive/40 px-1 py-0 text-[10px] font-medium text-destructive">
                      Failed
                    </Badge>
                  ) : null}
                  {!topMeta &&
                  (mood === 'input' || mood === 'question' || mood === 'error') &&
                  (projectName || instanceLabel) ? (
                    <span aria-hidden>·</span>
                  ) : null}
                  {!topMeta && instanceLabel ? (
                    <>
                      <span className="truncate">{instanceLabel}</span>
                      {projectName ? <span aria-hidden>·</span> : null}
                    </>
                  ) : null}
                  {!topMeta && projectName ? <span className="truncate">{projectName}</span> : null}
                </span>
              ) : null}
            </div>
          </motion.button>
        </ContextMenuTrigger>
        <SessionContextMenuContent
          session={session}
          reloading={reloading}
          archiving={archiving}
          scheduledTask={scheduledTask}
          scheduledRunning={scheduledRunning}
          onRunScheduledTask={onRunScheduledTask}
          onChangeScheduledTaskModel={onChangeScheduledTaskModel}
          onReload={onReload}
          onArchive={onArchive}
          onCustomizeAppearance={onCustomizeAppearance}
        />
      </ContextMenu>

      <div
        className={cn(
          'absolute top-1.5 right-2 flex items-center gap-0.5 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
          archiving || scheduledRunning || onArchiveMany ? 'opacity-100' : 'opacity-0'
        )}
      >
        {onArchiveMany ? <ProjectCleanupMenu name={title} sessions={[session]} moods={{ [key]: mood }} onArchiveMany={onArchiveMany} /> : null}
        {onNewAgent ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`New session in ${titleOverride ?? 'project'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onNewAgent();
                }}
                className="text-muted-foreground"
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">New session in {titleOverride ?? 'project'}</TooltipContent>
          </Tooltip>
        ) : null}

        {scheduledTask ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={scheduledRunning}
                aria-label={scheduledRunning ? 'Starting scheduled task…' : 'Run scheduled task now'}
                onClick={(event) => {
                  event.stopPropagation();
                  onRunScheduledTask?.(scheduledTask);
                }}
                className="text-muted-foreground"
              >
                {scheduledRunning ? <Loader2 className="animate-spin" /> : <Play />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {scheduledRunning ? 'Starting…' : `Run ${scheduledTask.name} now`}
            </TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={archiving}
              aria-label={archiving ? archiveBusyLabel : archiveLabel}
              onClick={(event) => {
                event.stopPropagation();
                onArchive(session, !archived);
              }}
            >
              {archiving ? <Loader2 className="animate-spin" /> : <ArchiveIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{archiving ? archiveBusyLabel : archiveLabel}</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
});

export default SessionRow;
