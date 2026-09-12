import * as React from 'react';
import { ArrowRight, MessageSquare, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { springTransition } from '@/lib/animation';
import { notesKeyForSession } from '@/lib/projectGroups';
import type { BallState, EmberSettings, Instance, Project, Session } from '../types';
import { sessionKey } from '../types';

type PaletteItem =
  | { type: 'session'; id: string; session: Session; searchable: string }
  | { type: 'new-agent'; id: string; instance: Instance; searchable: string };

type Props = {
  open: boolean;
  sessions: Session[];
  states: Record<string, BallState>;
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
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
  projectsByInstance,
  sessionNotes,
  onOpenChange,
  onSelectSession,
  onNewAgent,
}: Props) {
  const [query, setQuery] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const items = React.useMemo<PaletteItem[]>(() => {
    const sessionItems = [...sessions]
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .map((session): PaletteItem => {
        const key = sessionKey(session);
        const notes =
          (sessionNotes[notesKeyForSession(session, projectsByInstance[session.instanceId] ?? [])] ?? [])
            .map((note) => note.text)
            .join('\n');
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
          ]
            .filter(Boolean)
            .join('\n')
            .toLowerCase(),
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
    return [...sessionItems, ...agentItems].slice(0, 60);
  }, [instances, projectsByInstance, sessionNotes, sessions]);

  const sessionItems = items.filter((item): item is PaletteItem & { type: 'session' } => item.type === 'session');
  const agentItems = items.filter((item): item is PaletteItem & { type: 'new-agent' } => item.type === 'new-agent');

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const choose = (item: PaletteItem) => {
    onOpenChange(false);
    if (item.type === 'session') onSelectSession(item.session);
    else onNewAgent(item.instance.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-[620px] gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search sessions and notes, or start a new agent.
        </DialogDescription>

        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <div className="relative border-b px-2.5 py-2.5">
            <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
            <CommandInput
              ref={searchRef}
              value={query}
              onValueChange={(value: string) => setQuery(value)}
              placeholder="Search sessions, folders, notes, or type “new agent”…"
              aria-label="Search commands"
              className="h-10 border-none bg-transparent pl-9 text-sm shadow-none outline-none focus-visible:ring-0"
            />
          </div>

          <CommandList className="max-h-[420px] overflow-y-auto p-1.5">
            <AnimatePresence>
              {agentItems.length > 0 ? (
                <motion.div
                  key="agents"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={springTransition}
                >
                  <CommandGroup heading="New agent">
                    {agentItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.searchable}
                        onSelect={() => choose(item)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] aria-selected:bg-muted aria-selected:text-foreground"
                      >
                        <Plus className="size-4 flex-none text-highlight" />
                        <span className="min-w-0 flex-1 truncate">New agent on {item.instance.label}</span>
                        <ArrowRight className="size-3.5 flex-none" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </motion.div>
              ) : null}

              {sessionItems.length > 0 && agentItems.length > 0 ? (
                <CommandSeparator className="-mx-1 my-1 h-px bg-border" />
              ) : null}

              {sessionItems.length > 0 ? (
                <motion.div
                  key="sessions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={springTransition}
                >
                  <CommandGroup heading="Sessions">
                    {sessionItems.map((item) => {
                      const key = sessionKey(item.session);
                      const noteCount =
                        sessionNotes[
                          notesKeyForSession(item.session, projectsByInstance[item.session.instanceId] ?? [])
                        ]?.length ?? 0;
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.searchable}
                          onSelect={() => choose(item)}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] aria-selected:bg-muted aria-selected:text-foreground"
                        >
                          <MessageSquare className="size-4 flex-none text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-foreground">
                              {item.session.title ?? item.session.id}
                            </span>
                            <span className="block truncate text-[11px]">
                              {instances.find((instance) => instance.id === item.session.instanceId)?.label ??
                                item.session.instanceId}
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
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <CommandEmpty className="px-3 py-10 text-center text-[12px] text-muted-foreground">
              No sessions or commands match “{query.trim()}”.
            </CommandEmpty>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
