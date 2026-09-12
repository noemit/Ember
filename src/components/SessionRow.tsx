import * as React from 'react';
import { motion } from 'motion/react';
import { Archive, ArchiveRestore, Loader2, Palette, Plus, RefreshCw } from 'lucide-react';
import Blob from '../blob/Blob';
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
  instanceLabel: string | undefined;
  projectName: string | undefined;
  preview: string | undefined;
  selected: boolean;
  mood: BallMood;
  reloading: boolean;
  archiving: boolean;
  markerColor: number | undefined;
  identity: AvatarIdentity | undefined;
  blobStyle: BlobStyle;
  /** Overrides the title text; used by a one-session project row to show the project name. */
  titleOverride?: string;
  /** When set, renders a `+` that starts a new session in the row's project. */
  onNewAgent?: () => void;
  onSelect: (session: Session) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

type SessionMenuProps = {
  session: Session;
  reloading: boolean;
  archiving: boolean;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

/** The reload/customize/archive menu shared by full rows and project-card blobs. */
export const SessionContextMenuContent = ({
  session,
  reloading,
  archiving,
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
  instanceLabel,
  projectName,
  preview,
  selected,
  mood,
  reloading,
  archiving,
  markerColor,
  identity,
  blobStyle,
  titleOverride,
  onNewAgent,
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
            <div className="mt-[7px]">
              {/* Project/task/session identity is resolved once in App so every surface stays aligned,
                  including across instances that reuse session ids. */}
              <Blob style={blobStyle} seed={key} identity={identity} size={55} mood={mood} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
                {(mood === 'input' || mood === 'question' || mood === 'error') && (projectName || instanceLabel) ? (
                  <span aria-hidden>·</span>
                ) : null}
                {instanceLabel ? (
                  <>
                    <span className="truncate">{instanceLabel}</span>
                    {projectName ? <span aria-hidden>·</span> : null}
                  </>
                ) : null}
                {projectName ? <span className="truncate">{projectName}</span> : null}
              </span>
            </div>
          </motion.button>
        </ContextMenuTrigger>
        <SessionContextMenuContent
          session={session}
          reloading={reloading}
          archiving={archiving}
          onReload={onReload}
          onArchive={onArchive}
          onCustomizeAppearance={onCustomizeAppearance}
        />
      </ContextMenu>

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
            className={cn(
              'absolute top-1.5 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
              onNewAgent ? 'right-9' : 'right-2',
              archiving ? 'opacity-100' : 'opacity-0'
            )}
          >
            {archiving ? <Loader2 className="animate-spin" /> : <ArchiveIcon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{archiving ? archiveBusyLabel : archiveLabel}</TooltipContent>
      </Tooltip>

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
              className="absolute top-1.5 right-2 text-muted-foreground"
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">New session in {titleOverride ?? 'project'}</TooltipContent>
        </Tooltip>
      ) : null}
    </motion.div>
  );
});

export default SessionRow;
