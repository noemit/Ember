import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CornerUpLeft, Loader2, NotebookPen, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { springTransition } from '@/lib/animation';
import type { SessionNote } from '../types';

type Props = {
  notes: SessionNote[];
  onSend: (note: SessionNote) => Promise<boolean>;
  onBringBack: (note: SessionNote) => void;
  onDelete: (note: SessionNote) => void;
};

/**
 * Notes parked from the composer, shown above it like the queue but never dispatched on their own.
 * Each row can send as-is, bring the text back into the composer, or delete.
 */
export default function SessionNotes({ notes, onSend, onBringBack, onDelete }: Props) {
  const [busyNoteId, setBusyNoteId] = React.useState<string | null>(null);

  const send = async (note: SessionNote) => {
    if (busyNoteId) return;
    setBusyNoteId(note.id);
    try {
      await onSend(note);
    } finally {
      setBusyNoteId((current) => (current === note.id ? null : current));
    }
  };

  if (notes.length === 0) return null;

  return (
    <Card className="bg-background/80 shadow-sm">
      <CardContent className="p-3 text-[11.5px]">
        <div className="mb-1.5 flex items-center gap-2 text-muted-foreground">
          <NotebookPen className="size-3.5 text-highlight" />
          <span className="font-medium text-foreground">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
          <span className="min-w-0 flex-1">Parked from the composer.</span>
        </div>
        <ol className="flex max-h-28 flex-col gap-1 overflow-y-auto">
          <AnimatePresence initial={false} mode="popLayout">
            {notes.map((note) => {
              const busy = busyNoteId === note.id;
              return (
                <motion.li
                  key={note.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={springTransition}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-3 flex-none animate-spin text-highlight" />
                  ) : (
                    <span className="size-1.5 flex-none rounded-full bg-highlight" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate" title={note.text}>
                    {note.text}
                  </span>
                  <div className="flex flex-none items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      onClick={() => onBringBack(note)}
                      aria-label={`Bring note back to composer: ${note.text.slice(0, 60)}`}
                      title="Bring back to composer"
                      className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <CornerUpLeft />
                      Bring back
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      onClick={() => void send(note)}
                      aria-label={`Send note: ${note.text.slice(0, 60)}`}
                      title="Send this note now"
                      className="px-1.5 text-[11px] text-muted-foreground hover:text-highlight"
                    >
                      <Send />
                      Send
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={busy}
                      onClick={() => onDelete(note)}
                      aria-label={`Delete note: ${note.text.slice(0, 60)}`}
                      title="Delete note"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X />
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </CardContent>
    </Card>
  );
}
