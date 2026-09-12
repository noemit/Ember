import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { projectForSession } from '../blob/seed';
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

/** Global archive: every archived session as an individual row, newest first, with restore. */
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

  const ordered = React.useMemo(
    () => [...sessions].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)),
    [sessions]
  );

  const renderSession = (session: Session) => {
    const key = sessionKey(session);
    return (
      <SessionRow
        key={key}
        session={session}
        instanceLabel={multiInstance ? instanceById[session.instanceId]?.label : undefined}
        projectName={projectForSession(session, projectsByInstance[session.instanceId] ?? [])?.name}
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
            Restore a session to bring it back to the rail.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
          {ordered.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">
              No archived sessions.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">{ordered.map(renderSession)}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
