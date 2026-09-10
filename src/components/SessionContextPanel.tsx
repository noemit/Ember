import * as React from 'react';
import { FilePenLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';

type Props = {
  /** Expanded vs the collapsed icon strip. The column itself is always rendered. */
  open: boolean;
  sessionKey: string;
  note: string;
  onClose: () => void;
  /** Expand the column; the collapsed strip calls this. */
  onOpen: () => void;
  onNoteChange: (sessionKey: string, text: string) => void;
};

const NOTE_SAVE_DEBOUNCE_MS = 500;

/**
 * One freeform note per session, styled like the composer. Edits are debounced and flushed on
 * blur/unmount/session switch so the note always lands on the session it was typed in.
 */
export default function SessionContextPanel({
  open,
  sessionKey,
  note,
  onClose,
  onOpen,
  onNoteChange,
}: Props) {
  const [draft, setDraft] = React.useState(note);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const pendingRef = React.useRef<{ key: string; text: string; timer: number } | null>(null);
  const onNoteChangeRef = React.useRef(onNoteChange);
  onNoteChangeRef.current = onNoteChange;

  const flush = React.useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingRef.current = null;
    onNoteChangeRef.current(pending.key, pending.text);
  }, []);

  const scheduleSave = (key: string, text: string) => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
    pendingRef.current = {
      key,
      text,
      timer: window.setTimeout(() => {
        pendingRef.current = null;
        onNoteChangeRef.current(key, text);
      }, NOTE_SAVE_DEBOUNCE_MS),
    };
  };

  // Flush the previous session's pending edit before its key changes out from under it.
  React.useEffect(() => {
    flush();
  }, [sessionKey, flush]);

  // Adopt the incoming note, but never clobber an edit that hasn't been saved yet — that covers
  // both typing and settings that hydrate after this panel mounts.
  React.useEffect(() => {
    if (pendingRef.current) return;
    setDraft(note);
  }, [note]);

  React.useEffect(() => () => flush(), [flush]);

  React.useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => noteRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) {
    return (
      <aside
        className="flex w-11 flex-none flex-col items-center justify-center gap-1 self-stretch rounded-xl border bg-background px-1 py-1.5"
        aria-label="Session notes"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpen}
          aria-label="Open notes"
          title="Notes"
          className="size-8"
        >
          <FilePenLine className="size-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="relative w-[min(50%,560px)] flex-none self-start" aria-label="Session notes">
      <div className="flex flex-col rounded-xl border bg-background transition-[box-shadow,border-color] duration-200 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        <AutoResizeTextarea
          ref={noteRef}
          value={draft}
          maxHeight={200}
          placeholder="Session notes…"
          aria-label="Session notes"
          onChange={(event) => {
            setDraft(event.target.value);
            scheduleSave(sessionKey, event.target.value);
          }}
          onBlur={flush}
          className="min-h-9 w-full bg-transparent py-2 pl-3 pr-9 text-base placeholder:text-muted-foreground focus-visible:border-input focus-visible:ring-0 sm:pl-3.5 sm:text-[13px]"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        aria-label="Close notes"
        title="Close notes"
        className="absolute right-1.5 top-1.5 text-muted-foreground"
      >
        <X />
      </Button>
    </aside>
  );
}
