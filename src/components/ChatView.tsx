import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Box, ChevronDown, MessageCircleQuestion, NotebookPen, Paperclip, Pin, RefreshCw, Reply, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelPrefill } from '../lib/newSessionDefaults';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import type { PromptInput } from '../api';
import { ModelPickerFallback } from './ModelPickerFallback';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  AvatarIdentity,
  BallState,
  BallMood,
  BlobStyle,
  ChatMessage,
  FileAttachment,
  Instance,
  MessagesStatus,
  MessageQueueSession,
  ModelOption,
  ModelRef,
  NewSessionOptions,
  Project,
  PermissionReply,
  PermissionRequest,
  QuestionAnswers,
  QuestionRequest,
  ReasoningDisplay,
  Session,
  SessionNote,
  StoredComposerDraft,
} from '../types';
import ThinkingIcon from './ThinkingIcon';
import ToolCallsIcon from './ToolCallsIcon';

const loadModelPicker = () => import('./ModelPicker');
const ModelPicker = React.lazy(loadModelPicker);
const Transcript = React.lazy(() => import('./Transcript'));
const SessionNotes = React.lazy(() => import('./SessionNotes'));
const ProjectPicker = React.lazy(() => import('./ProjectPicker'));
const QueuedMessageList = React.lazy(() => import('./QueuedMessageList'));
const PinnedMessagesDialog = React.lazy(() => import('./PinnedMessagesDialog'));

const REASONING_ORDER: ReasoningDisplay[] = ['expanded', 'collapsed', 'hidden'];
const nextReasoningDisplay = (mode: ReasoningDisplay): ReasoningDisplay =>
  REASONING_ORDER[(REASONING_ORDER.indexOf(mode) + 1) % REASONING_ORDER.length];
const REASONING_META: Record<ReasoningDisplay, { title: string }> = {
  expanded: { title: 'Thinking expanded — click to collapse' },
  collapsed: { title: 'Thinking collapsed — click to hide' },
  hidden: { title: 'Thinking hidden — click to expand' },
};

const TranscriptFallback = () => (
  <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-muted-foreground" role="status">
    Loading conversation…
  </div>
);

type Props = {
  session: Session | null;
  instance: Instance | null;
  instanceMarkerColor?: number;
  newSessionInstanceId: string | null;
  /** Prefill for a new-agent draft: last-used or default folder, model and YOLO on that instance. */
  newSessionPrefill: { directory: string | null; model: ModelPrefill | null; bypass: boolean } | null;
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
  seed: string;
  identity: AvatarIdentity;
  state: BallState;
  mood: BallMood;
  blobStyle: BlobStyle;
  messages: ChatMessage[];
  messagesStatus: MessagesStatus;
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  models: ModelOption[];
  defaultModelId: string | null;
  /** `provider/model` keys the instance used most recently, newest first. */
  recentModels: string[];
  sending: boolean;
  queue: MessageQueueSession | null;
  reloading: boolean;
  bypass: boolean;
  hideToolCalls: boolean;
  reasoningDisplay: ReasoningDisplay;
  pinnedMessageIds: Set<string>;
  sessionNotes: SessionNote[];
  savedComposerDrafts: Record<string, StoredComposerDraft>;
  composerDraftsHydrated: boolean;
  onComposerDraftsChange: (drafts: Record<string, StoredComposerDraft>) => void;
  onTogglePin: (message: ChatMessage) => void;
  onSaveNote: (sessionKey: string, text: string) => void;
  onDeleteNote: (sessionKey: string, noteId: string) => void;
  onHideToolCallsChange: (hide: boolean) => void;
  onReasoningDisplayChange: (mode: ReasoningDisplay) => void;
  onBypassChange: (enabled: boolean) => void;
  onNewSessionInstanceChange: (instanceId: string) => void;
  /** Draft submit: create the session, then send the first message into it. */
  onCreateAndSend: (options: NewSessionOptions, input: PromptInput) => Promise<boolean>;
  onCancelNewSession: () => void;
  onSend: (input: PromptInput) => Promise<boolean>;
  onQueue: (input: PromptInput) => Promise<boolean>;
  onSendQueued: (itemId: string) => Promise<boolean>;
  onQueuedModelChange: (itemId: string, model: ModelOption) => Promise<boolean>;
  onMoveQueued: (itemId: string, direction: -1 | 1) => Promise<boolean>;
  onRemoveQueued: (itemId: string) => Promise<boolean>;
  onReload: () => void;
  onAbort: () => void;
  onPermission: (request: PermissionRequest, reply: PermissionReply) => Promise<boolean>;
  onQuestion: (request: QuestionRequest, answers: QuestionAnswers | null) => Promise<boolean>;
};


