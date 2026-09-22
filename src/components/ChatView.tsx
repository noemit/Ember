import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Box, ChevronDown, GitFork, Loader2, MessageCircleQuestion, Minimize2, NotebookPen, Paperclip, Pin, Play, RefreshCw, Reply, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelPrefill } from '../lib/newSessionDefaults';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import type { PromptInput } from '../api';
import { ModelPickerFallback } from './ModelPickerFallback';
import { cn } from '@/lib/utils';
import { clearComposerText, composerMemory, removedDrafts, type ComposerState, type DraftChanges } from '@/lib/composerDrafts';
import { resolveComposerModel } from '@/lib/modelSelection';
import { shortcutLabel } from '@/lib/shortcuts';
import { useStableProps } from '@/lib/useStableProps';
import { useStableCallback } from '@/lib/useStableCallback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import ContextMeter from './ContextMeter';
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
  /** Resolves the blob a new-agent draft will get from its target folder (project colour + override). */
  resolveDraftIdentity: (instanceId: string, directory: string) => AvatarIdentity;
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
  /** Re-read this instance's model catalogue; called when the picker opens so new models appear without a relaunch. */
  onModelsRefresh?: () => void;
  sending: boolean;
  queue: MessageQueueSession | null;
  reloading: boolean;
  bypass: boolean;
  hideToolCalls: boolean;
  reasoningDisplay: ReasoningDisplay;
  pinnedMessageIds: Set<string>;
  sessionNotes: SessionNote[];
  /** Settings key the notes are stored under; project sessions share one across the project. */
  notesKey: string;
  savedComposerDrafts: Record<string, StoredComposerDraft>;
  composerDraftsHydrated: boolean;
  onComposerDraftsChange: (drafts: DraftChanges) => void;
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
  onQueuedModelChange: (itemId: string, model: ModelOption, variant?: string) => Promise<boolean>;
  onMoveQueued: (itemId: string, direction: -1 | 1) => Promise<boolean>;
  onRemoveQueued: (itemId: string) => Promise<boolean>;
  onRetryQueued: (itemId: string) => Promise<boolean>;
  onDiscardQueued: (itemId: string) => boolean;
  onReload: () => void;
  onAbort: () => void;
  onPermission: (request: PermissionRequest, reply: PermissionReply) => Promise<boolean>;
  onQuestion: (request: QuestionRequest, answers: QuestionAnswers | null) => Promise<boolean>;
  /** True while this session's context is being compacted. */
  compacting: boolean;
  onCompact: () => void;
  /** True while this session is being forked into a handoff session. */
  handoffing: boolean;
  onHandoff: () => void;
  /** Column chrome: collapse this column into the tab strip. */
  onMinimize?: () => void;
  /** Column chrome: archive this session (Undo is offered by the app-level notice). */
  onArchive?: () => void;
  /** Persist a new session title on its instance (double-click on the header title). */
  onRename?: (title: string) => void;
  /** Called when the user interacts with this column, so the active session follows focus. */
  onActivate?: () => void;
  /** The column the user is working in; inactive columns trim their composer chrome. Defaults true. */
  active?: boolean;
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

