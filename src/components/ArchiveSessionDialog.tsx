import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Session } from '../types';

export default function ArchiveSessionDialog({ session, onCancel, onConfirm }: {
  session: Session;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const keepRef = React.useRef<HTMLButtonElement>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Archive active session?</DialogTitle>
          <DialogDescription>
            “{session.title ?? session.id}” has ongoing work, queued messages, or a pending request.
            Archiving hides it from active sessions. Ember will not send a stop command.
            You can restore it from the archive or use Undo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={keepRef} variant="secondary" onClick={onCancel}>Keep session</Button>
          <Button onClick={onConfirm}>Archive anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
