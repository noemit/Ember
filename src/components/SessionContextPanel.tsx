import * as React from 'react';
import { ChevronDown, FilePenLine, LocateFixed, Pin, PinOff, Reply, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../types';

type Section = 'notes' | 'pins';

type Props = {
  open: boolean;
  sessionTitle: string;
  note: string;
  pinnedMessages: ChatMessage[];
  focusSection: Section;
  focusRequest: number;
  onClose: () => void;
  onNoteChange: (note: string) => void;
  onInsertNote: (note: string) => void;
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

export default function SessionContextPanel({
  open,
  sessionTitle,
  note,
  pinnedMessages,
  focusSection,
  focusRequest,
  onClose,
  onNoteChange,
  onInsertNote,
  onJump,
  onReply,
  onUnpin,
}: Props) {
  const [draft, setDraft] = React.useState(note);
  const [pinsOpen, setPinsOpen] = React.useState(true);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const pinsRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => setDraft(note), [note, sessionTitle]);

  React.useEffect(() => {
    if (draft === note) return;
    const timer = window.setTimeout(() => onNoteChange(draft), 500);
    return () => window.clearTimeout(timer);
  }, [draft, note, onNoteChange]);

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

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            aria-label="Close session context"
            className="absolute inset-0 z-20 bg-black/25 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>
      <aside
        aria-hidden={!open}
        className={cn(
          'absolute inset-y-0 right-0 z-30 flex w-[min(400px,100%)] flex-col border-l bg-card shadow-2xl transition-transform duration-200 xl:static xl:z-auto xl:w-[380px] xl:shadow-none',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full xl:hidden'
        )}
      >
        <header className="flex h-11 flex-none items-center gap-2 border-b px-3.5">
          <FilePenLine className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">Session context</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close session context">
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3.5">
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</span>
                <span className="max-w-[260px] truncate text-[11px] text-muted-foreground">{sessionTitle}</span>
              </div>
              <span className="text-[10.5px] text-muted-foreground">{draft === note ? 'Saved' : 'Saving…'}</span>
            </div>
            <textarea
              ref={noteRef}
              value={draft}
              maxLength={20_000}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                if (draft !== note) onNoteChange(draft);
              }}
              placeholder="Upcoming prompts, reminders, decisions…"
              className="min-h-56 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] tabular-nums text-muted-foreground">{draft.length.toLocaleString()} / 20,000</span>
              <Button size="sm" variant="secondary" disabled={!draft.trim()} onClick={() => onInsertNote(draft)}>
                <Send />
                Insert into composer
              </Button>
            </div>
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
    </>
  );
}
