import * as React from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ChevronDown, Plus, Settings, Sparkles } from 'lucide-react';
import Blob from '../blob/Blob';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { sessionKey } from '../types';
import type { BallState, BlobStyle, Instance, Project, Session } from '../types';

type Props = {
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
  sessions: Session[];
  states: Record<string, BallState>;
  previews: Record<string, string>;
  seeds: Record<string, string>;
  selectedKey: string | null;
  blobStyle: BlobStyle;
  loading: boolean;
  onSelectSession: (session: Session) => void;
  onNewAgent: (instanceId: string) => void;
  onOpenSettings: () => void;
  onShowcase: () => void;
};

type Sorter = 'recent' | 'name';

const normalizeDir = (value: string): string => value.replace(/\/+$/, '');

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

const projectFor = (session: Session, projects: Project[]): Project | null => {
  const directory = session.directory ? normalizeDir(session.directory) : '';
  let best: Project | null = null;
  let bestLength = -1;
  projects.forEach((project) => {
    if (!project.path) return;
    const base = normalizeDir(project.path);
    if ((directory === base || directory.startsWith(`${base}/`)) && base.length > bestLength) {
      bestLength = base.length;
      best = project;
    }
  });
  return best;
};

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

export default function LeftRail({
  instances,
  projectsByInstance,
  sessions,
  states,
  previews,
  seeds,
  selectedKey,
  blobStyle,
  loading,
  onSelectSession,
  onNewAgent,
  onOpenSettings,
  onShowcase,
}: Props) {
  const [sorter, setSorter] = React.useState<Sorter>('recent');
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const instanceById = React.useMemo(
    () => Object.fromEntries(instances.map((instance) => [instance.id, instance])),
    [instances]
  );
  const ready = React.useMemo(() => instances.filter((instance) => instance.attachable), [instances]);
  const multiInstance = ready.length > 1;

  const sorted = React.useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) =>
      sorter === 'name'
        ? (a.title ?? a.id).localeCompare(b.title ?? b.id)
        : (b.updated ?? 0) - (a.updated ?? 0)
    );
    return copy;
  }, [sessions, sorter]);

  // Default target for "New agent": whichever instance was active most recently.
  const defaultInstanceId = sorted.find((session) => instanceById[session.instanceId]?.attachable)
    ?.instanceId ?? ready[0]?.id ?? null;

  const renderSession = (session: Session) => {
    const key = sessionKey(session);
    const instance = instanceById[session.instanceId];
    const project = projectFor(session, projectsByInstance[session.instanceId] ?? []);
    const selected = key === selectedKey;
    const state = states[key] ?? 'idle';

    return (
      <motion.button
        key={key}
        type="button"
        layout="position"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
        transition={spring}
        whileTap={{ scale: 0.985 }}
        data-selected={selected}
        onClick={() => onSelectSession(session)}
        className={cn(
          'group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
          selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
      >
        <div className="mt-0.5">
          <Blob style={blobStyle} seed={seeds[key] ?? session.id} size={34} state={state} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {session.title ?? session.id}
            </span>
            <span className="flex-none text-[10.5px] tabular-nums text-muted-foreground/80">
              {relativeTime(session.updated, now)}
            </span>
          </div>
          <span className="truncate text-[11.5px] leading-4">
            {previews[key] ?? (session.directory ? normalizeDir(session.directory).split('/').pop() : '')}
          </span>
          <span className="flex items-center gap-1 truncate text-[10.5px] text-muted-foreground/70">
            {multiInstance && instance ? (
              <>
                <span className="truncate">{instance.label}</span>
                {project ? <span aria-hidden>·</span> : null}
              </>
            ) : null}
            {project ? <span className="truncate">{project.name}</span> : null}
          </span>
        </div>
      </motion.button>
    );
  };

  return (
    <aside className="flex w-[320px] flex-none flex-col border-r bg-card">
      <div className="flex flex-col gap-2 border-b p-2.5">
        <div className="flex gap-1.5">
          <Button
            className="flex-1 justify-start"
            size="sm"
            disabled={!defaultInstanceId}
            onClick={() => defaultInstanceId && onNewAgent(defaultInstanceId)}
          >
            <Plus />
            New agent
            {multiInstance && defaultInstanceId ? (
              <span className="ml-auto truncate text-[11px] opacity-70">
                {instanceById[defaultInstanceId]?.label}
              </span>
            ) : null}
          </Button>

          {multiInstance ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" aria-label="Choose instance for the new agent">
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuLabel>New agent on…</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ready.map((instance) => (
                  <DropdownMenuItem key={instance.id} onSelect={() => onNewAgent(instance.id)}>
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    {instance.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <Select value={sorter} onValueChange={(value) => setSorter(value as Sorter)}>
          <SelectTrigger size="sm" className="w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Sort: recent activity</SelectItem>
            <SelectItem value="name">Sort: name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {sorted.map(renderSession)}
          </AnimatePresence>
        </LayoutGroup>

        {sorted.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">
            {loading
              ? 'Loading sessions…'
              : ready.length === 0
                ? 'No connected instances. Open one in OpenChamber, then refresh.'
                : 'No sessions yet.'}
          </div>
        ) : null}
      </div>

      <div className="flex gap-1.5 border-t p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="flex-1" onClick={onShowcase}>
              <Sparkles />
              Blobs
            </Button>
          </TooltipTrigger>
          <TooltipContent>Preview blob styles</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="sm" className="flex-1" onClick={onOpenSettings}>
          <Settings />
          Settings
        </Button>
      </div>
    </aside>
  );
}