const messageContextText = (message: ChatMessage): string =>
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

/** Attachments travel inline as data URLs, the same shape OpenChamber sends. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const STALE_AGENT_MS = 10 * 60_000;

const MAX_COMPOSER_DRAFTS = 50;

type ComposerState = {
  text: string;
  modelId: string;
  variant: string;
  attachments: FileAttachment[];
  replyContext: ChatMessage | null;
};

const saveComposerDraft = (
  drafts: Map<string, ComposerState>,
  key: string,
  state: ComposerState
) => {
  drafts.delete(key);
  drafts.set(key, state);
  while (drafts.size > MAX_COMPOSER_DRAFTS) {
    const oldest = drafts.keys().next().value;
    if (!oldest) break;
    drafts.delete(oldest);
  }
};

const composerFromStored = (draft: StoredComposerDraft): ComposerState => ({
  text: draft.text,
  modelId: draft.modelId ?? DEFAULT_MODEL,
  variant: draft.variant ?? '',
  attachments: [],
  replyContext: null,
});

const storedFromComposer = (state: ComposerState): StoredComposerDraft => {
  const draft: StoredComposerDraft = {
    text: state.text,
    modelId: state.modelId,
    updatedAt: Date.now(),
  };
  if (state.variant) draft.variant = state.variant;
  return draft;
};

export const shouldOfferSessionReload = (
  state: BallState,
  messagesStatus: MessagesStatus,
  sessionUpdated: number | undefined,
  messages: ChatMessage[],
  now: number
): boolean => {
  if (messagesStatus === 'error') return true;
  if (state !== 'active') return false;
  const assistantUpdates = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.completedAt ?? message.createdAt ?? 0);
  const lastUpdate = assistantUpdates.length ? Math.max(...assistantUpdates) : sessionUpdated ?? 0;
  return lastUpdate > 0 && now - lastUpdate >= STALE_AGENT_MS;
};

const readAttachment = (file: File): Promise<FileAttachment> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      resolve({
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        url: String(reader.result),
      });
    reader.readAsDataURL(file);
  });

export default function ChatView({
  session,
  instance,
  instanceMarkerColor,
  newSessionInstanceId,
  newSessionPrefill,
  instances,
  projectsByInstance,
  seed,
  identity,
  state,
  mood,
  blobStyle,
  messages,
  messagesStatus,
  permissions,
  questions,
  models,
  defaultModelId,
  recentModels,
  sending,
  queue,
  reloading,
  bypass,
  hideToolCalls,
  reasoningDisplay,
  pinnedMessageIds,
  sessionNotes,
  savedComposerDrafts,
  composerDraftsHydrated,
  onComposerDraftsChange,
  onTogglePin,
  onSaveNote,
  onDeleteNote,
  onHideToolCallsChange,
  onReasoningDisplayChange,
  onBypassChange,
  onNewSessionInstanceChange,
  onCreateAndSend,
  onCancelNewSession,
  onSend,
  onQueue,
  onSendQueued,
  onQueuedModelChange,
  onMoveQueued,
  onRemoveQueued,
  onReload,
  onAbort,
  onPermission,
  onQuestion,
}: Props) {
  const [text, setText] = React.useState('');
  const [modelId, setModelId] = React.useState(DEFAULT_MODEL);
  const [variant, setVariant] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerActivated, setPickerActivated] = React.useState(false);
  const [attachments, setAttachments] = React.useState<FileAttachment[]>([]);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const [replyContext, setReplyContext] = React.useState<ChatMessage | null>(null);
  const [pinnedOpen, setPinnedOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(true);
  const [queueOpen, setQueueOpen] = React.useState(true);
  const [focusMessageId, setFocusMessageId] = React.useState<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());
  const fileRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const createdModelRef = React.useRef<{ key: string; variant?: string } | null>(null);
  const composerDraftsRef = React.useRef(new Map<string, ComposerState>());
  const touchedComposerChoicesRef = React.useRef(new Set<string>());
  const previousComposerKeyRef = React.useRef<string | null>(null);
  const draftsHydratedRef = React.useRef(false);
  const draftPersistTimerRef = React.useRef<number | undefined>(undefined);
  const onComposerDraftsChangeRef = React.useRef(onComposerDraftsChange);
  onComposerDraftsChangeRef.current = onComposerDraftsChange;
  // A draft is the new-agent state: no session yet, composer live, options row above it.
  const draftInstanceId = session ? null : newSessionInstanceId;
  const draftInstance = draftInstanceId ? instances.find((candidate) => candidate.id === draftInstanceId) ?? null : null;
  const composerKey = session
    ? `${session.instanceId}::${session.id}`
    : draftInstanceId
      ? `new::${draftInstanceId}`
      : null;
  const [draftDirectory, setDraftDirectory] = React.useState('');
  const [draftBypass, setDraftBypass] = React.useState(false);
  const draftTouchedRef = React.useRef<{ directory: boolean; bypass: boolean }>({ directory: false, bypass: false });

  // Re-seed the draft options whenever the target instance changes, and follow the prefill
  // (sessions/projects can load after the draft opens) until the user edits a field.
  React.useEffect(() => {
    draftTouchedRef.current = { directory: false, bypass: false };
  }, [draftInstanceId]);
  React.useEffect(() => {
    if (!draftInstanceId) return;
    if (!draftTouchedRef.current.directory) setDraftDirectory(newSessionPrefill?.directory ?? '');
    if (!draftTouchedRef.current.bypass) setDraftBypass(newSessionPrefill?.bypass ?? false);
  }, [draftInstanceId, newSessionPrefill]);

  React.useEffect(() => {
    if (!composerDraftsHydrated || draftsHydratedRef.current) return;
    draftsHydratedRef.current = true;
    Object.entries(savedComposerDrafts).forEach(([key, draft]) => {
      if (draft.modelId !== undefined || draft.variant) {
        touchedComposerChoicesRef.current.add(key);
      }
      if (!composerDraftsRef.current.has(key)) {
        composerDraftsRef.current.set(key, composerFromStored(draft));
      }
    });
    const restored = composerKey ? composerDraftsRef.current.get(composerKey) : undefined;
    // Only fill an untouched composer; the current values are read once, on hydration.
    if (restored && !text && attachments.length === 0 && !replyContext) {
      setText(restored.text);
      setModelId(restored.modelId);
      setVariant(restored.variant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydration, guarded by draftsHydratedRef
  }, [composerDraftsHydrated, savedComposerDrafts]);

  const snapshotComposerDrafts = () =>
    Object.fromEntries(
      [...composerDraftsRef.current.entries()].map(([key, draft]) => [key, storedFromComposer(draft)])
    );

  const scheduleDraftPersistence = () => {
    if (!draftsHydratedRef.current) return;
    if (draftPersistTimerRef.current !== undefined) window.clearTimeout(draftPersistTimerRef.current);
    draftPersistTimerRef.current = window.setTimeout(() => {
      draftPersistTimerRef.current = undefined;
      onComposerDraftsChangeRef.current(snapshotComposerDrafts());
    }, 600);
  };

  React.useEffect(() => () => {
    if (draftPersistTimerRef.current === undefined) return;
    window.clearTimeout(draftPersistTimerRef.current);
    onComposerDraftsChangeRef.current(snapshotComposerDrafts());
  }, []);

  const updateComposerDraft = (key: string, draft: ComposerState | null) => {
    if (draft) saveComposerDraft(composerDraftsRef.current, key, draft);
    else {
      composerDraftsRef.current.delete(key);
      touchedComposerChoicesRef.current.delete(key);
    }
    scheduleDraftPersistence();
  };

  const updateComposerChoices = (patch: Partial<Pick<ComposerState, 'modelId' | 'variant'>>) => {
    if (!composerKey) return;
    touchedComposerChoicesRef.current.add(composerKey);
    updateComposerDraft(composerKey, {
      text,
      modelId,
      variant,
      attachments,
      replyContext,
      ...patch,
    });
  };

  const last = messages[messages.length - 1];
  const busy = sending || state === 'active' || (last?.role === 'assistant' && !last.completed);
  const pinnedMessages = React.useMemo(
    () => messages.filter((message) => pinnedMessageIds.has(message.id)),
    [messages, pinnedMessageIds]
  );
  const offerReload = Boolean(
    session && !sending && shouldOfferSessionReload(state, messagesStatus, session.updated, messages, now)
  );

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files].filter((file) => file.size <= MAX_ATTACHMENT_BYTES);
    const skippedForSize = files.length - accepted.length;
    // One unreadable file (permissions, removed drive) must not drop the whole batch.
    const results = await Promise.allSettled(accepted.map(readAttachment));
    const read = results
      .filter((result): result is PromiseFulfilledResult<FileAttachment> => result.status === 'fulfilled')
      .map((result) => result.value);
    const unreadable = results.length - read.length;
    const problems = [
      skippedForSize > 0 ? `${skippedForSize} over 10 MB` : null,
      unreadable > 0 ? `${unreadable} could not be read` : null,
    ].filter((entry): entry is string => entry !== null);
    setAttachmentError(problems.length > 0 ? `Skipped ${problems.join(', ')}.` : null);
    if (read.length > 0) setAttachments((prev) => [...prev, ...read]);
  };

  React.useEffect(() => {
    if (!composerKey) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [composerKey]);

  // Runs exactly when the open session changes: stash the outgoing composer under the previous
  // key and load the incoming one. It must read the *current* text/attachments/etc. without
  // re-running when they change, so those are intentionally not dependencies.
  React.useLayoutEffect(() => {
    const previousKey = previousComposerKeyRef.current;
    if (previousKey && previousKey !== composerKey) {
      if (
        text.trim() ||
        attachments.length ||
        replyContext ||
        touchedComposerChoicesRef.current.has(previousKey)
      ) {
        updateComposerDraft(previousKey, {
          text,
          modelId,
          variant,
          attachments,
          replyContext,
        });
      } else {
        updateComposerDraft(previousKey, null);
      }
    }
    previousComposerKeyRef.current = composerKey;

    const saved = composerKey ? composerDraftsRef.current.get(composerKey) : undefined;
    const created = createdModelRef.current;
    const sessionModelKey = session?.model ? modelRefKey(session.model) : undefined;
    const prefill = draftInstanceId ? newSessionPrefill?.model ?? undefined : undefined;
    const next: ComposerState = saved ?? {
      text: '',
      modelId: created?.key ?? sessionModelKey ?? prefill?.key ?? defaultModelId ?? DEFAULT_MODEL,
      variant: created?.variant ?? session?.model?.variant ?? prefill?.variant ?? '',
      attachments: [],
      replyContext: null,
    };

    setText(next.text);
    setModelId(next.modelId);
    setVariant(next.variant);
    setAttachments(next.attachments);
    setAttachmentError(null);
    setReplyContext(next.replyContext);
    createdModelRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above the effect
  }, [composerKey]);

  React.useEffect(() => {
    setFocusMessageId(null);
    if (!composerKey) return;
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [composerKey]);

  const model = models.find((entry) => modelRefKey(entry) === modelId);
  const defaultModel = defaultModelId ? models.find((entry) => modelRefKey(entry) === defaultModelId) : undefined;
  const variantModel = model ?? (modelId === DEFAULT_MODEL ? defaultModel : undefined);
  const modelButtonLabel = model
    ? `${model.details.providerName} / ${model.details.name}${modelId === defaultModelId ? ' (Default)' : ''}`
    : defaultModel
      ? `${defaultModel.details.providerName} / ${defaultModel.details.name} (Default)`
      : 'Server default';
  const variantOptions = variantModel?.details.variants ?? [];
  const lastMessage = messages[messages.length - 1];
  const activeModelRef: ModelRef | undefined =
    (lastMessage?.role === 'user' ? lastMessage.model : undefined) ??
    session?.model ??
    lastMessage?.model ??
    model ??
    defaultModel;
  const activeModelOption = activeModelRef
    ? models.find(
        (entry) =>
          entry.providerID === activeModelRef.providerID &&
          entry.modelID === activeModelRef.modelID
      )
    : undefined;
  const activeModelLabel = activeModelOption?.details.name ?? activeModelRef?.modelID;
  const draftProjects = draftInstanceId ? projectsByInstance[draftInstanceId] ?? [] : [];
  const draftReady = Boolean(draftInstanceId && draftDirectory.trim());
  const effectiveBypass = draftInstanceId ? draftBypass : bypass;

  const canSend = (session ? true : draftReady) && (text.trim().length > 0 || attachments.length > 0);
  const queueItems = queue?.items ?? [];
  const shouldQueue = Boolean(session && (busy || queueItems.length > 0));
  const reasoningMeta = REASONING_META[reasoningDisplay];
  // Up-arrow history: recall the most recent thing the user sent, like a shell.
  const lastSentMessage = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'user' && message.text.trim()) return message.text.trim();
    }
    return null;
  }, [messages]);

  const submit = (options?: { forceSend?: boolean }) => {
    if (!canSend) return;
    const submitted: ComposerState = { text: text.trim(), modelId, variant, attachments, replyContext };
    const submittedKey = composerKey;
    const input: PromptInput = {
      text: submitted.text,
      model,
      mode: session?.agent,
      variant: submitted.variant || undefined,
      attachments: submitted.attachments,
      replyContext: submitted.replyContext ? messageContextText(submitted.replyContext) : undefined,
    };
    let result: Promise<boolean>;
    if (draftInstanceId) {
      // The new session's composer should open with the model chosen in the draft.
      createdModelRef.current = { key: modelId, variant: submitted.variant || undefined };
      if (submittedKey) touchedComposerChoicesRef.current.delete(submittedKey);
      result = onCreateAndSend(
        {
          instanceId: draftInstanceId,
          directory: draftDirectory.trim(),
          model: model ? { providerID: model.providerID, modelID: model.modelID } : undefined,
          variant: submitted.variant || undefined,
          bypass: draftBypass,
        },
        input
      );
    } else {
      result = (shouldQueue && !options?.forceSend ? onQueue : onSend)(input);
    }
    result.then((sent) => {
      if (sent) return;
      if (submittedKey && previousComposerKeyRef.current !== submittedKey) {
        updateComposerDraft(submittedKey, submitted);
        return;
      }
      if (submittedKey && composerDraftsRef.current.has(submittedKey)) {
        const currentDraft = composerDraftsRef.current.get(submittedKey);
        if (currentDraft) {
          updateComposerDraft(submittedKey, {
            ...currentDraft,
            attachments: currentDraft.attachments.length ? currentDraft.attachments : submitted.attachments,
            replyContext: currentDraft.replyContext ?? submitted.replyContext,
          });
        }
        return;
      }
      setText(submitted.text);
      setModelId(submitted.modelId);
      setVariant(submitted.variant);
      setAttachments(submitted.attachments);
      setReplyContext(submitted.replyContext);
    });
    if (composerKey) updateComposerDraft(composerKey, null);
    setText('');
    setAttachments([]);
    setAttachmentError(null);
    setReplyContext(null);
  };

  // "Save as note" parks the composer text; a note can send as-is, come back to the composer, or go.
  const saveNote = () => {
    if (!composerKey || !session) return;
    const parked = text.trim();
    if (!parked) return;
    onSaveNote(composerKey, parked);
    updateComposerDraft(composerKey, null);
    setText('');
    setAttachmentError(null);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const bringBackNote = (note: SessionNote) => {
    if (!composerKey) return;
    const next = text.trim() ? `${text.trimEnd()}\n\n${note.text}` : note.text;
    setText(next);
    updateComposerDraft(composerKey, { text: next, modelId, variant, attachments, replyContext });
    onDeleteNote(composerKey, note.id);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const sendNote = async (note: SessionNote): Promise<boolean> => {
    if (!composerKey || !session) return false;
    const input: PromptInput = { text: note.text, model, variant: variant || undefined };
    const sent = await (shouldQueue ? onQueue : onSend)(input);
    if (sent) onDeleteNote(composerKey, note.id);
    return sent;
  };

  // Move a queued message out of the server queue and into this session's notes.
  const parkQueuedItem = async (itemId: string): Promise<boolean> => {
    if (!composerKey) return false;
    const item = queueItems.find((entry) => entry.id === itemId);
    const text = item ? item.text.trim() || item.content.trim() : '';
    if (!text) return false;
    const removed = await onRemoveQueued(itemId);
    if (!removed) return false;
    onSaveNote(composerKey, text);
    return true;
  };

  // Pull a queued message out of the server queue and into the composer to edit and re-send.
  const editQueuedItem = async (itemId: string): Promise<boolean> => {
    if (!composerKey) return false;
    const item = queueItems.find((entry) => entry.id === itemId);
    const queuedText = item ? item.text.trim() || item.content.trim() : '';
    if (!queuedText) return false;
    const removed = await onRemoveQueued(itemId);
    if (!removed) return false;
    const next = text.trim() ? `${text.trimEnd()}\n\n${queuedText}` : queuedText;
    setText(next);
    updateComposerDraft(composerKey, { text: next, modelId, variant, attachments, replyContext });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
    return true;
  };

  const replyToMessage = (message: ChatMessage) => {
    setReplyContext(message);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const jumpToMessage = (messageId: string) => {
    setFocusMessageId(messageId);
    setFocusRequest((request) => request + 1);
  };

  return (
    <main className="relative flex min-w-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="popLayout" initial={false}>
        {session ? (
          <motion.div
            key={`${session.instanceId}:${session.id}`}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <header className="flex h-11 flex-none items-center gap-2.5 border-b px-3 sm:px-4">
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-medium"
                style={instanceMarkerColor === undefined ? undefined : {
                  textDecoration: 'underline',
                  textDecorationColor: `var(--instance-marker-${instanceMarkerColor})`,
                  textDecorationThickness: '2px',
                  textUnderlineOffset: '3px',
                }}
              >
                {session.title ?? session.id}
              </span>
              {offerReload || reloading ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={reloading}
                  onClick={onReload}
                  title="Reload this session from its instance"
                >
                  <RefreshCw className={cn(reloading && 'animate-spin')} />
                  <span className="hidden sm:inline">{reloading ? 'Reloading…' : 'Refresh'}</span>
                </Button>
              ) : null}
              {permissions.length ? (
                <Badge variant="secondary" className="border-warning/40 bg-warning/10 font-normal text-warning">
                  <ShieldAlert />
                  {permissions.length === 1 ? 'Approval needed' : `${permissions.length} approvals`}
                </Badge>
              ) : null}
              {questions.length ? (
                <Badge variant="secondary" className="border-highlight/40 bg-highlight/10 font-normal text-highlight">
                  <MessageCircleQuestion />
                  {questions.length === 1 ? 'Question needed' : `${questions.length} questions`}
                </Badge>
              ) : null}
              {pinnedMessages.length ? (
                <Button variant="secondary" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setPinnedOpen(true)}>
                  <Pin />
                  {pinnedMessages.length} {pinnedMessages.length === 1 ? 'pin' : 'pins'}
                </Button>
              ) : null}
              {instance ? (
                <Badge variant="secondary" className="hidden font-normal text-muted-foreground sm:inline-flex">
                  <Box aria-hidden="true" />
                  {instance.label}
                </Badge>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReasoningDisplayChange(nextReasoningDisplay(reasoningDisplay))}
                aria-label={`Thinking display: ${reasoningDisplay}`}
                title={reasoningMeta.title}
                className="h-7 px-2 text-xs"
              >
                <ThinkingIcon mode={reasoningDisplay} className="size-3.5" />
              </Button>
              <Toggle
                pressed={hideToolCalls}
                onPressedChange={onHideToolCallsChange}
                variant="outline"
                size="sm"
                aria-label="Hide tool calls"
                title={hideToolCalls ? 'Tool calls hidden — click to show' : 'Hide tool calls'}
                className="h-7 px-2 text-xs data-[state=on]:bg-muted data-[state=on]:text-foreground"
              >
                <ToolCallsIcon hidden={hideToolCalls} casing="var(--muted)" className="size-3.5" />
              </Toggle>
            </header>

            <React.Suspense fallback={<TranscriptFallback />}>
              <Transcript
                messages={messages}
                messagesStatus={messagesStatus}
                permissions={permissions}
                questions={questions}
                state={state}
                sending={sending}
                activeModelLabel={activeModelLabel}
                blobStyle={blobStyle}
                seed={seed}
                identity={identity}
                mood={mood}
                hideToolCalls={hideToolCalls}
                reasoningDisplay={reasoningDisplay}
                pinnedMessageIds={pinnedMessageIds}
                focusMessageId={focusMessageId}
                focusRequest={focusRequest}
                onTogglePin={onTogglePin}
                onReply={replyToMessage}
                onPermission={onPermission}
                onQuestion={onQuestion}
              />
            </React.Suspense>
          </motion.div>
        ) : (
          <motion.div
            key={newSessionInstanceId ? `new-${newSessionInstanceId}` : 'empty'}
            className="flex flex-1 flex-col items-center justify-start gap-3 overflow-y-auto py-4 text-muted-foreground sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {draftInstance ? (
              <>
                <Blob style={blobStyle} seed={`new:${draftInstance.id}`} size={48} interactive />
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[13px] font-medium text-foreground">New agent on {draftInstance.label}</span>
                  <span className="max-w-[420px] truncate text-xs">
                    {draftDirectory.trim() || 'Pick a folder below to get started.'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex -space-x-3">
                  <Blob style={blobStyle} seed="empty one" size={48} interactive />
                  <Blob style={blobStyle} seed="empty two" size={48} interactive />
                  <Blob style={blobStyle} seed="empty three" size={48} interactive />
                </div>
                <span className="text-[13px]">Pick a session, or start a new agent.</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {composerKey ? (
        <div className="safe-composer flex-none border-t bg-card p-2.5 sm:p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {draftInstance ? (
              <div className="flex items-center gap-1.5 px-0.5" aria-label="New agent options">
                <Select value={draftInstance.id} onValueChange={onNewSessionInstanceChange}>
                  <SelectTrigger
                    size="sm"
                    aria-label="New agent instance"
                    className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.filter((candidate) => candidate.attachable).map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <React.Suspense fallback={null}>
                  <ProjectPicker
                    projects={draftProjects}
                    value={draftDirectory}
                    onSelect={(directory) => {
                      draftTouchedRef.current.directory = true;
                      setDraftDirectory(directory);
                      if (!directory) window.requestAnimationFrame(() => folderRef.current?.focus());
                    }}
                  />
                </React.Suspense>
                <Input
                  ref={folderRef}
                  value={draftDirectory}
                  onChange={(event) => {
                    draftTouchedRef.current.directory = true;
                    setDraftDirectory(event.target.value);
                  }}
                  placeholder="Folder path"
                  aria-label="New agent folder"
                  className="h-7 min-w-0 flex-1 border-dashed bg-transparent px-2 font-mono text-[11.5px] shadow-none hover:bg-muted focus-visible:border-solid focus-visible:bg-background dark:bg-transparent"
                />
                <Button variant="ghost" size="icon-sm" className="size-7" onClick={onCancelNewSession} aria-label="Cancel new agent">
                  <X />
                </Button>
              </div>
            ) : null}
            {session ? (
            <React.Suspense fallback={null}>
              <SessionNotes
                key={`notes-${composerKey ?? 'none'}`}
                open={notesOpen}
                notes={sessionNotes}
                onOpenChange={setNotesOpen}
                onSend={sendNote}
                onBringBack={bringBackNote}
                onDelete={(note) => {
                  if (composerKey) onDeleteNote(composerKey, note.id);
                }}
              />
            </React.Suspense>
            ) : null}
            {session ? (
            <React.Suspense fallback={null}>
              <QueuedMessageList
                key={composerKey ?? 'none'}
                open={queueOpen}
                queue={queue}
                models={models}
                recentModels={recentModels}
                defaultModelId={defaultModelId}
                onOpenChange={setQueueOpen}
                onSendQueued={onSendQueued}
                onQueuedModelChange={onQueuedModelChange}
                onMoveQueued={onMoveQueued}
                onRemoveQueued={onRemoveQueued}
                onParkQueued={parkQueuedItem}
                onEditQueued={editQueuedItem}
              />
            </React.Suspense>
            ) : null}
            <motion.div
              layout
            className="flex flex-col rounded-xl border bg-background transition-[box-shadow,border-color] duration-200 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
          >
            {replyContext ? (
              <div className="mx-2 mt-2 flex items-start gap-2 rounded-lg border bg-muted/50 px-2.5 py-2 text-[11.5px]">
                <Reply className="mt-0.5 size-3.5 flex-none text-highlight" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">Replying with pinned context</span>
                  <span className="truncate text-muted-foreground">
                    {messageContextText(replyContext).replace(/\s+/g, ' ').slice(0, 180)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyContext(null)}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Remove reply context"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <AutoResizeTextarea
              ref={textareaRef}
              value={text}
              maxHeight={160}
              placeholder={shouldQueue ? 'Queue a follow-up…' : 'Message the agent…'}
              aria-label={shouldQueue ? 'Queue a follow-up message' : 'Message the agent'}
              onChange={(event) => {
                setText(event.target.value);
                if (composerKey) {
                  if (
                    event.target.value.trim() ||
                    attachments.length ||
                    replyContext ||
                    touchedComposerChoicesRef.current.has(composerKey)
                  ) {
                    updateComposerDraft(composerKey, {
                      text: event.target.value,
                      modelId,
                      variant,
                      attachments,
                      replyContext,
                    });
                  } else {
                    updateComposerDraft(composerKey, null);
                  }
                }
              }}
              onKeyDown={(event) => {
                // Cmd/Ctrl+Enter parks the draft as a note; plain Enter sends.
                if (
                  event.key === 'Enter' &&
                  (event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  saveNote();
                  return;
                }
                if (
                  event.key === 'ArrowUp' &&
                  !event.shiftKey &&
                  !event.altKey &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.nativeEvent.isComposing &&
                  !text.trim() &&
                  lastSentMessage
                ) {
                  event.preventDefault();
                  const recalled = lastSentMessage;
                  setText(recalled);
                  if (composerKey) {
                    updateComposerDraft(composerKey, {
                      text: recalled,
                      modelId,
                      variant,
                      attachments,
                      replyContext,
                    });
                  }
                  window.requestAnimationFrame(() => {
                    const el = textareaRef.current;
                    if (el) el.setSelectionRange(recalled.length, recalled.length);
                  });
                  return;
                }
                // Shift+Enter skips the queue and sends now. Only while there's a queue to skip —
                // otherwise it inserts a newline as usual.
                if (
                  event.key === 'Enter' &&
                  event.shiftKey &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  shouldQueue &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit({ forceSend: true });
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              className="min-h-9 w-full bg-transparent px-3 pt-2 pb-1 text-base placeholder:text-muted-foreground focus-visible:border-input focus-visible:ring-0 disabled:cursor-not-allowed sm:px-3.5 sm:text-[13px]"
            />

            <div className="flex items-center gap-1 overflow-x-auto px-2 pb-2 sm:gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onMouseEnter={() => void loadModelPicker()}
                onFocus={() => void loadModelPicker()}
                onClick={() => {
                  setPickerActivated(true);
                  setPickerOpen(true);
                }}
                aria-label="Choose model"
                className="h-7 max-w-[132px] flex-none px-2 text-xs font-normal sm:max-w-[280px]"
              >
                <span className="truncate">{modelButtonLabel}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
              {pickerActivated ? (
                <React.Suspense fallback={<ModelPickerFallback />}>
                  <ModelPicker
                    open={pickerOpen}
                    models={models}
                    recentModels={recentModels}
                    value={modelId}
                    defaultModelId={defaultModelId}
                    collapseProviders
                    onSelect={(next) => {
                      const nextModel = models.find((entry) => modelRefKey(entry) === next);
                      const nextVariants =
                        nextModel?.details.variants ??
                        (next === DEFAULT_MODEL ? defaultModel?.details.variants ?? [] : []);
                      const nextVariant = variant && nextVariants.includes(variant) ? variant : '';
                      setModelId(next);
                      setVariant(nextVariant);
                      updateComposerChoices({ modelId: next, variant: nextVariant });
                    }}
                    onOpenChange={setPickerOpen}
                  />
                </React.Suspense>
              ) : null}

              {variantOptions.length ? (
                <Select
                  value={variant || '__default'}
                  onValueChange={(value) => {
                    const nextVariant = value === '__default' ? '' : value;
                    setVariant(nextVariant);
                    updateComposerChoices({ variant: nextVariant });
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label="Reasoning level"
                    className="h-7 border-none bg-transparent px-2 text-xs capitalize shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted"
                  >
                    <SelectValue placeholder="Reasoning" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Reasoning: default</SelectItem>
                    {variantOptions.map((option) => (
                      <SelectItem key={option} value={option} className="capitalize">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Toggle
                pressed={effectiveBypass}
                onPressedChange={(enabled) => {
                  if (draftInstanceId) {
                    draftTouchedRef.current.bypass = true;
                    setDraftBypass(enabled);
                  } else {
                    onBypassChange(enabled);
                  }
                }}
                variant="outline"
                size="sm"
                aria-label={effectiveBypass ? 'YOLO mode on: permission prompts are accepted automatically' : 'YOLO mode off'}
                title={
                  effectiveBypass
                    ? 'YOLO mode: permission prompts for this session are accepted automatically, even while Ember is closed'
                    : 'YOLO mode: accept permission prompts for this session automatically'
                }
                className="h-7 px-2 text-xs data-[state=on]:border-warning/60 data-[state=on]:bg-warning/10 data-[state=on]:text-warning"
              >
                <ShieldCheck className="size-3.5" />
                <span className="hidden sm:inline">YOLO</span>
              </Toggle>

              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7"
                aria-label="Attach a file"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </Button>

              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                <AnimatePresence>
                  {attachments.map((file, index) => (
                    <motion.span
                      key={`${file.filename}-${index}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      className="flex max-w-[160px] flex-none items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {file.mime.startsWith('image/') ? (
                        <img src={file.url} alt="" className="size-4 rounded-sm object-cover" />
                      ) : null}
                      <span className="truncate">{file.filename}</span>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:text-foreground"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.filename}`}
                      >
                        <X className="size-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                {attachmentError ? (
                  <span className="flex-none text-[11px] text-destructive">{attachmentError}</span>
                ) : null}
              </div>

              <AnimatePresence>
                {busy && session ? (
                  <motion.div
                    key="stop"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.12 }}
                  >
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      className="size-7 rounded-full"
                      onClick={onAbort}
                      aria-label="Stop generating"
                    >
                      <Square className="size-3 fill-current" />
                    </Button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {session ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 rounded-full text-muted-foreground"
                  disabled={!text.trim()}
                  onClick={saveNote}
                  aria-label="Save as note"
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                  title="Save as note (⌘/Ctrl+Enter)"
                >
                  <NotebookPen className="size-3.5" />
                </Button>
              ) : null}

              <Button
                size="icon-sm"
                className="size-7 rounded-full"
                disabled={!canSend}
                onClick={() => submit()}
                aria-label={shouldQueue ? 'Queue message' : 'Send'}
                title={shouldQueue ? 'Queue message — Shift+Enter sends now' : 'Send'}
              >
                <ArrowUp className={cn(sending && 'animate-pulse')} />
              </Button>
            </div>
            </motion.div>
          </div>
        </div>
      ) : null}
      </div>

      <React.Suspense fallback={null}>
        <PinnedMessagesDialog
          open={pinnedOpen}
          onOpenChange={setPinnedOpen}
          messages={pinnedMessages}
          onJump={(messageId) => {
            setPinnedOpen(false);
            jumpToMessage(messageId);
          }}
          onReply={(message) => {
            setPinnedOpen(false);
            replyToMessage(message);
          }}
          onUnpin={onTogglePin}
        />
      </React.Suspense>
    </main>
  );
}
