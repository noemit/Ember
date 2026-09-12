import * as React from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import { ChevronDown, Clock3, Plus, Search, Settings, X } from 'lucide-react';
import { projectForSession } from '../blob/seed';
import { cn } from '@/lib/utils';
import { useStableCallback } from '@/lib/useStableCallback';
import { buildRailEntries, type RailEntry } from '@/lib/projectGroups';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ProjectCard from './ProjectCard';
import SessionRow from './SessionRow';
import { sessionKey } from '../types';
import type { AvatarIdentity, BallMood, BlobStyle, Instance, InstanceDefaults, Project, Session } from '../types';

type Props = {
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
  instanceDefaults: Record<string, InstanceDefaults>;
  sessions: Session[];
  moods: Record<string, BallMood>;
  previews: Record<string, string>;
  selectedKey: string | null;
  /** Session keys currently open as workspace columns, for the project-card rings. */
  openKeys: Set<string>;
  avatarIdentities: Record<string, AvatarIdentity>;
  blobStyle: BlobStyle;
  loading: boolean;
  mobileOpen: boolean;
  reloadingKeys: Set<string>;
  archivingKeys: Set<string>;
  /** The currently open session, if any. Pinned to the rail when filters hide it. */
  selectedSession: Session | null;
  /** Human label for the recency window ("Last 2 days"), or null when everything is shown. */
  windowLabel: string | null;
  showScheduled: boolean;
  onShowScheduled: (value: boolean) => void;
  onSelectSession: (session: Session) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
  onNewAgent: (instanceId: string, directory?: string) => void;
  onOpenSettings: () => void;
};

const matchesQuery = (haystack: Array<string | undefined>, query: string): boolean =>
  haystack.some((value) => value?.toLowerCase().includes(query));

