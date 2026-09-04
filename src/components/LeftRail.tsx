import * as React from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  Archive,
  ArchiveRestore,
  ArrowDownUp,
  ChevronDown,
  ListFilter,
  Palette,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import Blob from '../blob/Blob';
import { normalizeDirectory, projectForSession } from '../blob/seed';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { modelRefKey, sessionKey } from '../types';
import type { AvatarIdentity, BallState, BlobStyle, Instance, Project, Session } from '../types';

type Props = {
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
  sessions: Session[];
  states: Record<string, BallState>;
  previews: Record<string, string>;
  selectedKey: string | null;
  avatarIdentities: Record<string, AvatarIdentity>;
  blobStyle: BlobStyle;
  loading: boolean;
  mobileOpen: boolean;
  /** The currently open session, if any. Pinned to the rail when filters hide it. */
  selectedSession: Session | null;
  /** Human label for the recency window ("Last 2 days"), or null when everything is shown. */
  windowLabel: string | null;
  showArchived: boolean;
  onShowArchived: (value: boolean) => void;
  onSelectSession: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
  onNewAgent: (instanceId: string) => void;
  onOpenSettings: () => void;
};

type Sorter = 'recent' | 'name';

type FacetKind = 'instance' | 'model' | 'folder';

/** One selectable filter value with how many sessions in the current view match it. */
type Facet = { kind: FacetKind; value: string; label: string; count: number };

const ALL_FILTER = 'all';
const facetId = (facet: Pick<Facet, 'kind' | 'value'>): string => `${facet.kind}\u0000${facet.value}`;

const FACET_TITLES: Record<FacetKind, string> = { instance: 'Instance', model: 'Model', folder: 'Folder' };

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

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

const matchesQuery = (haystack: Array<string | undefined>, query: string): boolean =>
  haystack.some((value) => value?.toLowerCase().includes(query));

/** Folder shown for a session: its project when it sits inside one, else the directory's last segment. */
const folderOf = (session: Session, projects: Project[]): string | undefined =>
  projectForSession(session, projects)?.name ??
  (session.directory ? normalizeDirectory(session.directory).split(/[\\/]/).pop() || undefined : undefined);

