import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildRailEntries } from '@/lib/projectGroups';
import SessionRow from './SessionRow';
import { sessionKey } from '../types';
import type {
  AvatarIdentity,
  BallMood,
  BlobStyle,
  Instance,
  InstanceDefaults,
  Project,
  Session,
} from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Archived sessions, across every connected instance. */
  sessions: Session[];
  projectsByInstance: Record<string, Project[]>;
  instances: Instance[];
  moods: Record<string, BallMood>;
  previews: Record<string, string>;
  avatarIdentities: Record<string, AvatarIdentity>;
  blobStyle: BlobStyle;
  instanceDefaults: Record<string, InstanceDefaults>;
  reloadingKeys: Set<string>;
  archivingKeys: Set<string>;
  /** Restores the session and opens it (archived sessions can't stay open). */
  onRestoreSession: (session: Session) => void;
  onReload: (session: Session) => void;
  onArchive: (session: Session, archived: boolean) => void;
  onCustomizeAppearance: (session: Session) => void;
};

/** Global archive: every archived session, grouped by project, with restore. */
export default function ArchiveDialog({
  open,
  onOpenChange,
  sessions,
  projectsByInstance,
  instances,
  moods,
  previews,
  avatarIdentities,
  blobStyle,
  instanceDefaults,
  reloadingKeys,
  archivingKeys,
  onRestoreSession,
  onReload,
  onArchive,
  onCustomizeAppearance,
}: Props) {
  const instanceById = React.useMemo(
    () => Object.fromEntries(instances.map((instance) => [instance.id, instance])),
    [instances]
  );
  const multiInstance = instances.filter((instance) => instance.attachable).length > 1;

  const entries = React.useMemo(
    () => buildRailEntries(sessions, projectsByInstance),
    [sessions, projectsByInstance]
  );

  const renderSession = (session: Session, projectName: string | undefined) => {
    const key = sessionKey(session);
    return (
      <SessionRow
        key={key}
        session={session}
        instanceLabel={multiInstance ? instanceById[session.instanceId]?.label : undefined}
        projectName={projectName}
        preview={previews[key]}
        selected={false}
        mood={moods[key] ?? 'idle'}
        reloading={reloadingKeys.has(key)}
        archiving={archivingKeys.has(key)}
        markerColor={instanceDefaults[session.instanceId]?.markerColor}
        identity={avatarIdentities[key]}
        blobStyle={blobStyle}
        onSelect={onRestoreSession}
        onReload={onReload}
        onArchive={onArchive}
        onCustomizeAppearance={onCustomizeAppearance}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Archived sessions</DialogTitle>
          <DialogDescription>
            Restore a session to bring it back to its project on the rail.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
          {entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">
              No archived sessions.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) =>
                entry.kind === 'project' ? (
                  <div key={entry.id} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-1.5 px-2.5 pt-1">
                      <span className="truncate text-[11.5px] font-semibold text-foreground">
                        {entry.project.name}
                      </span>
                      {multiInstance ? (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {instanceById[entry.instanceId]?.label}
                        </span>
                      ) : null}
                    </div>
                    {entry.sessions.map((session) => renderSession(session, entry.project.name))}
                  </div>
                ) : (
                  <div key={entry.id} className="flex flex-col gap-0.5">
                    {renderSession(entry.session, undefined)}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
