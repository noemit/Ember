import * as React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { cn } from '@/lib/utils';
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
  /** True when the session is currently shown as a column rather than only a tab. */
  visible: boolean;
  minimized: boolean;
  archiving: boolean;
};

type Props = {
  tabs: WorkspaceTab[];
  blobStyle: BlobStyle;
  onActivate: (key: string) => void;
  onMinimize: (key: string) => void;
  onRestore: (key: string) => void;
  onClose: (key: string) => void;
};

/**
 * The numbered open-session strip under the top bar. Visible columns and overflow/minimized
 * sessions share one numbering, so `Cmd/Ctrl+1–9` is stable. A tab click activates (and restores);
 * the chevron minimizes or restores; the × closes the session.
 */
export default function ColumnTabStrip({
  tabs,
  blobStyle,
  onActivate,
  onMinimize,
  onRestore,
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
          <button
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
            {tab.visible && !tab.minimized ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="size-1.5 flex-none rounded-full bg-highlight/70" aria-label="Shown as a column" />
                </TooltipTrigger>
                <TooltipContent>Shown as a column</TooltipContent>
              </Tooltip>
            ) : null}
          </button>

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
