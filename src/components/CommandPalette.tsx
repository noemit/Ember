import * as React from 'react';
import { ArrowRight, MessageSquare, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BallState, EmberSettings, Instance, Session } from '../types';
import { sessionKey } from '../types';

type PaletteItem =
  | { type: 'session'; id: string; session: Session; searchable: string }
  | { type: 'new-agent'; id: string; instance: Instance; searchable: string };

type Props = {
  open: boolean;
  sessions: Session[];
  states: Record<string, BallState>;
  instances: Instance[];
  sessionNotes: EmberSettings['sessionNotes'];
  onOpenChange: (open: boolean) => void;
  onSelectSession: (session: Session) => void;
  onNewAgent: (instanceId: string) => void;
};

const stateLabel: Record<BallState, string> = {
  idle: 'Idle',
  active: 'Working',
  'needs-input': 'Needs input',
  error: 'Error',
};

export default function CommandPalette({
  open,
  sessions,
  states,
  instances,
  sessionNotes,
  onOpenChange,
  onSelectSession,
  onNewAgent,
}: Props) {
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const items = React.useMemo<PaletteItem[]>(() => {
    const sessionItems = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .map((session): PaletteItem => {
        const key = sessionKey(session);
        const notes = (sessionNotes[key] ?? []).map((note) => note.text).join('\n');
        const instance = instances.find((candidate) => candidate.id === session.instanceId);
        return {
          type: 'session',
          id: `session:${key}`,
          session,
          searchable: [
            session.title,
            session.id,
            session.directory,
            instance?.label,
            notes,
          ].filter(Boolean).join('\n').toLowerCase(),
        };
      });
    const agentItems = instances
      .filter((instance) => instance.attachable)
      .map((instance): PaletteItem => ({
        type: 'new-agent',
        id: `new:${instance.id}`,
        instance,
        searchable: `new agent ${instance.label} ${instance.kind}`.toLowerCase(),
      }));
    return [...sessionItems, ...agentItems];
  }, [instances, sessionNotes, sessions]);

  const filtered = React.useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matched = terms.length
      ? items.filter((item) => terms.every((term) => item.searchable.includes(term)))
      : items;
    return matched.slice(0, 60);
  }, [items, query]);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  React.useEffect(() => setActiveIndex(0), [query]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filtered.length]);

  const choose = (item: PaletteItem) => {
    onOpenChange(false);
    if (item.type === 'session') onSelectSession(item.session);
    else onNewAgent(item.instance.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[620px] gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search sessions and notes, or start a new agent.
        </DialogDescription>
        <div className="relative border-b p-2.5">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter' && filtered[activeIndex]) {
                event.preventDefault();
                choose(filtered[activeIndex]);
              }
            }}
            placeholder="Search sessions, folders, notes, or type “new agent”…"
            aria-label="Search commands"
            className="h-10 border-none bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
          />
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-1.5">
          {filtered.map((item, index) => {
            const active = index === activeIndex;
            if (item.type === 'new-agent') {
              return (
                <button
                  key={item.id}
                  type="button"
                  data-active={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px]',
                    active ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  )}
                >
                  <Plus className="size-4 flex-none text-highlight" />
                  <span className="min-w-0 flex-1 truncate">New agent on {item.instance.label}</span>
                  <ArrowRight className="size-3.5 flex-none" />
                </button>
              );
            }

            const key = sessionKey(item.session);
            const noteCount = sessionNotes[key]?.length ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                data-active={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px]',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground'
                )}
              >
                <MessageSquare className="size-4 flex-none text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">
                    {item.session.title ?? item.session.id}
                  </span>
                  <span className="block truncate text-[11px]">
                    {instances.find((instance) => instance.id === item.session.instanceId)?.label ?? item.session.instanceId}
                    {item.session.directory ? ` · ${item.session.directory}` : ''}
                    {noteCount ? ` · ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}` : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'flex-none rounded-full px-1.5 py-0.5 text-[10px]',
                    states[key] === 'needs-input'
                      ? 'bg-highlight/15 text-highlight'
                      : states[key] === 'active'
                        ? 'bg-muted text-foreground'
                        : 'bg-muted/60 text-muted-foreground'
                  )}
                >
                  {stateLabel[states[key] ?? 'idle']}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-[12px] text-muted-foreground">
              No sessions or commands match “{query.trim()}”.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
