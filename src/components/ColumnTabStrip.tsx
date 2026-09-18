import * as React from 'react';
import { Archive, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { cn } from '@/lib/utils';
import { shortcutLabel } from '@/lib/shortcuts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AvatarIdentity, BallMood, BlobStyle } from '../types';

export type WorkspaceTab = {
  /** Session key (`instance::session`). */
  key: string;
  title: string;
  instanceLabel?: string;
  identity?: AvatarIdentity;
  mood: BallMood;
  /** 1-based position in the open list; columns and tabs share this numbering. */
  number: number;
  active: boolean;
  minimized: boolean;
  archiving: boolean;
};

type Props = {
  tabs: WorkspaceTab[];
  blobStyle: BlobStyle;
  onActivate: (key: string) => void;
  onMinimize: (key: string) => void;
  onRestore: (key: string) => void;
  onArchive: (key: string) => void;
  onClose: (key: string) => void;
};

/**
 * The numbered strip of open sessions that aren't currently columns (overflow + minimized).
 * Columns and tabs share one numbering, so `Cmd/Ctrl+1–9` is stable. A tab click loads it into
 * the rightmost panel; the chevron minimizes/restores; the archive button archives; × closes.
 */
export default function ColumnTabStrip({
  tabs,
  blobStyle,
  onActivate,
  onMinimize,
  onRestore,
  onArchive,
  onClose,
}: Props) {
  if (tabs.length === 0) return null;
  return (
    <div
      className="flex flex-none items-center gap-1 overflow-x-auto border-b bg-card/60 px-2 py-1"
      aria-label="Open sessions"
    >
      {tabs.map((tab) => (
        <div
          key={tab.key}
          data-active={tab.active}
          className={cn(
            'group flex flex-none items-center gap-1 rounded-md border py-0.5 pr-0.5 pl-1 transition-colors',
            tab.active
              ? 'border-highlight/40 bg-muted text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            tab.minimized ? 'opacity-70' : undefined
          )}
        >
          <Tooltip><TooltipTrigger asChild><button
            type="button"
            onClick={() => (tab.minimized ? onRestore(tab.key) : onActivate(tab.key))}
            className="flex min-w-0 items-center gap-1.5"
            aria-label={`Session ${tab.number}: ${tab.title}${tab.minimized ? ' (minimized)' : ''}`}
            aria-current={tab.active ? 'true' : undefined}
          >
            <span className="w-3 flex-none text-center text-[10px] tabular-nums text-muted-foreground">
              {tab.number}
            </span>
            <Blob
              style={blobStyle}
              seed={tab.key}
              identity={tab.identity}
              size={18}
              mood={tab.mood}
            />
            <span className="max-w-[150px] truncate text-[11.5px] font-medium">{tab.title}</span>
          </button></TooltipTrigger><TooltipContent>{shortcutLabel(`Activate session · Mod+${tab.number}`)}</TooltipContent></Tooltip>

          {tab.minimized ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onRestore(tab.key)}
                  className="flex size-5 flex-none items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label={`Restore ${tab.title}`}
                >
                  <ChevronUp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Restore to a column</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onMinimize(tab.key)}
                  className="flex size-5 flex-none items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground"
                  aria-label={`Minimize ${tab.title}`}
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Minimize to a tab</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onArchive(tab.key)}
                disabled={tab.archiving}
                className="flex size-5 flex-none items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground disabled:opacity-50"
                aria-label={`Archive ${tab.title}`}
              >
                {tab.archiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>Archive session</TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={() => onClose(tab.key)}
            disabled={tab.archiving}
            className="flex size-5 flex-none items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground disabled:opacity-50"
            aria-label={`Close ${tab.title}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
