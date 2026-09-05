import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  Brain,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Loader2,
  MessageCircleQuestion,
  Pin,
  PinOff,
  Reply,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import Linkify from './Linkify';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  BallState,
  ChatMessage,
  FileAttachment,
  MessagePart,
  MessagesStatus,
  PermissionReply,
  PermissionRequest,
  QuestionAnswers,
  QuestionInfo,
  QuestionRequest,
  ToolCall,
} from '../types';

const Markdown = React.lazy(() => import('./Markdown'));
const MarkdownFallback = ({ text }: { text: string }) => (
  <span className="whitespace-pre-wrap break-words">{text}</span>
);

type Props = {
  messages: ChatMessage[];
  messagesStatus: MessagesStatus;
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  state: BallState;
  sending: boolean;
  /** CSS colour of the session's blob, so the activity line reads as "this agent is thinking". */
  accentColor: string;
  pinnedMessageIds: Set<string>;
  focusMessageId: string | null;
  focusRequest: number;
  onTogglePin: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onPermission: (request: PermissionRequest, reply: PermissionReply) => Promise<boolean>;
  /** `null` answers means the user dismissed the question. */
  onQuestion: (request: QuestionRequest, answers: QuestionAnswers | null) => Promise<boolean>;
};

/** How close to the bottom (px) still counts as "following" the conversation. */
const FOLLOW_THRESHOLD = 48;

const spring = { type: 'spring', stiffness: 420, damping: 32 } as const;

/** Consecutive text (or reasoning) parts collapse into one block; files and tools stay separate. */
type Block =
  | { type: 'text'; id: string; text: string }
  | { type: 'reasoning'; id: string; text: string }
  | { type: 'file'; id: string; file: FileAttachment }
  | { type: 'tools'; id: string; tool: string; calls: ToolCall[] };

const toBlocks = (parts: MessagePart[]): Block[] => {
  const blocks: Block[] = [];
  parts.forEach((part) => {
    const last = blocks[blocks.length - 1];
    if ((part.type === 'text' || part.type === 'reasoning') && last?.type === part.type) {
      last.text += part.type === 'reasoning' ? `\n\n${part.text}` : part.text;
    } else if (part.type === 'text' || part.type === 'reasoning') {
      blocks.push({ type: part.type, id: part.id, text: part.text });
    } else if (part.type === 'file') {
      blocks.push({ type: 'file', id: part.id, file: part.file });
    } else if (last?.type === 'tools' && last.tool === part.call.tool) {
      last.calls.push(part.call);
    } else {
      blocks.push({ type: 'tools', id: part.id, tool: part.call.tool, calls: [part.call] });
    }
  });
  return blocks;
};

const metaString = (metadata: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
};

/** The one thing worth showing for a permission: the command, the file, or the URL. */
const permissionDetail = (request: PermissionRequest): string => {
  const tool = request.permission.toLowerCase();
  const { metadata } = request;
  if (tool === 'bash' || tool === 'shell') return metaString(metadata, ['command', 'cmd', 'script']);
  if (tool === 'webfetch' || tool === 'fetch') return metaString(metadata, ['url', 'uri']);
  const path = metaString(metadata, ['filePath', 'file_path', 'path', 'filename']);
  if (path) return path;
  return request.patterns.join('\n');
};

const isRenderableImage = (file: FileAttachment): boolean =>
  file.mime.startsWith('image/') && /^(data:|https?:\/\/)/.test(file.url);

/** A tool's input as a one-liner when it's a command, otherwise compact JSON. */
const describeInput = (input: Record<string, unknown>): string => {
  const command = input.command;
  if (typeof command === 'string') return command;
  return JSON.stringify(input, null, 2);
};

const panelClass =
  'max-h-64 overflow-auto rounded-md bg-background/70 px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all';

const DiffView = ({ diff }: { diff: string }) => (
  <pre className={panelClass}>
    {diff.split('\n').map((line, index) => (
      <span
        key={index}
        className={cn(
          'block',
          line.startsWith('+') && !line.startsWith('+++') && 'bg-emerald-500/15 text-emerald-300',
          line.startsWith('-') && !line.startsWith('---') && 'bg-red-500/15 text-red-300',
          line.startsWith('@@') && 'text-muted-foreground'
        )}
      >
        {line || ' '}
      </span>
    ))}
  </pre>
);

