import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Paperclip, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BallState, BlobStyle, ChatMessage, Instance, ModelOption, Session } from '../types';

type Props = {
  session: Session | null;
  instance: Instance | null;
  seed: string;
  state: BallState;
  blobStyle: BlobStyle;
  messages: ChatMessage[];
  models: ModelOption[];
  defaultModelId: string | null;
  mru: string[];
  sending: boolean;
  onSend: (text: string, model: ModelOption | undefined, mode: string) => void;
};

const modelKey = (model: ModelOption) => `${model.providerID}/${model.modelID}`;

export default function ChatView({
  session,
  instance,
  seed,
  state,
  blobStyle,
  messages,
  models,
  defaultModelId,
  mru,
  sending,
  onSend,
}: Props) {
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState('build');
  const [modelId, setModelId] = React.useState('default');
  const [attachment, setAttachment] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { recent, rest } = React.useMemo(() => {
    const byKey = new Map(models.map((model) => [modelKey(model), model]));
    const recentModels = mru.map((key) => byKey.get(key)).filter((m): m is ModelOption => Boolean(m));
    const recentKeys = new Set(recentModels.map(modelKey));
    return { recent: recentModels, rest: models.filter((model) => !recentKeys.has(modelKey(model))) };
  }, [models, mru]);

  React.useEffect(() => {
    setModelId(defaultModelId ?? 'default');
  }, [defaultModelId, session?.instanceId]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, session?.id]);

  React.useEffect(() => {
    if (session) textareaRef.current?.focus();
  }, [session?.id]);

  const model = models.find((entry) => modelKey(entry) === modelId);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !session || sending) return;
    onSend(trimmed, model, mode);
    setText('');
    setAttachment(null);
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <AnimatePresence mode="wait">
        {session ? (
          <motion.div
            key={`${session.instanceId}:${session.id}`}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <header className="flex h-11 flex-none items-center gap-2.5 border-b px-4">
              <Blob style={blobStyle} seed={seed} size={24} state={state} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {session.title ?? session.id}
              </span>
              {instance ? (
                <Badge variant="secondary" className="font-normal text-muted-foreground">
                  {instance.label}
                </Badge>
              ) : null}
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mx-auto flex max-w-[760px] flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      layout="position"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className={cn(
                        'max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2 text-[13px] leading-relaxed',
                        message.role === 'user'
                          ? 'self-end rounded-br-sm bg-primary text-primary-foreground'
                          : 'self-start rounded-bl-sm bg-muted text-foreground'
                      )}
                    >
                      {message.text}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {messages.length === 0 ? (
                  <div className="py-16 text-center text-[12px] text-muted-foreground">
                    No messages yet — say hi.
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="flex -space-x-3">
              <Blob style={blobStyle} seed="empty one" size={48} interactive />
              <Blob style={blobStyle} seed="empty two" size={48} interactive />
              <Blob style={blobStyle} seed="empty three" size={48} interactive />
            </div>
            <span className="text-[13px]">Pick a session, or start a new agent.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-none border-t bg-card p-3">
        <div className="mx-auto flex max-w-[760px] flex-col gap-2">
          <motion.div
            layout
            className={cn(
              'flex flex-col rounded-xl border bg-background transition-[box-shadow,border-color] duration-200 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
              !session && 'opacity-60'
            )}
          >
            <textarea
              ref={textareaRef}
              value={text}
              rows={3}
              placeholder={session ? 'Message the agent…' : 'Select a session first'}
              disabled={!session}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[13px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />

            <div className="flex items-center gap-1.5 px-2 pb-2">
              <Select value={modelId} onValueChange={setModelId} disabled={!session}>
                <SelectTrigger size="sm" className="h-7 max-w-[260px] border-none bg-transparent px-2 text-xs shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
                  <SelectItem value="default">Default model</SelectItem>
                  {recent.length > 0 ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Recent</SelectLabel>
                        {recent.map((entry) => (
                          <SelectItem key={modelKey(entry)} value={modelKey(entry)}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                  {rest.length > 0 ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>All models</SelectLabel>
                        {rest.map((entry) => (
                          <SelectItem key={modelKey(entry)} value={modelKey(entry)}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                </SelectContent>
              </Select>

              <Select value={mode} onValueChange={setMode} disabled={!session}>
                <SelectTrigger size="sm" className="h-7 border-none bg-transparent px-2 text-xs shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build">Build</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
                </SelectContent>
              </Select>

              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(event) => setAttachment(event.target.files?.[0]?.name ?? null)}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7"
                disabled={!session}
                aria-label="Attach a file"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </Button>

              <AnimatePresence>
                {attachment ? (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
                  >
                    <span className="truncate">{attachment}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:text-foreground"
                      onClick={() => setAttachment(null)}
                      aria-label="Remove attachment"
                    >
                      <X className="size-3" />
                    </button>
                  </motion.span>
                ) : null}
              </AnimatePresence>

              <div className="flex-1" />

              <Button
                size="icon-sm"
                className="size-7 rounded-full"
                disabled={!session || !text.trim() || sending}
                onClick={submit}
                aria-label="Send"
              >
                <ArrowUp className={cn(sending && 'animate-pulse')} />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
