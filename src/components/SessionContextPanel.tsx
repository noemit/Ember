import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  FilePenLine,
  LocateFixed,
  Pin,
  PinOff,
  Plus,
  Reply,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { cn } from '@/lib/utils';
import { springTransition } from '@/lib/animation';
import type { ChatMessage, SessionNote } from '../types';

type Section = 'notes' | 'pins';

type Props = {
  /** Expanded vs the collapsed icon strip. The column itself is always rendered. */
  open: boolean;
  sessionKey: string;
  sessionTitle: string;
  notes: SessionNote[];
  pinnedMessages: ChatMessage[];
  focusSection: Section;
  focusRequest: number;
  onClose: () => void;
  /** Expand the column on a given section; the collapsed strip calls this. */
  onOpen: (section: Section) => void;
  onNotesChange: (notes: SessionNote[]) => void;
  onDeleteNote: (note: SessionNote) => void;
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
  onOpen,
  onNotesChange,
  onDeleteNote,
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

  if (!open) {
    return (
      <aside
        className="flex w-11 flex-none flex-col items-center justify-center gap-1 self-stretch rounded-xl border bg-background px-1 py-1.5"
        aria-label="Notes and pins"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpen('notes')}
          aria-label="Open notes"
          title="Notes"
          className="size-8"
        >
          <FilePenLine className="size-4" />
        </Button>
        {pinnedMessages.length ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpen('pins')}
            aria-label={`Open ${pinnedMessages.length} pinned ${pinnedMessages.length === 1 ? 'message' : 'messages'}`}
            title="Pinned messages"
            className="flex size-8 flex-col items-center justify-center gap-0.5"
          >
            <Pin className="size-4" />
            <span className="text-[9px] leading-none tabular-nums">{pinnedMessages.length}</span>
          </Button>
        ) : null}
      </aside>
    );
  }

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

  const removeNote = (note: SessionNote) => {
    onDeleteNote(note);
    setSelectedIds((current) => {
      if (!current.has(note.id)) return current;
      const next = new Set(current);
      next.delete(note.id);
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
    <aside className="relative w-[min(50%,560px)] flex-none self-stretch overflow-hidden rounded-xl border bg-background">
      <div className="absolute inset-0 flex flex-col">
        <header className="flex h-9 flex-none items-center gap-2 border-b px-3">
          <FilePenLine className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">Notes</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close notes panel">
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 pb-0">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New note
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{sessionTitle}</span>
              </div>
              <span className="text-[10.5px] tabular-nums text-muted-foreground">{notes.length}/100</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-3 pt-2">
              <AutoResizeTextarea
                ref={noteRef}
                value={draft}
                maxLength={20_000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addNote();
                  }
                }}
                placeholder="Save a prompt, reminder, or decision…"
                className="min-h-24 bg-transparent text-[13px] leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-muted-foreground">⌘/Ctrl+Enter saves</span>
                <Button size="sm" variant="secondary" disabled={!draft.trim()} onClick={addNote}>
                  <Plus />
                  Add note
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-4" />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saved notes
              </span>
              {selectedIds.size ? (
                <span className="text-[10.5px] tabular-nums text-highlight">{selectedIds.size} selected</span>
              ) : null}
            </div>

            <AnimatePresence initial={false} mode="popLayout">
              {notes.length ? (
                notes.map((note) => {
                  const selected = selectedIds.has(note.id);
                  return (
                    <motion.div
                      key={note.id}
                      layout="position"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={springTransition}
                    >
                      <Card className={cn('transition-colors', selected && 'border-highlight/60 bg-highlight/5')}>
                        <CardContent className="flex items-start gap-2 p-2.5">
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
                            onClick={() => removeNote(note)}
                            aria-label="Delete note"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div
                  key="empty-notes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={springTransition}
                >
                  <Alert variant="default" className="border-dashed">
                    <AlertDescription className="text-center text-[11.5px]">
                      Save notes here, then select the ones you want to append to the composer.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

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

          <Separator className="my-4" />

          <section ref={pinsRef}>
            <Button
              type="button"
              variant="ghost"
              aria-expanded={pinsOpen}
              onClick={() => setPinsOpen((value) => !value)}
              className="flex h-auto w-full items-center justify-start gap-2 px-0 py-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Pin className="size-3.5" />
              Pinned messages
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {pinnedMessages.length}
              </span>
              <ChevronDown className={cn('ml-auto size-3.5 transition-transform', !pinsOpen && '-rotate-90')} />
            </Button>

            <AnimatePresence initial={false}>
              {pinsOpen ? (
                <motion.div
                  key="pins"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={springTransition}
                  className="overflow-hidden"
                >
                  <div className="mt-2.5 flex flex-col gap-2">
                    {pinnedMessages.length ? (
                      pinnedMessages.map((message) => (
                        <Card key={message.id}>
                          <CardContent className="p-3">
                            <div className="mb-1.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                              <span className="font-medium capitalize text-foreground">{message.role}</span>
                              {message.createdAt ? (
                                <span>
                                  {new Date(message.createdAt).toLocaleString([], {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              ) : null}
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
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Alert variant="default" className="border-dashed">
                        <AlertDescription className="text-center text-[11.5px]">
                          Pin useful messages in the transcript to collect them here.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </aside>
  );
}
