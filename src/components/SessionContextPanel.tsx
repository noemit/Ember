import * as React from 'react';
import { Check, ChevronDown, FilePenLine, LocateFixed, Pin, PinOff, Plus, Reply, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage, SessionNote } from '../types';

type Section = 'notes' | 'pins';

type Props = {
  open: boolean;
  sessionKey: string;
  sessionTitle: string;
  notes: SessionNote[];
  pinnedMessages: ChatMessage[];
  focusSection: Section;
  focusRequest: number;
  onClose: () => void;
  onNotesChange: (notes: SessionNote[]) => void;
  onInsertNotes: (text: string) => void;
  onJump: (messageId: string) => void;
  onReply: (message: ChatMessage) => void;
  onUnpin: (message: ChatMessage) => void;
};

const messageText = (message: ChatMessage): string =>
  message.text.trim() ||
  message.parts
    .map((part) => {
      if (part.type === 'reasoning') return part.text;
      if (part.type === 'file') return `File: ${part.file.filename}`;
      if (part.type === 'tool') return `${part.call.tool}: ${part.call.title ?? part.call.output ?? ''}`;
      return part.text;
    })
    .filter(Boolean)
    .join('\n');

let noteSequence = 0;
const createNoteId = (): string =>
  `note-${Date.now().toString(36)}-${(noteSequence = (noteSequence + 1) % 0xffff).toString(36)}`;

export default function SessionContextPanel({
  open,
  sessionKey,
  sessionTitle,
  notes,
  pinnedMessages,
  focusSection,
  focusRequest,
  onClose,
  onNotesChange,
  onInsertNotes,
  onJump,
  onReply,
  onUnpin,
}: Props) {
  const [draft, setDraft] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [pinsOpen, setPinsOpen] = React.useState(true);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const pinsRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    setDraft('');
    setSelectedIds(new Set());
  }, [sessionKey]);

  React.useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    if (focusSection === 'pins') {
      setPinsOpen(true);
      window.requestAnimationFrame(() => pinsRef.current?.scrollIntoView({ block: 'start' }));
    } else {
      window.requestAnimationFrame(() => noteRef.current?.focus());
    }
  }, [open, focusSection, focusRequest]);

  if (!open) return null;

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    onNotesChange([...notes, { id: createNoteId(), text }].slice(-100));
    setDraft('');
    window.requestAnimationFrame(() => noteRef.current?.focus());
  };

  const toggleNote = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeNote = (id: string) => {
    onNotesChange(notes.filter((note) => note.id !== id));
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const selectedText = notes
    .filter((note) => selectedIds.has(note.id))
    .map((note) => note.text.trim())
    .filter(Boolean)
    .join('\n\n');

  const appendSelected = () => {
    if (!selectedText) return;
    onInsertNotes(selectedText);
    setSelectedIds(new Set());
  };

  return (
    <aside className="flex w-[clamp(240px,38vw,380px)] flex-none flex-col border-l bg-card">
      <header className="flex h-11 flex-none items-center gap-2 border-b px-3.5">
        <FilePenLine className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">Notes</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close notes panel">
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3.5">
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New note</span>
              <span className="truncate text-[11px] text-muted-foreground">{sessionTitle}</span>
            </div>
            <span className="text-[10.5px] tabular-nums text-muted-foreground">{notes.length}/100</span>
          </div>
          <textarea
            ref={noteRef}
            value={draft}
            maxLength={20_000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                addNote();
              }
            }}
            placeholder="Save a prompt, reminder, or decision…"
            className="min-h-24 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-muted-foreground">⌘/Ctrl+Enter saves</span>
            <Button size="sm" variant="secondary" disabled={!draft.trim()} onClick={addNote}>
              <Plus />
              Add note
            </Button>
          </div>
        </section>

        <section className="mt-5 flex flex-col gap-2 border-t pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved notes</span>
            {selectedIds.size ? (
              <span className="text-[10.5px] tabular-nums text-highlight">{selectedIds.size} selected</span>
            ) : null}
          </div>
          {notes.length ? notes.map((note) => {
            const selected = selectedIds.has(note.id);
            return (
              <article
                key={note.id}
                className={cn(
                  'rounded-lg border bg-background/70 p-2.5 transition-colors',
                  selected && 'border-highlight/60 bg-highlight/5'
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-label={selected ? 'Deselect note' : 'Select note'}
                    onClick={() => toggleNote(note.id)}
                    className={cn(
                      'mt-0.5 flex size-4 flex-none items-center justify-center rounded border text-transparent transition-colors hover:border-highlight',
                      selected && 'border-highlight bg-highlight text-highlight-foreground'
                    )}
                  >
                    <Check className="size-3" />
                  </button>
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted-foreground">
                    {note.text}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeNote(note.id)}
                    aria-label="Delete note"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            );
          }) : (
            <p className="rounded-lg border border-dashed px-3 py-5 text-center text-[11.5px] text-muted-foreground">
              Save notes here, then select the ones you want to append to the composer.
            </p>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={!selectedText}
            onClick={appendSelected}
            className="mt-1 self-end"
          >
            <Send />
            Append selected
          </Button>
        </section>

        <section ref={pinsRef} className="mt-5 border-t pt-3.5">
          <button
            type="button"
            aria-expanded={pinsOpen}
            onClick={() => setPinsOpen((value) => !value)}
            className="flex w-full items-center gap-2 rounded-md py-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Pin className="size-3.5" />
            Pinned messages
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{pinnedMessages.length}</span>
            <ChevronDown className={cn('ml-auto size-3.5 transition-transform', !pinsOpen && '-rotate-90')} />
          </button>

          {pinsOpen ? (
            <div className="mt-2.5 flex flex-col gap-2">
              {pinnedMessages.length ? pinnedMessages.map((message) => (
                <article key={message.id} className="rounded-lg border bg-background/70 p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span className="font-medium capitalize text-foreground">{message.role}</span>
                    {message.createdAt ? <span>{new Date(message.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span> : null}
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted-foreground">
                    {messageText(message) || 'Message without text'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    <Button size="xs" variant="secondary" onClick={() => onJump(message.id)}>
                      <LocateFixed />
                      Jump
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onReply(message)}>
                      <Reply />
                      Reply
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onUnpin(message)}>
                      <PinOff />
                      Unpin
                    </Button>
                  </div>
                </article>
              )) : (
                <p className="rounded-lg border border-dashed px-3 py-5 text-center text-[11.5px] text-muted-foreground">
                  Pin useful messages in the transcript to collect them here.
                </p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </aside>
  );
}