export default function LeftRail({
  instances,
  projectsByInstance,
  instanceDefaults,
  sessions,
  moods,
  previews,
  selectedKey,
  openKeys,
  avatarIdentities,
  blobStyle,
  loading,
  mobileOpen,
  reloadingKeys,
  archivingKeys,
  selectedSession,
  windowLabel,
  showScheduled,
  onShowScheduled,
  onSelectSession,
  onReload,
  onArchive,
  onCustomizeAppearance,
  onNewAgent,
  onOpenSettings,
}: Props) {
  const [query, setQuery] = React.useState('');

  const instanceById = React.useMemo(
    () => Object.fromEntries(instances.map((instance) => [instance.id, instance])),
    [instances]
  );
  const ready = React.useMemo(() => instances.filter((instance) => instance.attachable), [instances]);
  const multiInstance = ready.length > 1;
  const needle = query.trim().toLowerCase();

  // The selected session is pinned into the rail even when a filter would hide it.
  const itemSessions = React.useMemo(
    () =>
      selectedSession && !sessions.some((session) => sessionKey(session) === sessionKey(selectedSession))
        ? [...sessions, selectedSession]
        : sessions,
    [sessions, selectedSession]
  );

  const entries = React.useMemo(
    () =>
      showScheduled
        ? []
        : buildRailEntries(itemSessions, projectsByInstance, ready.map((instance) => instance.id)),
    [itemSessions, projectsByInstance, ready, showScheduled]
  );

  const matchesSession = React.useCallback(
    (session: Session) =>
      matchesQuery(
        [
          session.title,
          session.id,
          previews[sessionKey(session)],
          session.directory,
          instanceById[session.instanceId]?.label,
          projectForSession(session, projectsByInstance[session.instanceId] ?? [])?.name,
        ],
        needle
      ),
    [previews, instanceById, projectsByInstance, needle]
  );

  const railEntries = React.useMemo(() => {
    if (!needle) return entries;
    return entries.flatMap((entry): RailEntry[] => {
      if (entry.kind === 'session') return matchesSession(entry.session) ? [entry] : [];
      // A project-name hit shows the whole project; otherwise only its matching sessions.
      const projectMatches = entry.project.name.toLowerCase().includes(needle);
      const matched = entry.sessions.filter(matchesSession);
      const matchedSessions = projectMatches ? entry.sessions : matched;
      if (matchedSessions.length === 0) return [];
      return [{ ...entry, sessions: matchedSessions }];
    });
  }, [entries, matchesSession, needle]);

  const scheduledSessions = React.useMemo(
    () => (needle ? itemSessions.filter(matchesSession) : itemSessions),
    [itemSessions, matchesSession, needle]
  );

  const hasItems = showScheduled ? scheduledSessions.length > 0 : railEntries.length > 0;

  // Default target for "New agent": whichever instance was active most recently.
  const defaultInstanceId =
    [...sessions].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)).find(
      (session) => instanceById[session.instanceId]?.attachable
    )?.instanceId ??
    ready[0]?.id ??
    null;

  // App passes inline lambdas; pin their identity so the memoized rows actually hold.
  const selectSession = useStableCallback(onSelectSession);
  const reloadSession = useStableCallback(onReload);
  const archiveSession = useStableCallback(onArchive);
  const customizeAppearance = useStableCallback(onCustomizeAppearance);
  const newAgent = useStableCallback(onNewAgent);

  const renderSession = (session: Session) => {
    const key = sessionKey(session);
    const instance = instanceById[session.instanceId];
    return (
      <SessionRow
        key={key}
        session={session}
        instanceLabel={multiInstance ? instance?.label : undefined}
        projectName={projectForSession(session, projectsByInstance[session.instanceId] ?? [])?.name}
        preview={previews[key]}
        selected={key === selectedKey}
        mood={moods[key] ?? 'idle'}
        reloading={reloadingKeys.has(key)}
        archiving={archivingKeys.has(key)}
        markerColor={instanceDefaults[session.instanceId]?.markerColor}
        identity={avatarIdentities[key]}
        blobStyle={blobStyle}
        onSelect={selectSession}
        onReload={reloadSession}
        onArchive={archiveSession}
        onCustomizeAppearance={customizeAppearance}
      />
    );
  };

  const renderEntry = (entry: RailEntry) => {
    if (entry.kind === 'session') return renderSession(entry.session);
    const instance = instanceById[entry.instanceId];
    return (
      <ProjectCard
        key={entry.id}
        project={entry.project}
        instanceId={entry.instanceId}
        instanceLabel={multiInstance ? instance?.label : undefined}
        multiInstance={multiInstance}
        markerColor={instanceDefaults[entry.instanceId]?.markerColor}
        sessions={entry.sessions}
        moods={moods}
        selectedKey={selectedKey}
        openKeys={openKeys}
        avatarIdentities={avatarIdentities}
        blobStyle={blobStyle}
        reloadingKeys={reloadingKeys}
        archivingKeys={archivingKeys}
        onSelectSession={selectSession}
        onNewAgent={newAgent}
        onReload={reloadSession}
        onArchive={archiveSession}
        onCustomizeAppearance={customizeAppearance}
      />
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
            <DropdownMenuContent
              align="start"
              className="min-w-[220px]"
              // Picking an instance opens a draft whose composer takes focus; don't yank it back here.
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
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
              placeholder={showScheduled ? 'Search scheduled…' : 'Search sessions…'}
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
                pressed={showScheduled}
                onPressedChange={onShowScheduled}
                aria-label="Show scheduled sessions"
                className="w-8 justify-center px-0"
              >
                <Clock3 className="size-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>{showScheduled ? 'Back to active sessions' : 'Show scheduled sessions'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {showScheduled ? scheduledSessions.map(renderSession) : railEntries.map(renderEntry)}
          </AnimatePresence>
        </LayoutGroup>

        {!hasItems ? (
          <div className="px-3 py-8">
            {loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <Alert variant="default" className="border-dashed">
                <AlertDescription className="text-center text-[12px]">
                  {ready.length === 0
                    ? 'No connected instances. Open one in OpenChamber, then refresh.'
                    : needle
                      ? `No ${showScheduled ? 'scheduled ' : ''}sessions match “${query.trim()}”.`
                      : showScheduled
                        ? 'No scheduled sessions have been observed yet.'
                        : windowLabel
                          ? `No sessions active in the ${windowLabel.toLowerCase()}. Widen the window in Settings.`
                          : 'No sessions yet.'}
                </AlertDescription>
              </Alert>
            )}
            {showScheduled && !needle && ready.length > 0 ? (
              <Button
                size="xs"
                variant="outline"
                className="mx-auto mt-3 block"
                onClick={() => onShowScheduled(false)}
              >
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