const ToolRow = ({ call }: { call: ToolCall }) => {
  const [open, setOpen] = React.useState(false);
  const hasDetail = Boolean(call.input || call.output || call.diff || call.error);

  return (
    <div className="flex max-w-[85%] flex-col self-start">
      <button
        type="button"
        disabled={!hasDetail}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-[11.5px] text-muted-foreground',
          hasDetail && 'hover:bg-muted/60 hover:text-foreground',
          call.status === 'error' && 'text-destructive'
        )}
        title={call.error ?? call.title}
      >
        {call.status === 'completed' ? (
          <Check className="size-3 flex-none text-emerald-500" />
        ) : call.status === 'error' ? (
          <CircleAlert className="size-3 flex-none" />
        ) : (
          <Loader2 className="size-3 flex-none animate-spin" />
        )}
        <span className="flex-none font-mono text-[11px]">{call.tool}</span>
        {call.title ? <span className="min-w-0 truncate font-mono opacity-80">{call.title}</span> : null}
        {hasDetail ? (
          <ChevronRight className={cn('size-3 flex-none opacity-60 transition-transform', open && 'rotate-90')} />
        ) : null}
      </button>

      {open ? (
        <div className="ml-6 mt-1 flex flex-col gap-1.5 text-[11px]">
          {call.input && !call.diff ? <pre className={panelClass}>{describeInput(call.input)}</pre> : null}
          {call.diff ? <DiffView diff={call.diff} /> : null}
          {call.error ? <pre className={cn(panelClass, 'text-destructive')}>{call.error}</pre> : null}
          {call.output ? <pre className={panelClass}>{call.output}</pre> : null}
        </div>
      ) : null}
    </div>
  );
};

const groupedToolTitle = (tool: string, count: number): string => {
  const normalized = tool.toLowerCase();
  if (normalized === 'read') return `Read ${count} files`;
  if (normalized === 'edit' || normalized === 'write') return `Edited ${count} files`;
  if (normalized === 'grep' || normalized === 'glob') return `Ran ${count} searches`;
  if (normalized === 'webfetch') return `Fetched ${count} pages`;
  return `${tool} × ${count}`;
};