function ChatView({
  session,
  instance,
  instanceMarkerColor,
  newSessionInstanceId,
  newSessionPrefill,
  instances,
  projectsByInstance,
  seed,
  identity,
  resolveDraftIdentity,
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
  onModelsRefresh,
  sending,
  queue,
  reloading,
  bypass,
  hideToolCalls,
  reasoningDisplay,
  pinnedMessageIds,
  sessionNotes,
  notesKey,
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
  onRetryQueued,
  onDiscardQueued,
  onReload,
  onAbort,
  onPermission,
  onQuestion,
  compacting,
  onCompact,
  handoffing,
  onHandoff,
  onMinimize,
  onActivate,
  onArchive,
  onRename,
  active = true,
}: Props) {
  const [text, setText] = React.useState('');
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [modelId, setModelId] = React.useState(DEFAULT_MODEL);
  const [variant, setVariant] = React.useState('');
  const [loadedComposerKey, setLoadedComposerKey] = React.useState<string | null>(null);
  // Latest composer text, for async edit/park handlers that must detect concurrent typing.
  const textRef = React.useRef('');
  textRef.current = text;
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
  const [findRequest, setFindRequest] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());
  const fileRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const createdModelRef = React.useRef<{ key: string; variant?: string } | null>(null);
  const composerDraftsRef = React.useRef(composerMemory);
  const pendingDraftChangesRef = React.useRef<DraftChanges>({});
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
  // The draft's blob follows the folder picker, so it previews the destination project's blob.
  const draftIdentity = React.useMemo(
    () => (draftInstance ? resolveDraftIdentity(draftInstance.id, draftDirectory) : undefined),
    [draftInstance, draftDirectory, resolveDraftIdentity]
  );
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
      if (!composerDraftsRef.current.has(key) && !removedDrafts.has(key)) {
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

  const snapshotComposerDrafts = () => {
    const changes = pendingDraftChangesRef.current;
    pendingDraftChangesRef.current = {};
    return changes;
  };

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
    if (draft) {
      removedDrafts.delete(key);
      saveComposerDraft(composerDraftsRef.current, key, draft);
    } else {
      removedDrafts.add(key);
      composerDraftsRef.current.delete(key);
      touchedComposerChoicesRef.current.delete(key);
    }
    pendingDraftChangesRef.current[key] = draft ? storedFromComposer(draft) : null;
    scheduleDraftPersistence();
  };

  React.useEffect(() => {
    if (!composerKey || loadedComposerKey !== composerKey || (!text && !attachments.length && !replyContext)) return;
    saveComposerDraft(composerMemory, composerKey, { text, modelId, variant, attachments, replyContext });
  }, [composerKey, loadedComposerKey, text, modelId, variant, attachments, replyContext]);

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
    let remaining = 18 * 1024 * 1024 - attachments.reduce((sum, file) => sum + Math.ceil(file.url.length * 0.75), 0);
    const accepted = [...files].filter((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES || file.size > remaining) return false;
      remaining -= file.size;
      return true;
    });
    const skippedForSize = files.length - accepted.length;
    // One unreadable file (permissions, removed drive) must not drop the whole batch.
    const results = await Promise.allSettled(accepted.map(readAttachment));
    const read = results
      .filter((result): result is PromiseFulfilledResult<FileAttachment> => result.status === 'fulfilled')
      .map((result) => result.value);
    const unreadable = results.length - read.length;
    const problems = [
      skippedForSize > 0 ? `${skippedForSize} exceeding the 10 MB file / 18 MB total limit` : null,
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
    setLoadedComposerKey(composerKey);

    const stored = composerKey && !removedDrafts.has(composerKey) ? savedComposerDrafts[composerKey] : undefined;
    const saved = composerKey ? composerDraftsRef.current.get(composerKey) ?? (stored ? composerFromStored(stored) : undefined) : undefined;
    if (saved && composerKey) {
      saveComposerDraft(composerDraftsRef.current, composerKey, saved);
      touchedComposerChoicesRef.current.add(composerKey);
    }
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

  const commitRename = (value: string) => {
    setEditingTitle(false);
    const next = value.trim();
    if (next && session && next !== session.title) onRename?.(next);
  };

  const { model, error: modelError } = resolveComposerModel(modelId, variant, models, defaultModelId);
  const defaultModel = defaultModelId ? models.find((entry) => modelRefKey(entry) === defaultModelId) : undefined;
  const modelButtonLabel = modelId === DEFAULT_MODEL
    ? `Server default${defaultModel ? ` · ${defaultModel.details.name}` : ''}`
    : model ? `${model.details.providerName} / ${model.details.name}` : `${modelId} (unavailable)`;
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

  const canSend = loadedComposerKey === composerKey && !modelError && (session ? true : draftReady) && (text.trim().length > 0 || attachments.length > 0);
  const queueItems = queue?.items ?? [];
  const shouldQueue = Boolean(session && (busy || queueItems.length > 0));
  const reasoningMeta = REASONING_META[reasoningDisplay];
  // Composer context meter: the last assistant turn's prompt + output against the selected model's
  // window. Providers that don't report usage leave this null, so the ring just doesn't render.
  const contextUsage = React.useMemo(() => {
    const last = [...messages].reverse().find((message) => message.role === 'assistant' && message.tokens);
    const limit = model?.details.contextTokens;
    if (!last?.tokens || !limit || limit <= 0) return null;
    const t = last.tokens;
    const used = t.input + t.cacheRead + t.cacheWrite + t.output;
    return used > 0 ? { used, limit } : null;
  }, [messages, model]);
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
      selectedModelId: submitted.modelId,
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
      const currentDraft = submittedKey ? composerDraftsRef.current.get(submittedKey) : undefined;
      if (submittedKey && currentDraft && (currentDraft.text.trim() || currentDraft.attachments.length || currentDraft.replyContext)) {
        updateComposerDraft(submittedKey, {
          ...currentDraft,
          attachments: currentDraft.attachments.length ? currentDraft.attachments : submitted.attachments,
          replyContext: currentDraft.replyContext ?? submitted.replyContext,
        });
        return;
      }
      const restored = { ...submitted, modelId: currentDraft?.modelId ?? submitted.modelId, variant: currentDraft?.variant ?? submitted.variant };
      if (submittedKey) updateComposerDraft(submittedKey, restored);
      if (previousComposerKeyRef.current !== submittedKey) return;
      setText(restored.text);
      setModelId(restored.modelId);
      setVariant(restored.variant);
      setAttachments(restored.attachments);
      setReplyContext(restored.replyContext);
    });
    if (composerKey) {
      if (session) touchedComposerChoicesRef.current.add(composerKey);
      updateComposerDraft(composerKey, session ? clearComposerText(submitted) : null);
    }
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
    onSaveNote(notesKey, parked);
    touchedComposerChoicesRef.current.add(composerKey);
    updateComposerDraft(composerKey, { text: '', modelId, variant, attachments, replyContext });
    setText('');
    setAttachmentError(null);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const bringBackNote = (note: SessionNote) => {
    if (!composerKey) return;
    const next = text.trim() ? `${text.trimEnd()}\n\n${note.text}` : note.text;
    setText(next);
    updateComposerDraft(composerKey, { text: next, modelId, variant, attachments, replyContext });
    onDeleteNote(notesKey, note.id);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const sendNote = async (note: SessionNote): Promise<boolean> => {
    if (!composerKey || !session || modelError) return false;
    const input: PromptInput = { text: note.text, model, selectedModelId: modelId, variant: variant || undefined };
    const sent = await (shouldQueue ? onQueue : onSend)(input);
    if (sent) onDeleteNote(notesKey, note.id);
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
    onSaveNote(notesKey, text);
    return true;
  };

  // Pull a queued message out of the server queue and into the composer to edit and re-send. The
  // text appears immediately; the queue removal finishes in the background.
  const editQueuedItem = (itemId: string): Promise<boolean> => {
    if (!composerKey) return Promise.resolve(false);
    const item = queueItems.find((entry) => entry.id === itemId);
    const queuedText = item ? item.text.trim() || item.content.trim() : '';
    if (!queuedText) return Promise.resolve(false);
    const previous = text;
    const next = previous.trim() ? `${previous.trimEnd()}\n\n${queuedText}` : queuedText;
    setText(next);
    updateComposerDraft(composerKey, { text: next, modelId, variant, attachments, replyContext });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
    return onRemoveQueued(itemId).then((removed) => {
      if (!removed && previousComposerKeyRef.current === composerKey && textRef.current === next) {
        // Still queued and the user hasn't touched it: restore the composer so it can't send twice.
        setText(previous);
        updateComposerDraft(composerKey, { text: previous, modelId, variant, attachments, replyContext });
      }
      return removed;
    });
  };

  const replyToMessage = (message: ChatMessage) => {
    setReplyContext({ ...message, text: messageContextText(message), parts: [] });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const stableReply = useStableCallback(replyToMessage);
  const stablePermission = useStableCallback(onPermission);
  const stableQuestion = useStableCallback(onQuestion);

  const jumpToMessage = (messageId: string) => {
    setFocusMessageId(messageId);
    setFocusRequest((request) => request + 1);
  };

  return (
    <main
      className="relative flex min-w-0 flex-1 overflow-hidden"
      data-session-key={session ? seed : undefined}
      onPointerDownCapture={(event) => {
        // Buttons carry their own intent. Activating here would start the column-width
        // transition under the pointer mid-press, so the click can land off the button —
        // a single press of × on an inactive column used to just activate instead of archiving.
        if (event.target instanceof Element && event.target.closest('button, a')) return;
        onActivate?.();
      }}
      onKeyDown={(event) => {
        if (session && !event.defaultPrevented && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault();
          setFindRequest((request) => request + 1);
        }
      }}
    >
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
            <header data-active={active} className="flex h-11 flex-none items-center gap-2.5 border-b px-3 sm:px-4 data-[active=true]:bg-muted/25">
              {editingTitle ? (
                <input
                  autoFocus
                  defaultValue={session.title ?? ''}
                  aria-label="Rename session"
                  className="min-w-0 flex-1 rounded-md border border-highlight/50 bg-background px-1.5 py-0.5 text-[13px] font-medium outline-none"
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename(event.currentTarget.value);
                    else if (event.key === 'Escape') setEditingTitle(false);
                  }}
                  onBlur={(event) => commitRename(event.currentTarget.value)}
                />
              ) : (
                <span
                  className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', onRename && 'cursor-text')}
                  title={onRename ? `${session.title ?? session.id} — double-click to rename` : undefined}
                  onDoubleClick={onRename ? () => setEditingTitle(true) : undefined}
                  style={instanceMarkerColor === undefined ? undefined : {
                    textDecoration: 'underline',
                    textDecorationColor: `var(--instance-marker-${instanceMarkerColor})`,
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '3px',
                  }}
                >
                  {session.title ?? session.id}
                </span>
              )}
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
              {onMinimize || onArchive ? (
                <div className="flex items-center gap-0.5">
                  {onMinimize ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={onMinimize}
                          aria-label="Minimize session"
                        >
                          <Minimize2 className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Minimize to a tab</TooltipContent>
                    </Tooltip>
                  ) : null}
                  {onArchive ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={onArchive}
                          aria-label="Archive session"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive session</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              ) : null}
            </header>

            <React.Suspense fallback={<TranscriptFallback />}>
              <Transcript
                findRequest={findRequest}
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
                onReply={stableReply}
                onPermission={stablePermission}
                onQuestion={stableQuestion}
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
                <Blob style={blobStyle} seed={`new:${draftInstance.id}`} identity={draftIdentity} size={48} interactive />
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
                key={`notes-${notesKey || 'none'}`}
                open={notesOpen}
                notes={sessionNotes}
                onOpenChange={setNotesOpen}
                onSend={sendNote}
                onBringBack={bringBackNote}
                onDelete={(note) => {
                  if (notesKey) onDeleteNote(notesKey, note.id);
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
                onRetryQueued={onRetryQueued}
                onDiscardQueued={onDiscardQueued}
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
            {modelError ? <div role="alert" className="mx-3 mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive">
              <span className="min-w-0 break-words">{modelError} Your draft is kept.</span>
              {onModelsRefresh ? <button type="button" className="underline" onClick={onModelsRefresh}>Refresh models</button> : null}
            </div> : null}
            <AutoResizeTextarea
              ref={textareaRef}
              value={text}
              maxHeight={160}
              maxLength={200_000}
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
                // Alt/Option+Enter skips the queue and sends now. Only while there's a queue to
                // skip — otherwise plain Enter already sends. Shift+Enter stays a newline.
                if (
                  event.key === 'Enter' &&
                  event.altKey &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
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

            <div className="flex items-center gap-1 overflow-x-auto px-2 pt-1.5 pb-2 sm:gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onMouseEnter={() => void loadModelPicker()}
                onFocus={() => void loadModelPicker()}
                onClick={() => {
                  setPickerActivated(true);
                  setPickerOpen(true);
                  onModelsRefresh?.();
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
                    instanceId={session?.instanceId ?? draftInstanceId ?? undefined}
                    directory={session?.directory ?? (draftDirectory || undefined)}
                    models={models}
                    recentModels={recentModels}
                    value={modelId}
                    variant={variant}
                    defaultModelId={defaultModelId}
                    collapseProviders
                    onSelect={(next, nextVariant) => {
                      setModelId(next);
                      setVariant(nextVariant);
                      updateComposerChoices({ modelId: next, variant: nextVariant });
                    }}
                    onOpenChange={setPickerOpen}
                  />
                </React.Suspense>
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
                className="h-7 flex-none px-2 text-xs data-[state=on]:border-warning/60 data-[state=on]:bg-warning/10 data-[state=on]:text-warning"
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
              {active ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 flex-none"
                  aria-label="Attach a file"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip />
                </Button>
              ) : null}

              {session && !notesOpen && sessionNotes.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-7 flex-none overflow-visible"
                  aria-label={`Restore notes (${sessionNotes.length})`}
                  title={`Show ${sessionNotes.length} minimized ${sessionNotes.length === 1 ? 'note' : 'notes'}`}
                  onClick={() => setNotesOpen(true)}
                >
                  <NotebookPen className="size-3.5 text-highlight" />
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-highlight px-0.5 text-[9px] font-semibold leading-none text-highlight-foreground">
                    {sessionNotes.length}
                  </span>
                </Button>
              ) : null}

              {session && !queueOpen && queueItems.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-7 flex-none overflow-visible"
                  aria-label={`Restore queued messages (${queueItems.length})`}
                  title={`Show ${queueItems.length} minimized queued ${queueItems.length === 1 ? 'message' : 'messages'}`}
                  onClick={() => setQueueOpen(true)}
                >
                  <Play className="size-3.5 text-highlight" />
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-highlight px-0.5 text-[9px] font-semibold leading-none text-highlight-foreground">
                    {queueItems.length}
                  </span>
                </Button>
              ) : null}

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

              {active && session && contextUsage ? (
                <ContextMeter
                  used={contextUsage.used}
                  limit={contextUsage.limit}
                  compacting={compacting}
                  onCompact={onCompact}
                />
              ) : null}

              {active && session ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onHandoff}
                      disabled={handoffing}
                      aria-label="Start a new session from a handoff summary"
                      className="flex size-7 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {handoffing ? <Loader2 className="size-3.5 animate-spin" /> : <GitFork className="size-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {handoffing
                      ? 'Starting a new session…'
                      : 'New session from a handoff summary — keeps this one'}
                  </TooltipContent>
                </Tooltip>
              ) : null}

              <AnimatePresence>
                {busy && session ? (
                  <motion.div
                    key="stop"
                    className="flex-none"
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

              {active && session ? (
                <Tooltip>
                <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 flex-none rounded-full text-muted-foreground aria-disabled:opacity-50"
                  aria-disabled={!text.trim()}
                  onClick={saveNote}
                  aria-label="Save as note"
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  <NotebookPen className="size-3.5" />
                </Button>
                </TooltipTrigger>
                <TooltipContent>{shortcutLabel('Save as note · Mod+Enter')}</TooltipContent>
                </Tooltip>
              ) : null}

              <Tooltip><TooltipTrigger asChild>
              <Button
                size="icon-sm"
                className="size-7 flex-none rounded-full aria-disabled:opacity-50"
                aria-disabled={!canSend}
                onClick={() => submit()}
                aria-label={shouldQueue ? 'Queue message' : 'Send'}
                aria-keyshortcuts="Enter"
              >
                <ArrowUp className={cn(sending && 'animate-pulse')} />
              </Button>
              </TooltipTrigger><TooltipContent>
                <div>{shouldQueue ? 'Queue message · Enter' : 'Send · Enter'}</div>
                <div>New line · Shift+Enter</div>
                {shouldQueue ? <div>{shortcutLabel('Send now · Alt+Enter')}</div> : null}
                {!text ? <div>Recall last message · ↑</div> : null}
              </TooltipContent></Tooltip>
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

const MemoChatView = React.memo(ChatView);
export default function StableChatView(props: Props) {
  return <MemoChatView {...useStableProps(props)} />;
}
