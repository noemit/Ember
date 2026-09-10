import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, CornerUpLeft, Loader2, NotebookPen, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { springTransition } from '@/lib/animation';
import type { SessionNote } from '../types';

type Props = {
  open: boolean;
  notes: SessionNote[];
  onOpenChange: (open: boolean) => void;
  onSend: (note: SessionNote) => Promise<boolean>;
  onBringBack: (note: SessionNote) => void;
  onDelete: (note: SessionNote) => void;
};

/**
 * Notes parked from the composer, shown above it like the queue but never dispatched on their own.
 * Each row can send as-is, bring the text back into the composer, or delete.
 */
export default function SessionNotes({ open, notes, onOpenChange, onSend, onBringBack, onDelete }: Props) {
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
      <CardContent className="flex items-stretch gap-1.5 p-2 text-[11.5px]">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={`Notes (${notes.length})`}
          title={open ? 'Collapse notes' : 'Expand notes'}
          className="flex w-7 flex-none flex-col items-center gap-0.5 rounded-md py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <span className="relative inline-flex">
            <NotebookPen className="size-3.5 text-highlight" />
            <span className="absolute -right-1.5 -top-1.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-highlight px-0.5 text-[9px] font-semibold leading-none text-highlight-foreground">
              {notes.length}
            </span>
          </span>
          <ChevronDown
            className={cn('size-3 flex-none transition-transform', !open && '-rotate-90')}
          />
        </button>
        {open ? (
        <ol className="flex min-w-0 max-h-28 flex-1 flex-col gap-1 overflow-y-auto">
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
                  {busy ? <Loader2 className="size-3 flex-none animate-spin text-highlight" /> : null}
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
        ) : null}
      </CardContent>
    </Card>
  );
}
