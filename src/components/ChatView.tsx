import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Check, ChevronDown, ChevronUp, FilePenLine, ListOrdered, Loader2, MessageCircleQuestion, Paperclip, Pin, RefreshCw, Reply, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { blobColor } from '../blob/color';
import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelList, PromptInput } from '../api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  AgentMode,
  AvatarIdentity,
  BallState,
  BlobStyle,
  ChatMessage,
  FileAttachment,
  Instance,
  InstanceDefaults,
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
  QueuedMessage,
  Session,
  SessionNote,
  StoredComposerDraft,
} from '../types';

const loadModelPicker = () => import('./ModelPicker');
const ModelPicker = React.lazy(loadModelPicker);
const Transcript = React.lazy(() => import('./Transcript'));
const SessionContextPanel = React.lazy(() => import('./SessionContextPanel'));

const ModelPickerFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="status">
    <span className="rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
      Loading models…
    </span>
  </div>
);

type ProjectPickerProps = {
  projects: Project[];
  value: string;
  onSelect: (directory: string) => void;
};

const ProjectPicker = ({ projects, value, onSelect }: ProjectPickerProps) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selectableProjects = React.useMemo(
    () => projects.filter((project): project is Project & { path: string } => Boolean(project.path)),
    [projects]
  );
  const selected = selectableProjects.find((project) => project.path === value) ?? null;
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selectableProjects;
    return selectableProjects.filter((project) =>
      [project.name, project.path].some((part) => part.toLowerCase().includes(needle))
    );
  }, [selectableProjects, query]);

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between px-3 font-normal"
        onClick={() => setOpen(true)}
        aria-label="New agent project"
      >
        <span className="truncate">{selected?.name ?? 'Custom folder'}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Choose a project</DialogTitle>
          <div className="border-b p-2.5">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a project name or folder…"
              aria-label="Filter projects"
              className="h-9 text-xs shadow-none"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onSelect('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span className="flex-1">Custom folder</span>
              {!selected ? <Check className="size-3.5 text-highlight" /> : null}
            </button>
            {filtered.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  onSelect(project.path);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{project.name}</span>
                  {project.path ? (
                    <span className="block truncate text-[11px] text-muted-foreground">{project.path}</span>
                  ) : null}
                </span>
                {project.path === value ? <Check className="mt-0.5 size-3.5 text-highlight" /> : null}
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No projects match “{query.trim()}”.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
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
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
  modelsByInstance: Record<string, ModelList>;
  instanceDefaults: Record<string, InstanceDefaults>;
  seed: string;
  identity: AvatarIdentity;
  state: BallState;
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
  pinnedMessageIds: Set<string>;
  sessionNotes: SessionNote[];
  savedComposerDrafts: Record<string, StoredComposerDraft>;
  composerDraftsHydrated: boolean;
  onComposerDraftsChange: (drafts: Record<string, StoredComposerDraft>) => void;
  onTogglePin: (message: ChatMessage) => void;
  onSessionNotesChange: (notes: SessionNote[]) => void;
  onDeleteNote: (note: SessionNote) => void;
  onBypassChange: (enabled: boolean) => void;
  onNewSessionInstanceChange: (instanceId: string) => void;
  onCreateSession: (options: NewSessionOptions) => Promise<boolean>;
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
  mode: AgentMode;
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
  mode: draft.mode ?? 'build',
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
  if (state.mode !== 'build') draft.mode = state.mode;
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

const NewSessionSetup = ({
  instanceId,
  instances,
  projects,
  models,
  recentModels,
  defaultModelId,
  defaults,
  onInstanceChange,
  onCreate,
  onCancel,
}: {
  instanceId: string;
  instances: Instance[];
  projects: Project[];
  models: ModelOption[];
  recentModels: string[];
  defaultModelId: string | null;
  defaults: InstanceDefaults;
  onInstanceChange: (instanceId: string) => void;
  onCreate: (options: NewSessionOptions) => Promise<boolean>;
  onCancel: () => void;
}) => {
  const [directory, setDirectory] = React.useState(defaults.directory ?? '');
  const [agent, setAgent] = React.useState<AgentMode>(defaults.agent ?? 'build');
  const [selectedModel, setSelectedModel] = React.useState(
    defaults.model ? modelRefKey(defaults.model) : DEFAULT_MODEL
  );
  const [selectedVariant, setSelectedVariant] = React.useState(defaults.variant ?? defaults.model?.variant ?? '');
  const [bypass, setBypass] = React.useState(defaults.bypass === true);
  const [creating, setCreating] = React.useState(false);
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [modelPickerActivated, setModelPickerActivated] = React.useState(false);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const selectedModelOption = models.find((entry) => modelRefKey(entry) === selectedModel);
  const defaultModelOption = defaultModelId ? models.find((entry) => modelRefKey(entry) === defaultModelId) : undefined;
  const selectedVariantOptions = selectedModelOption?.details.variants ?? [];

  const create = async () => {
    if (!directory.trim() || creating) return;
    setCreating(true);
    const model = models.find((entry) => modelRefKey(entry) === selectedModel);
    const created = await onCreate({
      instanceId,
      directory: directory.trim(),
      agent,
      model: model ? { providerID: model.providerID, modelID: model.modelID } : undefined,
      variant:
        model && selectedVariant && model.details.variants.includes(selectedVariant)
          ? selectedVariant
          : undefined,
      bypass,
    });
    if (!created) setCreating(false);
  };

  return (
    <div className="w-[calc(100%-1.5rem)] max-w-[560px] rounded-xl border bg-card p-4 text-foreground shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-base font-semibold">Start a new agent</h2>
        <p className="text-xs text-muted-foreground">
          Choose where and how it should run. The session is created only after you confirm.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Instance</span>
            <Select value={instanceId} onValueChange={onInstanceChange}>
              <SelectTrigger aria-label="New agent instance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {instances.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Project</span>
            <ProjectPicker
              projects={projects}
              value={directory}
              onSelect={(nextDirectory) => {
                setDirectory(nextDirectory);
                if (!nextDirectory) window.requestAnimationFrame(() => folderRef.current?.focus());
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Folder</span>
          <Input
            ref={folderRef}
            value={directory}
            onChange={(event) => setDirectory(event.target.value)}
            placeholder="Choose a project or enter a folder path"
            aria-label="New agent folder"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Agent</span>
            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger aria-label="New agent type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="build">Build</SelectItem>
                <SelectItem value="plan">Plan</SelectItem>
                {agent !== 'build' && agent !== 'plan' ? (
                  <SelectItem value={agent}>{agent}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Model</span>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between px-3 font-normal"
              onClick={() => {
                setModelPickerActivated(true);
                setModelPickerOpen(true);
              }}
              aria-label="Choose new agent model"
            >
              <span className="truncate">
                {selectedModelOption
                  ? `${selectedModelOption.details.providerName} / ${selectedModelOption.details.name}${selectedModel === defaultModelId ? ' (Default)' : ''}`
                  : defaultModelOption
                    ? `${defaultModelOption.details.providerName} / ${defaultModelOption.details.name} (Default)`
                    : 'Server default'}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
            {modelPickerActivated ? (
              <React.Suspense fallback={<ModelPickerFallback />}>
                <ModelPicker
                  open={modelPickerOpen}
                  models={models}
                  recentModels={recentModels}
                  value={selectedModel}
                  defaultModelId={defaultModelId}
                  collapseProviders
                  onSelect={(next) => {
                    setSelectedModel(next);
                    const nextModel = models.find((entry) => modelRefKey(entry) === next);
                    if (selectedVariant && !nextModel?.details.variants.includes(selectedVariant)) {
                      setSelectedVariant('');
                    }
                  }}
                  onOpenChange={setModelPickerOpen}
                />
              </React.Suspense>
            ) : null}
            {selectedVariantOptions.length ? (
              <Select
                value={selectedVariant || '__default'}
                onValueChange={(value) => setSelectedVariant(value === '__default' ? '' : value)}
              >
                <SelectTrigger aria-label="New agent reasoning level" className="capitalize">
                  <SelectValue placeholder="Reasoning" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default">Reasoning: default</SelectItem>
                  {selectedVariantOptions.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-medium">Bypass permission prompts</span>
            <span className="text-[11px] text-muted-foreground">Only while this session is selected.</span>
          </div>
          <Toggle
            pressed={bypass}
            onPressedChange={setBypass}
            variant="outline"
            size="sm"
            className="data-[state=on]:border-warning/60 data-[state=on]:bg-warning/10 data-[state=on]:text-warning"
          >
            <ShieldCheck />
            {bypass ? 'On' : 'Off'}
          </Toggle>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={creating}>
          Cancel
        </Button>
        <Button onClick={() => void create()} disabled={!directory.trim() || creating}>
          {creating ? <Loader2 className="animate-spin" /> : null}
          Create agent
        </Button>
      </div>
    </div>
  );
};

export default function ChatView({
  session,
  instance,
  instanceMarkerColor,
  newSessionInstanceId,
  instances,
  projectsByInstance,
  modelsByInstance,
  instanceDefaults,
  seed,
  identity,
  state,
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
  pinnedMessageIds,
  sessionNotes,
  savedComposerDrafts,
  composerDraftsHydrated,
  onComposerDraftsChange,
  onTogglePin,
  onSessionNotesChange,
  onDeleteNote,
  onBypassChange,
  onNewSessionInstanceChange,
  onCreateSession,
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
  const [mode, setMode] = React.useState<AgentMode>('build');
  const [modelId, setModelId] = React.useState(DEFAULT_MODEL);
  const [variant, setVariant] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerActivated, setPickerActivated] = React.useState(false);
  const [queueModelPickerItemId, setQueueModelPickerItemId] = React.useState<string | null>(null);
  // Queue mutations round-trip to the server; lock the row so a double-click can't fire two.
  const [busyQueueItemId, setBusyQueueItemId] = React.useState<string | null>(null);
  const runQueueAction = async (itemId: string, action: () => Promise<boolean>) => {
    if (busyQueueItemId) return;
    setBusyQueueItemId(itemId);
    try {
      await action();
    } finally {
      setBusyQueueItemId((current) => (current === itemId ? null : current));
    }
  };
  const [attachments, setAttachments] = React.useState<FileAttachment[]>([]);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const [replyContext, setReplyContext] = React.useState<ChatMessage | null>(null);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [contextSection, setContextSection] = React.useState<'notes' | 'pins'>('notes');
  const [contextRequest, setContextRequest] = React.useState(0);
  const [focusMessageId, setFocusMessageId] = React.useState<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const createdModelRef = React.useRef<{ key: string; variant?: string } | null>(null);
  const composerDraftsRef = React.useRef(new Map<string, ComposerState>());
  const touchedComposerChoicesRef = React.useRef(new Set<string>());
  const previousComposerKeyRef = React.useRef<string | null>(null);
  const draftsHydratedRef = React.useRef(false);
  const draftPersistTimerRef = React.useRef<number | undefined>(undefined);
  const onComposerDraftsChangeRef = React.useRef(onComposerDraftsChange);
  onComposerDraftsChangeRef.current = onComposerDraftsChange;
  const composerKey = session ? `${session.instanceId}::${session.id}` : null;

  React.useEffect(() => {
    if (!composerDraftsHydrated || draftsHydratedRef.current) return;
    draftsHydratedRef.current = true;
    Object.entries(savedComposerDrafts).forEach(([key, draft]) => {
      if (draft.modelId !== undefined || draft.variant || draft.mode) {
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
      setMode(restored.mode);
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

  const updateComposerChoices = (patch: Partial<Pick<ComposerState, 'modelId' | 'variant' | 'mode'>>) => {
    if (!composerKey) return;
    touchedComposerChoicesRef.current.add(composerKey);
    updateComposerDraft(composerKey, {
      text,
      modelId,
      variant,
      mode,
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
          mode,
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
    const next: ComposerState = saved ?? {
      text: '',
      modelId: created?.key ?? sessionModelKey ?? defaultModelId ?? DEFAULT_MODEL,
      variant: created?.variant ?? session?.model?.variant ?? '',
      mode: session?.agent ?? 'build',
      attachments: [],
      replyContext: null,
    };

    setText(next.text);
    setModelId(next.modelId);
    setVariant(next.variant);
    setMode(next.mode);
    setAttachments(next.attachments);
    setAttachmentError(null);
    setReplyContext(next.replyContext);
    createdModelRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above the effect
  }, [composerKey]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [text, composerKey]);

  React.useEffect(() => {
    setContextOpen(false);
    setFocusMessageId(null);
    setQueueModelPickerItemId(null);
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
  const setupInstance = instances.find((candidate) => candidate.id === newSessionInstanceId) ?? null;
  const setupProjects = newSessionInstanceId ? projectsByInstance[newSessionInstanceId] ?? [] : [];
  const setupModels = newSessionInstanceId ? modelsByInstance[newSessionInstanceId]?.models ?? [] : [];
  const setupDefaultModelId = newSessionInstanceId ? modelsByInstance[newSessionInstanceId]?.defaultModelId ?? null : null;
  const setupDefaults = newSessionInstanceId ? instanceDefaults[newSessionInstanceId] ?? {} : {};

  const createSessionFromSetup = async (options: NewSessionOptions): Promise<boolean> => {
    const created = await onCreateSession(options);
    if (created) {
      setMode(options.agent);
      const nextModel = options.model ? modelRefKey(options.model) : DEFAULT_MODEL;
      createdModelRef.current = { key: nextModel, variant: options.variant };
      setModelId(nextModel);
      setVariant(options.variant ?? '');
    }
    return created;
  };

  const canSend = Boolean(session) && (text.trim().length > 0 || attachments.length > 0);
  const queueItems = queue?.items ?? [];
  const shouldQueue = Boolean(session && (busy || queueItems.length > 0));
  const queueModelPickerItem = queueItems.find((item) => item.id === queueModelPickerItemId) ?? null;
  const queuedModelLabel = (item: QueuedMessage): string => {
    const option = models.find(
      (candidate) =>
        candidate.providerID === item.sendConfig.providerID &&
        candidate.modelID === item.sendConfig.modelID
    );
    const name = option?.details.name ?? item.sendConfig.modelID;
    return item.sendConfig.variant ? `${name} · ${item.sendConfig.variant}` : name;
  };

  const submit = () => {
    if (!canSend) return;
    const submitted: ComposerState = { text: text.trim(), modelId, variant, mode, attachments, replyContext };
    const submittedKey = composerKey;
    const send = shouldQueue ? onQueue : onSend;
    send({
      text: submitted.text,
      model,
      mode: submitted.mode,
      variant: submitted.variant || undefined,
      attachments: submitted.attachments,
      replyContext: submitted.replyContext ? messageContextText(submitted.replyContext) : undefined,
    }).then((sent) => {
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
      setMode(submitted.mode);
      setAttachments(submitted.attachments);
      setReplyContext(submitted.replyContext);
    });
    if (composerKey) updateComposerDraft(composerKey, null);
    setText('');
    setAttachments([]);
    setAttachmentError(null);
    setReplyContext(null);
  };

  const openContext = (section: 'notes' | 'pins') => {
    setContextSection(section);
    setContextRequest((request) => request + 1);
    setContextOpen(true);
  };

  const replyToMessage = (message: ChatMessage) => {
    setReplyContext(message);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const insertNotes = (noteText: string) => {
    setText((current) => {
      const next = current.trim() ? `${current}\n\n${noteText.trim()}` : noteText.trim();
      if (composerKey) {
        updateComposerDraft(composerKey, {
          text: next,
          modelId,
          variant,
          mode,
          attachments,
          replyContext,
        });
      }
      return next;
    });
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
              <Blob
                style={blobStyle}
                seed={seed}
                identity={identity}
                size={24}
                state={state}
                interactive={false}
              />
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
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openContext('notes')}>
                <FilePenLine />
                <span className="hidden sm:inline">Notes</span>
              </Button>
              {pinnedMessages.length ? (
                <Button variant="secondary" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={() => openContext('pins')}>
                  <Pin />
                  {pinnedMessages.length} {pinnedMessages.length === 1 ? 'pin' : 'pins'}
                </Button>
              ) : null}
              {instance ? (
                <Badge variant="secondary" className="hidden font-normal text-muted-foreground sm:inline-flex">
                  {instance.label}
                </Badge>
              ) : null}
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
                accentColor={blobColor(blobStyle, identity)}
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
            {newSessionInstanceId && setupInstance ? (
              <NewSessionSetup
                instanceId={newSessionInstanceId}
                instances={instances.filter((candidate) => candidate.attachable)}
                projects={setupProjects}
                models={setupModels}
                recentModels={recentModels}
                defaultModelId={setupDefaultModelId}
                defaults={setupDefaults}
                onInstanceChange={onNewSessionInstanceChange}
                onCreate={createSessionFromSetup}
                onCancel={onCancelNewSession}
              />
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

      {session ? (
        <div className="safe-composer flex-none border-t bg-card p-2.5 sm:p-3">
          <div className="mx-auto flex max-w-[760px] flex-col gap-2">
            {queueItems.length ? (
              <section
                aria-label="Queued messages"
                className="rounded-xl border bg-background/80 px-3 py-2 text-[11.5px] shadow-sm"
              >
                <div className="mb-1.5 flex items-center gap-2 text-muted-foreground">
                  <ListOrdered className="size-3.5 text-highlight" />
                  <span className="font-medium text-foreground">
                    {queueItems.length} queued {queueItems.length === 1 ? 'message' : 'messages'}
                  </span>
                  <span className="min-w-0 flex-1">
                    {queue?.sendingId ? 'Sending the next one…' : 'They send when this agent is idle.'}
                  </span>
                </div>
                <ol className="flex max-h-28 flex-col gap-1 overflow-y-auto">
                  {queueItems.map((item, index) => {
                    const sendingItem = queue?.sendingId === item.id;
                    const busy = sendingItem || busyQueueItemId === item.id;
                    const reorderLocked = Boolean(queue?.sendingId) || busyQueueItemId !== null;
                    const preview = item.text.trim() || item.content.trim() ||
                      `${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                      >
                        {busy ? (
                          <Loader2 className="size-3 flex-none animate-spin text-highlight" />
                        ) : (
                          <span className="size-1.5 flex-none rounded-full bg-highlight" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block truncate" title={preview}>{preview}</span>
                          <button
                            type="button"
                            disabled={busy || models.length === 0}
                            onClick={() => setQueueModelPickerItemId(item.id)}
                            aria-label={`Change model for queued message: ${preview.slice(0, 60)}`}
                            title="Change queued message model"
                            className="mt-0.5 block max-w-full truncate rounded text-[10.5px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {queuedModelLabel(item)}
                          </button>
                        </div>
                        {item.attachments.length ? (
                          <span className="flex-none rounded bg-background px-1 py-0.5 text-[10px] text-muted-foreground">
                            {item.attachments.length} file{item.attachments.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
                        <div className="flex flex-none items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={reorderLocked || index === 0}
                            onClick={() => void runQueueAction(item.id, () => onMoveQueued(item.id, -1))}
                            aria-label={`Move queued message up: ${preview.slice(0, 60)}`}
                            title="Move up"
                          >
                            <ChevronUp />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={reorderLocked || index === queueItems.length - 1}
                            onClick={() => void runQueueAction(item.id, () => onMoveQueued(item.id, 1))}
                            aria-label={`Move queued message down: ${preview.slice(0, 60)}`}
                            title="Move down"
                          >
                            <ChevronDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={busy}
                            onClick={() => void runQueueAction(item.id, () => onSendQueued(item.id))}
                            aria-label={`Send queued message now: ${preview.slice(0, 60)}`}
                            title="Send now and steer the current turn"
                            className="px-1.5 text-[11px] text-muted-foreground hover:text-highlight"
                          >
                            Send now
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={busy}
                            onClick={() => void runQueueAction(item.id, () => onRemoveQueued(item.id))}
                            aria-label={`Cancel queued message: ${preview.slice(0, 60)}`}
                            title={sendingItem ? 'Cannot cancel while this message is being sent' : 'Cancel queued message'}
                            className="px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                          >
                            Cancel
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}
            {queueModelPickerItem ? (
              <React.Suspense fallback={<ModelPickerFallback />}>
                <ModelPicker
                  open
                  models={models}
                  recentModels={recentModels}
                  value={modelRefKey(queueModelPickerItem.sendConfig)}
                  defaultModelId={defaultModelId}
                  collapseProviders
                  onSelect={(next) => {
                    const nextModel = models.find((entry) => modelRefKey(entry) === next);
                    const itemId = queueModelPickerItem.id;
                    setQueueModelPickerItemId(null);
                    if (nextModel) void runQueueAction(itemId, () => onQueuedModelChange(itemId, nextModel));
                  }}
                  onOpenChange={(open) => {
                    if (!open) setQueueModelPickerItemId(null);
                  }}
                />
              </React.Suspense>
            ) : null}
            <motion.div
              layout
            className={cn(
              'flex flex-col rounded-xl border bg-background transition-[box-shadow,border-color] duration-200 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
              !session && 'opacity-60'
            )}
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
            <textarea
              ref={textareaRef}
              value={text}
              rows={1}
              placeholder={session ? (shouldQueue ? 'Queue a follow-up…' : 'Message the agent…') : 'Select a session first'}
              aria-label={shouldQueue ? 'Queue a follow-up message' : 'Message the agent'}
              disabled={!session}
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
                      mode,
                      attachments,
                      replyContext,
                    });
                  } else {
                    updateComposerDraft(composerKey, null);
                  }
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              className="max-h-40 min-h-9 w-full resize-none overflow-y-auto bg-transparent px-3 pt-2 pb-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:px-3.5 sm:text-[13px]"
            />

            <div className="flex items-center gap-1 overflow-x-auto px-2 pb-2 sm:gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={!session}
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
                  disabled={!session}
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

              <Select
                value={mode}
                onValueChange={(nextMode) => {
                  setMode(nextMode);
                  updateComposerChoices({ mode: nextMode });
                }}
                disabled={!session}
              >
                <SelectTrigger size="sm" className="h-7 border-none bg-transparent px-2 text-xs shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build">Build</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
                  {mode !== 'build' && mode !== 'plan' ? (
                    <SelectItem value={mode}>{mode}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>

              <Toggle
                pressed={bypass}
                onPressedChange={onBypassChange}
                disabled={!session}
                variant="outline"
                size="sm"
                aria-label="Bypass permission prompts while this session is selected"
                title="Automatically allow permission prompts while this session is selected"
                className="h-7 px-2 text-xs data-[state=on]:border-warning/60 data-[state=on]:bg-warning/10 data-[state=on]:text-warning"
              >
                <ShieldCheck className="size-3.5" />
                <span className="hidden sm:inline">Bypass</span>
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
                disabled={!session}
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

              <Button
                size="icon-sm"
                className="size-7 rounded-full"
                disabled={!canSend}
                onClick={submit}
                aria-label={shouldQueue ? 'Queue message' : 'Send'}
                title={shouldQueue ? 'Queue message' : 'Send'}
              >
                <ArrowUp className={cn(sending && 'animate-pulse')} />
              </Button>
            </div>
            </motion.div>
          </div>
        </div>
      ) : null}
      </div>
      {session ? (
        <React.Suspense fallback={null}>
          <SessionContextPanel
            open={contextOpen}
            sessionKey={composerKey ?? ''}
            sessionTitle={session.title ?? session.id}
            notes={sessionNotes}
            pinnedMessages={pinnedMessages}
            focusSection={contextSection}
            focusRequest={contextRequest}
            onClose={() => setContextOpen(false)}
            onNotesChange={onSessionNotesChange}
            onDeleteNote={onDeleteNote}
            onInsertNotes={insertNotes}
            onJump={jumpToMessage}
            onReply={replyToMessage}
            onUnpin={onTogglePin}
          />
        </React.Suspense>
      ) : null}
    </main>
  );
}
