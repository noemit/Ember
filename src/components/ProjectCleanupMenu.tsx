import { Archive, Ellipsis } from 'lucide-react';
import { ARCHIVE_AGE_OPTIONS, bulkArchiveTargets } from '@/lib/bulkArchive';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BallMood, Session } from '../types';

export default function ProjectCleanupMenu({ name, sessions, moods, onArchiveMany }: {
  name: string;
  sessions: Session[];
  moods: Record<string, BallMood>;
  onArchiveMany: (sessions: Session[]) => void;
}) {
  const targets = (hours?: number) => bulkArchiveTargets(sessions, moods, { now: Date.now(), olderThanHours: hours });
  const inactive = targets().length;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Project actions for ${name}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Project actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>Tidy up {name}</DropdownMenuLabel>
        <DropdownMenuItem disabled={!inactive} onSelect={() => onArchiveMany(targets())}>
          <Archive /> Archive {inactive} inactive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Older than…</DropdownMenuLabel>
        {ARCHIVE_AGE_OPTIONS.map(({ label, hours }) => {
          const count = targets(hours).length;
          return <DropdownMenuItem key={label} disabled={!count} onSelect={() => onArchiveMany(targets(hours))}>
            {label}<span className="ml-auto pl-3 tabular-nums">{count}</span>
          </DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