const ToolGroupRow = ({ tool, calls }: { tool: string; calls: ToolCall[] }) => {
  const [open, setOpen] = React.useState(false);
  if (calls.length === 1) return <ToolRow call={calls[0]} />;
  const status = calls.some((call) => call.status === 'error')
    ? 'error'
    : calls.some((call) => call.status === 'running' || call.status === 'pending')
      ? 'running'
      : 'completed';

  return (
    <div className="flex max-w-[85%] flex-col self-start">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-[11.5px] text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          status === 'error' && 'text-destructive'
        )}
      >
        {status === 'completed' ? (
          <Check className="size-3 flex-none text-emerald-500" />
        ) : status === 'error' ? (
          <CircleAlert className="size-3 flex-none" />
        ) : (
          <Loader2 className="size-3 flex-none animate-spin" />
        )}
        <span>{groupedToolTitle(tool, calls.length)}</span>
        <ChevronRight className={cn('size-3 flex-none opacity-60 transition-transform', open && 'rotate-90')} />
      </button>
      {open ? (
        <div className="ml-3 mt-1 flex flex-col gap-1 border-l pl-2">
          {calls.map((call) => (
            <ToolRow key={call.id} call={call} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ReasoningRow = ({ text }: { text: string }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex max-w-[85%] flex-col self-start">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-[11.5px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        <Brain className="size-3 flex-none" />
        <span>Thinking</span>
        <ChevronRight className={cn('size-3 flex-none opacity-60 transition-transform', open && 'rotate-90')} />
      </button>
      {open ? (
        <div className="ml-6 mt-1 rounded-md bg-background/50 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          <React.Suspense fallback={<MarkdownFallback text={text} />}>
            <Markdown text={text} />
          </React.Suspense>
        </div>
      ) : null}
    </div>
  );
};

const FileBlock = ({ file, mine }: { file: FileAttachment; mine: boolean }) =>
  isRenderableImage(file) ? (
    <img
      src={file.url}
      alt={file.filename}
      title={file.filename}
      className={cn('max-h-64 max-w-[70%] rounded-xl border', mine ? 'self-end' : 'self-start')}
    />
  ) : (
    <span
      title={file.filename}
      className={cn(
        'flex max-w-[70%] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]',
        mine ? 'self-end' : 'self-start'
      )}
    >
      <FileText className="size-3.5 flex-none text-muted-foreground" />
      <span className="truncate">{file.filename}</span>
    </span>
  );

const MessageError = ({ error }: { error: string }) => (
  <div
    role="alert"
    className="flex max-w-[85%] items-start gap-2 self-start rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-[12.5px] text-destructive"
  >
    <CircleAlert className="mt-0.5 size-4 flex-none" />
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-medium">OpenCode failed to send the message</span>
      <span className="whitespace-pre-wrap break-words text-foreground">{error}</span>
    </div>
  </div>
);

const PermissionCard = ({
  request,
  onReply,
}: {
  request: PermissionRequest;
  onReply: (reply: PermissionReply) => Promise<boolean>;
}) => {
  const [busy, setBusy] = React.useState<PermissionReply | null>(null);
  const detail = permissionDetail(request);
  const description = metaString(request.metadata, ['description']);

  const reply = async (value: PermissionReply) => {
    setBusy(value);
    if (!(await onReply(value))) setBusy(null);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring}
      className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 px-3.5 py-3 text-[13px]"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 flex-none text-warning" />
        <span className="font-medium">Approval needed</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {request.permission}
        </span>
      </div>
      {description ? <p className="text-[12px] text-muted-foreground">{description}</p> : null}
      {detail ? (
        <pre className="max-h-48 overflow-auto rounded-md bg-background/80 px-2.5 py-2 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all">
          {detail}
        </pre>
      ) : null}
      <div className="flex items-center gap-1.5 pt-0.5">
        <Button size="xs" variant="outline" disabled={busy !== null} onClick={() => void reply('reject')}>
          Deny
        </Button>
        <div className="flex-1" />
        <Button size="xs" variant="secondary" disabled={busy !== null} onClick={() => void reply('always')}>
          Always allow
        </Button>
        <Button size="xs" disabled={busy !== null} onClick={() => void reply('once')}>
          {busy === 'once' ? <Loader2 className="animate-spin" /> : <Check />}
          Allow once
        </Button>
      </div>
    </motion.div>
  );
};

/** Answer state for one question: chosen option labels, plus optional free text. */
type Draft = { picked: string[]; custom: string };

const QuestionCard = ({
  request,
  onAnswer,
}: {
  request: QuestionRequest;
  onAnswer: (answers: QuestionAnswers | null) => Promise<boolean>;
}) => {
  const [busy, setBusy] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Draft[]>(() =>
    request.questions.map(() => ({ picked: [], custom: '' }))
  );

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  const toggle = (index: number, question: QuestionInfo, label: string) => {
    const draft = drafts[index];
    const picked = question.multiple
      ? draft.picked.includes(label)
        ? draft.picked.filter((entry) => entry !== label)
        : [...draft.picked, label]
      : [label];
    update(index, { picked, custom: '' });
  };

  // Free text replaces the picks for that question, mirroring OpenChamber's card.
  const answerFor = (draft: Draft): string[] =>
    draft.custom.trim() ? [draft.custom.trim()] : draft.picked;
  const complete = drafts.every((draft) => answerFor(draft).length > 0);

  const submit = async () => {
    if (!complete) return;
    setBusy(true);
    if (!(await onAnswer(drafts.map(answerFor)))) setBusy(false);
  };

  const dismiss = async () => {
    setBusy(true);
    if (!(await onAnswer(null))) setBusy(false);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring}
      className="flex flex-col gap-3 rounded-xl border border-highlight/40 bg-highlight/5 px-3.5 py-3 text-[13px]"
    >
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="size-4 flex-none text-highlight" />
        <span className="font-medium">The agent has a question</span>
      </div>

      {request.questions.map((question, index) => {
        const draft = drafts[index];
        return (
          <div key={index} className="flex flex-col gap-1.5">
            {request.questions.length > 1 && question.header ? (
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {question.header}
              </span>
            ) : null}
            <p className="whitespace-pre-wrap">{question.question}</p>
            <div className="flex flex-col gap-1">
              {question.options.map((option) => {
                const picked = draft.picked.includes(option.label) && !draft.custom.trim();
                return (
                  <button
                    key={option.label}
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(index, question, option.label)}
                    aria-pressed={picked}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                      picked ? 'border-highlight/60 bg-highlight/10' : 'border-border hover:bg-muted/60'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-[3px] flex size-3.5 flex-none items-center justify-center border',
                        question.multiple ? 'rounded-[3px]' : 'rounded-full',
                        picked ? 'border-highlight bg-highlight text-highlight-foreground' : 'border-muted-foreground/50'
                      )}
                    >
                      {picked ? <Check className="size-2.5" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[12.5px]">{option.label}</span>
                      {option.description ? (
                        <span className="text-[11.5px] text-muted-foreground">{option.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {question.custom !== false ? (
              <Input
                value={draft.custom}
                disabled={busy}
                aria-label={question.header ? `${question.header} custom answer` : 'Custom answer'}
                placeholder="Or type your own answer…"
                onChange={(event) => update(index, { custom: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void submit();
                  }
                }}
                className="h-8 text-xs shadow-none"
              />
            ) : null}
          </div>
        );
      })}

      <div className="flex items-center gap-1.5">
        <Button
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={() => void dismiss()}
        >
          Dismiss
        </Button>
        <div className="flex-1" />
        <Button size="xs" disabled={busy || !complete} onClick={() => void submit()}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          Answer
        </Button>
      </div>
    </motion.div>
  );
};

const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) return `${Math.max(0, Math.round(milliseconds))}ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
};

export const isAssistantTurnEnd = (
  messages: ChatMessage[],
  index: number,
  turnPending: boolean
): boolean => {
  const message = messages[index];
  if (message?.role !== 'assistant' || messages[index + 1]?.role === 'assistant') return false;
  return index < messages.length - 1 || !turnPending;
};

const MessageFooter = ({
  message,
  showMetadata,
  pinned,
  onReply,
}: {
  message: ChatMessage;
  showMetadata: boolean;
  pinned: boolean;
  onReply: () => void;
}) => {
  const duration =
    showMetadata && message.createdAt !== undefined && message.completedAt !== undefined
      ? formatDuration(message.completedAt - message.createdAt)
      : null;
  const model = showMetadata
    ? message.model
      ? `${message.model.providerID} / ${message.model.modelID}`
      : 'Model unavailable'
    : null;
  if (!model && !duration && !pinned) return null;

  return (
    <div
      className={cn(
        'flex max-w-[85%] items-center gap-2 px-1 text-[10.5px] text-muted-foreground',
        message.role === 'user' ? 'self-end' : 'self-start'
      )}
    >
      {model ? <span>{model}</span> : null}
      {duration ? <span>· {duration}</span> : null}
      {pinned ? (
        <button
          type="button"
          onClick={onReply}
          className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
        >
          <Reply className="size-3" />
          Reply
        </button>
      ) : null}
    </div>
  );
};

export default function Transcript({
  messages,
  messagesStatus,
  permissions,
  questions,
  state,
  sending,
  accentColor,
  pinnedMessageIds,
  focusMessageId,
  focusRequest,
  onTogglePin,
  onReply,
  onPermission,
  onQuestion,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const messageRefs = React.useRef(new Map<string, HTMLDivElement>());
  const followRef = React.useRef(true);
  const [following, setFollowing] = React.useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  React.useEffect(() => {
    if (!focusMessageId || focusRequest === 0) return;
    const message = messageRefs.current.get(focusMessageId);
    if (!message) return;
    followRef.current = false;
    setFollowing(false);
    setHighlightedMessageId(focusMessageId);
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightedMessageId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, focusRequest]);

  // Stay pinned while the user is at the bottom; growth from streaming text, tool rows
  // or enter animations all land here via the ResizeObserver rather than per-update effects.
  React.useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if (!content || !scroller) return;
    const pin = () => {
      if (followRef.current) scrollToBottom();
    };
    const observer = new ResizeObserver(pin);
    observer.observe(content);
    // A smooth scroll still in flight wins over scrollTo calls made during it; re-pin once it settles.
    scroller.addEventListener('scrollend', pin);
    scrollToBottom();
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scrollend', pin);
    };
  }, [scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = distance <= FOLLOW_THRESHOLD;
    if (next !== followRef.current) {
      followRef.current = next;
      setFollowing(next);
    }
  };

  const jumpToLatest = () => {
    followRef.current = true;
    setFollowing(true);
    scrollToBottom('smooth');
  };

  const last = messages[messages.length - 1];
  const busy = sending || state === 'active' || (last?.role === 'assistant' && !last.completed);
  const runningTool = last?.role === 'assistant'
    ? [...last.parts]
        .reverse()
        .find((part) => part.type === 'tool' && (part.call.status === 'running' || part.call.status === 'pending'))
    : undefined;
  const blocked = permissions.length > 0 || questions.length > 0;
  const turnPending = busy || blocked;
  // The running tool row above already shows the command; this line just says what phase we're in.
  const activity = blocked || !busy
    ? null
    : sending && last?.role === 'user'
      ? 'Sending…'
      : runningTool?.type === 'tool'
        ? `Running ${runningTool.call.tool}`
        : 'Thinking';

  const renderBlock = (message: ChatMessage, block: Block) => {
    const mine = message.role === 'user';
    if (block.type === 'text') {
      return (
        <motion.div
          key={block.id}
          layout="position"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring}
          className={cn(
            'max-w-[85%] rounded-xl px-3.5 py-2 text-[13px] leading-relaxed',
            mine
              ? 'self-end whitespace-pre-wrap break-words rounded-br-sm bg-user-bubble text-user-bubble-foreground'
              : 'self-start rounded-bl-sm bg-muted text-foreground'
          )}
        >
          {mine ? (
            <Linkify text={block.text} />
          ) : (
            <React.Suspense fallback={<MarkdownFallback text={block.text} />}>
              <Markdown text={block.text} />
            </React.Suspense>
          )}
        </motion.div>
      );
    }
    return (
      <motion.div
        key={block.id}
        layout="position"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex flex-col"
      >
        {block.type === 'tools' ? (
          <ToolGroupRow tool={block.tool} calls={block.calls} />
        ) : block.type === 'reasoning' ? (
          <ReasoningRow text={block.text} />
        ) : (
          <FileBlock file={block.file} mine={mine} />
        )}
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        <div
          ref={contentRef}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={busy && !blocked}
          className="mx-auto flex max-w-[760px] flex-col gap-2.5"
        >
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                ref={(node) => {
                  if (node) messageRefs.current.set(message.id, node);
                  else messageRefs.current.delete(message.id);
                }}
                layout="position"
                className={cn(
                  'group/message relative flex w-full flex-col gap-1.5 rounded-xl px-5 transition-[background-color,box-shadow] sm:px-7',
                  highlightedMessageId === message.id && 'bg-highlight/10 ring-2 ring-highlight/30'
                )}
              >
                {toBlocks(message.parts).map((block) => renderBlock(message, block))}
                {message.error ? <MessageError error={message.error} /> : null}
                <button
                  type="button"
                  onClick={() => onTogglePin(message)}
                  title={pinnedMessageIds.has(message.id) ? 'Unpin message' : 'Pin this message'}
                  aria-label={pinnedMessageIds.has(message.id) ? 'Unpin message' : 'Pin this message'}
                  className={cn(
                    'absolute top-1 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-50 transition-[color,background-color,opacity] hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 sm:opacity-0 sm:group-hover/message:opacity-100',
                    message.role === 'user' ? 'right-0' : 'left-0',
                    pinnedMessageIds.has(message.id) && 'text-highlight'
                  )}
                >
                  {pinnedMessageIds.has(message.id) ? (
                    <PinOff className="size-3.5" />
                  ) : (
                    <Pin className="size-3.5" />
                  )}
                </button>
                <MessageFooter
                  message={message}
                  showMetadata={isAssistantTurnEnd(messages, index, turnPending)}
                  pinned={pinnedMessageIds.has(message.id)}
                  onReply={() => onReply(message)}
                />
              </motion.div>
            ))}

            {permissions.map((request) => (
              <PermissionCard
                key={request.id}
                request={request}
                onReply={(reply) => onPermission(request, reply)}
              />
            ))}

            {questions.map((request) => (
              <QuestionCard
                key={request.id}
                request={request}
                onAnswer={(answers) => onQuestion(request, answers)}
              />
            ))}

            {activity ? (
              <motion.div
                key="activity"
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="flex items-center gap-2 self-start px-1 text-[11.5px] text-muted-foreground"
              >
                <span className="relative flex size-2 flex-none" style={{ color: accentColor }}>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-current" />
                </span>
                {runningTool ? <Wrench className="size-3 flex-none" /> : null}
                <span>{activity}</span>
                <span className="animate-pulse">…</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {messages.length === 0 && !blocked && !activity ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-[12px] text-muted-foreground">
              {messagesStatus === 'loading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading messages…</span>
                </>
              ) : messagesStatus === 'error' ? (
                <>
                  <CircleAlert className="size-4" />
                  <span>Couldn't reach this session — retrying…</span>
                </>
              ) : (
                <span>No messages yet — say hi.</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {!following ? (
          <motion.div
            key="jump"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
          >
            <Button
              size="xs"
              variant="secondary"
              className="pointer-events-auto rounded-full shadow-md"
              onClick={jumpToLatest}
            >
              <ArrowDown />
              Jump to latest
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
