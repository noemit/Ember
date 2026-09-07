import * as React from 'react';
import { Check, ChevronDown, Loader2, ShieldCheck } from 'lucide-react';
import { DEFAULT_MODEL, modelRefKey } from '../types';
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
import { ModelPickerFallback } from './ModelPickerFallback';
import type {
  Instance,
  InstanceDefaults,
  ModelOption,
  NewSessionOptions,
  Project,
} from '../types';

const ModelPicker = React.lazy(() => import('./ModelPicker'));

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

export default function NewSessionSetup({
  instanceId,
  instances,
  projects,
  models,
  recentModels,
  defaultModelId,
  defaults,
  suggestedDirectory,
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
  /** Most recently used directory on this instance, or its last-opened project. */
  suggestedDirectory: string | null;
  onInstanceChange: (instanceId: string) => void;
  onCreate: (options: NewSessionOptions) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [directory, setDirectory] = React.useState(defaults.directory ?? suggestedDirectory ?? '');
  // Preselect a recent folder until the user picks one themselves; a saved default folder or
  // a manual edit wins over the suggestion.
  const directoryTouchedRef = React.useRef(Boolean(defaults.directory));
  const directorySuggestion = defaults.directory ?? suggestedDirectory ?? '';
  React.useEffect(() => {
    // A different instance has its own default/recent folders; treat the field as untouched.
    directoryTouchedRef.current = Boolean(defaults.directory);
    setDirectory(directorySuggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- instance switch re-seeds the folder
  }, [instanceId]);
  React.useEffect(() => {
    if (!directoryTouchedRef.current) setDirectory(directorySuggestion);
  }, [directorySuggestion]);
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
                directoryTouchedRef.current = true;
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
            onChange={(event) => {
              directoryTouchedRef.current = true;
              setDirectory(event.target.value);
            }}
            placeholder="Choose a project or enter a folder path"
            aria-label="New agent folder"
          />
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

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-medium">YOLO mode</span>
            <span className="text-[11px] text-muted-foreground">
              Permission prompts are accepted automatically, even while Ember is closed.
            </span>
          </div>
          <Toggle
            pressed={bypass}
            onPressedChange={setBypass}
            variant="outline"
            size="sm"
            aria-label="YOLO mode"
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
}