export default function LeftRail({
  instances,
  projectsByInstance,
  sessions,
  states,
  previews,
  selectedKey,
  avatarIdentities,
  blobStyle,
  loading,
  mobileOpen,
  selectedSession,
  windowLabel,
  showArchived,
  onShowArchived,
  onSelectSession,
  onArchive,
  onCustomizeAppearance,
  onNewAgent,
  onOpenSettings,
}: Props) {
  const [sorter, setSorter] = React.useState<Sorter>('recent');
  const [filter, setFilter] = React.useState(ALL_FILTER);
  const [query, setQuery] = React.useState('');
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

  // Facet values for each session, computed once so both counting and filtering agree.
  const facetsBySession = React.useMemo(() => {
    const map = new Map<string, Record<FacetKind, Facet | null>>();
    sessions.forEach((session) => {
      const instance = instanceById[session.instanceId];
      const folder = folderOf(session, projectsByInstance[session.instanceId] ?? []);
      map.set(sessionKey(session), {
        instance: instance
          ? { kind: 'instance', value: instance.id, label: instance.label, count: 0 }
          : null,
        model: session.model
          ? { kind: 'model', value: modelRefKey(session.model), label: session.model.modelID, count: 0 }
          : null,
        folder: folder ? { kind: 'folder', value: folder, label: folder, count: 0 } : null,
      });
    });
    return map;
  }, [sessions, instanceById, projectsByInstance]);

  // Counts reflect the current view (archived toggle, hidden instances) but not the search box,
  // so the numbers stay put while typing.
  const facetGroups = React.useMemo(() => {
    const groups: Record<FacetKind, Map<string, Facet>> = {
      // Every connected instance is listed, even with zero sessions in view, so the
      // group is always there when there's more than one instance to choose from.
      instance: new Map(
        ready.map((instance) => [
          instance.id,
          { kind: 'instance', value: instance.id, label: instance.label, count: 0 } satisfies Facet,
        ])
      ),
      model: new Map(),
      folder: new Map(),
    };
    facetsBySession.forEach((facets) => {
      (Object.keys(groups) as FacetKind[]).forEach((kind) => {
        const facet = facets[kind];
        if (!facet) return;
        const existing = groups[kind].get(facet.value);
        if (existing) existing.count += 1;
        else groups[kind].set(facet.value, { ...facet, count: 1 });
      });
    });
    return (Object.keys(groups) as FacetKind[])
      .map((kind) => ({
        kind,
        facets: [...groups[kind].values()].sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label)
        ),
      }))
      // A single value isn't a choice worth offering; filtering by it equals "all".
      .filter((group) => group.facets.length > 1);
  }, [facetsBySession, ready]);

  const activeFacet = React.useMemo(
    () =>
      facetGroups.flatMap((group) => group.facets).find((facet) => facetId(facet) === filter) ?? null,
    [facetGroups, filter]
  );

  const needle = query.trim().toLowerCase();
  const visible = React.useMemo(() => {
    const filtered =
      filter === ALL_FILTER
        ? sorted
        : sorted.filter((session) => {
            const facets = facetsBySession.get(sessionKey(session));
            return (Object.values(facets ?? {}) as Array<Facet | null>).some(
              (facet) => facet && facetId(facet) === filter
            );
          });
    if (!needle) return filtered;
    return filtered.filter((session) =>
      matchesQuery(
        [
          session.title,
          session.id,
          previews[sessionKey(session)],
          session.directory,
          instanceById[session.instanceId]?.label,
          facetsBySession.get(sessionKey(session))?.folder?.label,
        ],
        needle
      )
    );
  }, [sorted, filter, facetsBySession, needle, previews, instanceById]);

  // The active chat should always be reachable, even when archive/instance filters hide it.
  const selectedIsVisible =
    selectedSession && visible.some((session) => sessionKey(session) === sessionKey(selectedSession));

  // Default target for "New agent": whichever instance was active most recently.
  const defaultInstanceId = sorted.find((session) => instanceById[session.instanceId]?.attachable)
    ?.instanceId ?? ready[0]?.id ?? null;

  const archiveLabel = showArchived ? 'Restore session' : 'Archive session';
  const ArchiveIcon = showArchived ? ArchiveRestore : Archive;

  const renderSession = (session: Session) => {
    const key = sessionKey(session);
    const instance = instanceById[session.instanceId];
    const project = projectForSession(session, projectsByInstance[session.instanceId] ?? []);
    const selected = key === selectedKey;
    const state = states[key] ?? 'idle';

    return (
      <motion.div
        key={key}
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
              onClick={() => onSelectSession(session)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <div className="mt-0.5">
                {/* Project/task/session identity is resolved once in App so every surface stays aligned,
                    including across instances that reuse session ids. */}
                <Blob
                  style={blobStyle}
                  seed={key}
                  identity={avatarIdentities[key]}
                  size={34}
                  state={state}
                  interactive={false}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {session.title ?? session.id}
                  </span>
                  <span className="flex-none text-[10.5px] tabular-nums text-muted-foreground transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
                    {relativeTime(session.updated, now)}
                  </span>
                </div>
                <span className="truncate text-[11.5px] leading-4">
                  {previews[key] ?? (session.directory ? normalizeDirectory(session.directory).split('/').pop() : '')}
                </span>
                <span className="flex items-center gap-1 truncate text-[10.5px] text-muted-foreground">
                  {state === 'needs-input' ? (
                    <span className="flex-none font-medium text-highlight">Needs input</span>
                  ) : null}
                  {state === 'needs-input' && (project || (multiInstance && instance)) ? (
                    <span aria-hidden>·</span>
                  ) : null}
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
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => onCustomizeAppearance(session)}>
              <Palette />
              Customize appearance…
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onArchive(session, !showArchived)}>
              <ArchiveIcon />
              {archiveLabel}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={archiveLabel}
              onClick={(event) => {
                event.stopPropagation();
                onArchive(session, !showArchived);
              }}
              className="absolute top-1.5 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <ArchiveIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{archiveLabel}</TooltipContent>
        </Tooltip>
      </motion.div>
    );
  };

  return (
    <aside
      className={cn(
        'mobile-rail fixed left-0 z-40 flex w-[min(88vw,320px)] flex-none flex-col border-r bg-card transition-transform duration-200 md:static md:z-auto md:w-[320px] md:translate-x-0',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}
    >
      <div className="flex flex-col gap-2 border-b p-2.5">
        {multiInstance ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="w-full justify-start" size="sm">
                <Plus />
                New agent
                <ChevronDown className="ml-auto opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
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
        ) : (
          <Button
            variant="secondary"
            className="w-full justify-start"
            size="sm"
            disabled={!defaultInstanceId}
            onClick={() => defaultInstanceId && onNewAgent(defaultInstanceId)}
          >
            <Plus />
            New agent
          </Button>
        )}

        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              placeholder={showArchived ? 'Search archived…' : 'Search sessions…'}
              aria-label="Search sessions"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query) {
                  event.preventDefault();
                  setQuery('');
                }
              }}
              className="h-8 pl-8 pr-7 text-xs shadow-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute top-1/2 right-1 -translate-y-1/2"
              >
                <X />
              </Button>
            ) : null}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                variant="outline"
                pressed={showArchived}
                onPressedChange={onShowArchived}
                aria-label="Show archived sessions"
                className="w-8 px-0 justify-center"
              >
                <ArchiveIcon className="size-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>{showArchived ? 'Back to active sessions' : 'Show archived sessions'}</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Sort sessions"
              >
                <ArrowDownUp className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuRadioGroup value={sorter} onValueChange={(value) => setSorter(value as Sorter)}>
                <DropdownMenuRadioItem value="recent">Recent activity</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant={activeFacet ? 'secondary' : 'outline'}
                disabled={facetGroups.length === 0}
                aria-label="Filter sessions"
              >
                <ListFilter className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[420px] min-w-[220px] overflow-y-auto">
              <DropdownMenuRadioGroup value={filter} onValueChange={setFilter}>
                <DropdownMenuRadioItem value={ALL_FILTER}>
                  All sessions
                  <span className="ml-auto pl-3 tabular-nums text-muted-foreground">{sessions.length}</span>
                </DropdownMenuRadioItem>
                {facetGroups.map((group) => (
                  <React.Fragment key={group.kind}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                      {FACET_TITLES[group.kind]}
                    </DropdownMenuLabel>
                    {group.facets.map((facet) => (
                      <DropdownMenuRadioItem key={facet.value} value={facetId(facet)}>
                        <span className="truncate">{facet.label}</span>
                        <span className="ml-auto pl-3 tabular-nums text-muted-foreground">{facet.count}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </React.Fragment>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {!selectedIsVisible && selectedSession
              ? [selectedSession, ...visible].map(renderSession)
              : visible.map(renderSession)}
          </AnimatePresence>
        </LayoutGroup>

        {visible.length === 0 && (!selectedSession || selectedIsVisible) ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-[12px] text-muted-foreground">
            <span>
              {loading
                ? 'Loading sessions…'
                : ready.length === 0
                  ? 'No connected instances. Open one in OpenChamber, then refresh.'
                  : needle
                    ? `No ${showArchived ? 'archived ' : ''}sessions match “${query.trim()}”.`
                    : filter !== ALL_FILTER
                      ? 'No sessions match this filter.'
                      : showArchived
                        ? 'No archived sessions.'
                        : windowLabel
                          ? `No sessions active in the ${windowLabel.toLowerCase()}. Widen the window in Settings.`
                          : 'No sessions yet.'}
            </span>
            {showArchived && !needle && filter === ALL_FILTER && ready.length > 0 ? (
              <Button size="xs" variant="outline" onClick={() => onShowArchived(false)}>
                Show active sessions
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t p-2">
        <Button variant="ghost" size="sm" className="w-full" onClick={onOpenSettings}>
          <Settings />
          Settings
        </Button>
      </div>
    </aside>
  );
}
