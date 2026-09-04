import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, ChevronDown, Loader2, Paperclip, Reply, ShieldCheck, Square, X } from 'lucide-react';
import Blob from '../blob/Blob';
import { blobColor } from '../blob/color';
import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelList, PromptInput } from '../api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
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
  ModelOption,
  NewSessionOptions,
  Project,
  PermissionReply,
  PermissionRequest,
  QuestionAnswers,
  QuestionRequest,
  Session,
} from '../types';

const loadModelPicker = () => import('./ModelPicker');
const ModelPicker = React.lazy(loadModelPicker);
const Transcript = React.lazy(() => import('./Transcript'));

const ModelPickerFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="status">
    <span className="rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
      Loading models…
    </span>
  </div>
);

const TranscriptFallback = () => (
  <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-muted-foreground" role="status">
    Loading conversation…
  </div>
);

type Props = {
  session: Session | null;
  instance: Instance | null;
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
  bypass: boolean;
  pinnedMessageIds: Set<string>;
  onTogglePin: (message: ChatMessage) => void;
  onBypassChange: (enabled: boolean) => void;
  onNewSessionInstanceChange: (instanceId: string) => void;
  onCreateSession: (options: NewSessionOptions) => Promise<boolean>;
  onCancelNewSession: () => void;
  onSend: (input: PromptInput) => void;
  onAbort: () => void;
  onPermission: (request: PermissionRequest, reply: PermissionReply) => Promise<boolean>;
  onQuestion: (request: QuestionRequest, answers: QuestionAnswers | null) => Promise<boolean>;
};

const modelKey = (model: ModelOption) => `${model.providerID}/${model.modelID}`;

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
  defaults,
  onInstanceChange,
  onCreate,
  onCancel,
}: {
  instanceId: string;
  instances: Instance[];
  projects: Project[];
  models: ModelOption[];
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
  const [bypass, setBypass] = React.useState(defaults.bypass === true);
  const [creating, setCreating] = React.useState(false);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const projectValue = projects.some((project) => project.path === directory) ? directory : '__custom';

  const create = async () => {
    if (!directory.trim() || creating) return;
    setCreating(true);
    const model = models.find((entry) => modelKey(entry) === selectedModel);
    const created = await onCreate({
      instanceId,
      directory: directory.trim(),
      agent,
      model: model ? { providerID: model.providerID, modelID: model.modelID } : undefined,
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
            <Select
              value={projectValue}
              onValueChange={(value) => {
                if (value === '__custom') {
                  setDirectory('');
                  window.requestAnimationFrame(() => folderRef.current?.focus());
                } else setDirectory(value);
              }}
            >
              <SelectTrigger className="w-full" aria-label="New agent project">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom">Custom folder</SelectItem>
                {projects.filter((project) => project.path).map((project) => (
                  <SelectItem key={project.path} value={project.path!}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={agent} onValueChange={(value) => setAgent(value === 'plan' ? 'plan' : 'build')}>
              <SelectTrigger aria-label="New agent type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="build">Build</SelectItem>
                <SelectItem value="plan">Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Model</span>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger aria-label="New agent model">
                <SelectValue placeholder="Instance default" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value={DEFAULT_MODEL}>Instance default</SelectItem>
                {models.map((model) => (
                  <SelectItem key={modelKey(model)} value={modelKey(model)}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  bypass,
  pinnedMessageIds,
  onTogglePin,
  onBypassChange,
  onNewSessionInstanceChange,
  onCreateSession,
  onCancelNewSession,
  onSend,
  onAbort,
  onPermission,
  onQuestion,
}: Props) {
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState<AgentMode>('build');
  const [modelId, setModelId] = React.useState(DEFAULT_MODEL);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerActivated, setPickerActivated] = React.useState(false);
  const [attachments, setAttachments] = React.useState<FileAttachment[]>([]);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const [replyContext, setReplyContext] = React.useState<ChatMessage | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const createdModelRef = React.useRef<string | null>(null);

  const last = messages[messages.length - 1];
  const busy = sending || state === 'active' || (last?.role === 'assistant' && !last.completed);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files].filter((file) => file.size <= MAX_ATTACHMENT_BYTES);
    setAttachmentError(
      accepted.length < files.length ? 'Files over 10 MB were skipped.' : null
    );
    const read = await Promise.all(accepted.map(readAttachment));
    setAttachments((prev) => [...prev, ...read]);
  };

  React.useEffect(() => {
    setModelId(createdModelRef.current ?? defaultModelId ?? DEFAULT_MODEL);
    createdModelRef.current = null;
  }, [defaultModelId, session?.instanceId]);

  React.useEffect(() => {
    setReplyContext(null);
    if (session) textareaRef.current?.focus();
  }, [session?.id]);

  const model = models.find((entry) => modelKey(entry) === modelId);
  const setupInstance = instances.find((candidate) => candidate.id === newSessionInstanceId) ?? null;
  const setupProjects = newSessionInstanceId ? projectsByInstance[newSessionInstanceId] ?? [] : [];
  const setupModels = newSessionInstanceId ? modelsByInstance[newSessionInstanceId]?.models ?? [] : [];
  const setupDefaults = newSessionInstanceId ? instanceDefaults[newSessionInstanceId] ?? {} : {};

  const createSessionFromSetup = async (options: NewSessionOptions): Promise<boolean> => {
    const created = await onCreateSession(options);
    if (created) {
      setMode(options.agent);
      const nextModel = options.model ? modelRefKey(options.model) : DEFAULT_MODEL;
      createdModelRef.current = nextModel;
      setModelId(nextModel);
    }
    return created;
  };

  const canSend = Boolean(session) && !sending && (text.trim().length > 0 || attachments.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend({
      text: text.trim(),
      model,
      mode,
      attachments,
      replyContext: replyContext ? messageContextText(replyContext) : undefined,
    });
    setText('');
    setAttachments([]);
    setAttachmentError(null);
    setReplyContext(null);
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
            <header className="flex h-11 flex-none items-center gap-2.5 border-b px-3 sm:px-4">
              <Blob
                style={blobStyle}
                seed={seed}
                identity={identity}
                size={24}
                state={state}
                interactive={false}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {session.title ?? session.id}
              </span>
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
                accentColor={blobColor(blobStyle, identity)}
                pinnedMessageIds={pinnedMessageIds}
                onTogglePin={onTogglePin}
                onReply={(message) => {
                  setReplyContext(message);
                  window.requestAnimationFrame(() => textareaRef.current?.focus());
                }}
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
              rows={3}
              placeholder={session ? 'Message the agent…' : 'Select a session first'}
              aria-label="Message the agent"
              disabled={!session}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:px-3.5 sm:pt-3 sm:text-[13px]"
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
                <span className="truncate">
                  {model ? `${model.details.providerName} / ${model.details.name}` : 'Default model'}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
              {pickerActivated ? (
                <React.Suspense fallback={<ModelPickerFallback />}>
                  <ModelPicker
                    open={pickerOpen}
                    models={models}
                    recentModels={recentModels}
                    value={modelId}
                    onSelect={setModelId}
                    onOpenChange={setPickerOpen}
                  />
                </React.Suspense>
              ) : null}

              <Select
                value={mode}
                onValueChange={(value) => setMode(value === 'plan' ? 'plan' : 'build')}
                disabled={!session}
              >
                <SelectTrigger size="sm" className="h-7 border-none bg-transparent px-2 text-xs shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build">Build</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
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
                aria-label="Send"
              >
                <ArrowUp className={cn(sending && 'animate-pulse')} />
              </Button>
            </div>
          </motion.div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
