import * as React from 'react';
import { motion } from 'motion/react';
import { Check, KeyRound, ShieldCheck } from 'lucide-react';
import Blob from '../blob/Blob';
import { INSTANCE_MARKER_COLORS } from '../blob/contrast';
import { THEME_GROUPS, THEMES } from '../themes';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { DEFAULT_MODEL, modelRefKey, SESSION_WINDOWS } from '../types';
import type { ModelList } from '../api';
import type { BlobStyle, EmberSettings, EmberSettingsPatch, Instance, InstanceDefaults, Project } from '../types';

type Props = {
  open: boolean;
  view: 'general' | 'instances';
  settings: EmberSettings;
  instances: Instance[];
  projectsByInstance: Record<string, Project[]>;
  modelsByInstance: Record<string, ModelList>;
  onChange: (patch: EmberSettingsPatch) => void;
  onOpenChange: (open: boolean) => void;
};

const BLOB_STYLES: Array<{ id: BlobStyle; name: string; hint: string }> = [
  { id: 'grok', name: 'Buddy', hint: 'Flat, soft shapes' },
  { id: 'glyph', name: 'Glyph', hint: 'Hand-drawn icons' },
];

const InstanceDefaultsSettings = ({
  instances,
  projectsByInstance,
  modelsByInstance,
  settings,
  onChange,
}: Pick<Props, 'instances' | 'projectsByInstance' | 'modelsByInstance' | 'settings' | 'onChange'>) => {
  const [instanceId, setInstanceId] = React.useState(instances.find((instance) => instance.attachable)?.id ?? instances[0]?.id ?? '');

  React.useEffect(() => {
    if (!instances.some((instance) => instance.id === instanceId)) {
      setInstanceId(instances.find((instance) => instance.attachable)?.id ?? instances[0]?.id ?? '');
    }
  }, [instanceId, instances]);

  if (!instanceId) {
    return <p className="text-sm text-muted-foreground">No instances are configured yet.</p>;
  }

  const defaults = settings.instanceDefaults[instanceId] ?? {};
  const projects = projectsByInstance[instanceId] ?? [];
  const models = modelsByInstance[instanceId]?.models ?? [];
  const modelKey = defaults.model ? modelRefKey(defaults.model) : DEFAULT_MODEL;
  const projectValue = defaults.directory && projects.some((project) => project.path === defaults.directory)
    ? defaults.directory
    : '__none';
  const update = (patch: Partial<InstanceDefaults>) =>
    onChange({
      instanceDefaults: {
        ...settings.instanceDefaults,
        [instanceId]: { ...defaults, ...patch },
      },
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instance</span>
        <Select value={instanceId} onValueChange={setInstanceId}>
          <SelectTrigger aria-label="Instance">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium">Instance underline</span>
        <span className="text-[11px] text-muted-foreground">
          Optional marker shown beneath session names from this instance.
        </span>
        <div className="grid grid-cols-7 gap-2">
          <button
            type="button"
            aria-label="No instance underline"
            aria-pressed={defaults.markerColor === undefined}
            onClick={() => update({ markerColor: undefined })}
            className={cn(
              'flex h-8 items-center justify-center rounded-md border text-[10px] text-muted-foreground transition-colors hover:bg-muted',
              defaults.markerColor === undefined && 'border-highlight ring-2 ring-highlight/20'
            )}
          >
            None
          </button>
          {INSTANCE_MARKER_COLORS.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Instance underline color ${index + 1}`}
              aria-pressed={defaults.markerColor === index}
              onClick={() => update({ markerColor: index })}
              className={cn(
                'flex h-8 items-center justify-center rounded-md border transition-colors hover:bg-muted',
                defaults.markerColor === index && 'border-highlight ring-2 ring-highlight/20'
              )}
            >
              <span className="h-1 w-5 rounded-full" style={{ backgroundColor: `var(--instance-marker-${index})` }} />
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Default project</span>
          <Select
            value={projectValue}
            onValueChange={(value) => update({ directory: value === '__none' ? undefined : value })}
          >
            <SelectTrigger className="w-full" aria-label="Default project">
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No default</SelectItem>
              {projects.filter((project) => project.path).map((project) => (
                <SelectItem key={project.path} value={project.path!}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Default agent</span>
          <Select
            value={defaults.agent ?? 'build'}
            onValueChange={(value) => update({ agent: value === 'plan' ? 'plan' : 'build' })}
          >
            <SelectTrigger aria-label="Default agent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="build">Build</SelectItem>
              <SelectItem value="plan">Plan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Default folder</span>
        <Input
          value={defaults.directory ?? ''}
          onChange={(event) => update({ directory: event.target.value || undefined })}
          placeholder="Project path or custom folder"
          aria-label="Default folder"
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Default model</span>
        <Select
          value={modelKey}
          onValueChange={(value) => {
            const model = models.find((entry) => modelRefKey(entry) === value);
            update({
              model:
                value === DEFAULT_MODEL || !model
                  ? undefined
                  : { providerID: model.providerID, modelID: model.modelID },
            });
          }}
        >
          <SelectTrigger aria-label="Default model">
            <SelectValue placeholder="Instance default" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value={DEFAULT_MODEL}>Instance default</SelectItem>
            {models.map((model) => (
              <SelectItem key={modelRefKey(model)} value={modelRefKey(model)}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">Bypass by default</span>
          <span className="text-[11px] text-muted-foreground">
            Auto-allow prompts only while a session on this instance is selected.
          </span>
        </div>
        <Toggle
          pressed={defaults.bypass === true}
          onPressedChange={(bypass) => update({ bypass })}
          variant="outline"
          aria-label="Bypass by default"
          className="data-[state=on]:border-warning/60 data-[state=on]:bg-warning/10 data-[state=on]:text-warning"
        >
          <ShieldCheck />
          {defaults.bypass ? 'On' : 'Off'}
        </Toggle>
      </section>
    </div>
  );
};

export default function SettingsPanel({
  open,
  view,
  settings,
  instances,
  projectsByInstance,
  modelsByInstance,
  onChange,
  onOpenChange,
}: Props) {
  const [remotePassword, setRemotePassword] = React.useState('');

  const saveRemotePassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (remotePassword.length < 8) return;
    onChange({ remotePassword });
    setRemotePassword('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[520px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-h-[86vh] sm:max-w-[520px]">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>{view === 'instances' ? 'Instance settings' : 'Settings'}</DialogTitle>
          <DialogDescription>
            {view === 'instances'
              ? 'Choose the defaults used when starting work on each instance.'
              : 'Applies to this window across every instance.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-5">
          {view === 'instances' ? (
            <InstanceDefaultsSettings
              instances={instances}
              projectsByInstance={projectsByInstance}
              modelsByInstance={modelsByInstance}
              settings={settings}
              onChange={onChange}
            />
          ) : (
            <>
          <section className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sessions
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">Show sessions active in the</span>
                <span className="text-[11px] text-muted-foreground">
                  Quieter sessions drop out of the list until they're active again.
                </span>
              </div>
              <Select
                value={String(settings.sessionWindowHours)}
                onValueChange={(value) => onChange({ sessionWindowHours: Number(value) })}
              >
                <SelectTrigger size="sm" className="w-full text-xs sm:w-[150px]" aria-label="Session window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_WINDOWS.map((option) => (
                    <SelectItem key={option.hours} value={String(option.hours)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Remote access
            </h3>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <KeyRound className="mt-0.5 size-4 flex-none text-muted-foreground" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">Allow access over Tailscale</span>
                  <span className="text-[11px] text-muted-foreground">
                    Requires a password and is available only to your Tailnet.
                  </span>
                </div>
              </div>
              <Toggle
                pressed={settings.remoteAccessEnabled}
                disabled={!settings.remotePasswordConfigured}
                onPressedChange={(enabled) => onChange({ remoteAccessEnabled: enabled })}
                variant="outline"
                size="sm"
                aria-label="Allow remote access over Tailscale"
              >
                {settings.remoteAccessEnabled ? 'On' : 'Off'}
              </Toggle>
            </div>
            <form className="flex items-center gap-2" onSubmit={saveRemotePassword}>
              <Input
                type="password"
                value={remotePassword}
                onChange={(event) => setRemotePassword(event.target.value)}
                placeholder={settings.remotePasswordConfigured ? 'Enter a new password' : 'Set a password'}
                minLength={8}
                maxLength={256}
                autoComplete="new-password"
                aria-label="Remote access password"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={remotePassword.length < 8}>
                {settings.remotePasswordConfigured ? 'Change' : 'Set password'}
              </Button>
            </form>
            {settings.remotePasswordConfigured ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start text-muted-foreground"
                onClick={() => onChange({ remoteAccessEnabled: false, remotePassword: null })}
              >
                Remove password and disable access
              </Button>
            ) : null}
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Blobs
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BLOB_STYLES.map((option) => {
                const selected = option.id === settings.blobStyle;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    aria-pressed={selected}
                    onClick={() => onChange({ blobStyle: option.id })}
                    className={cn(
                      'relative flex flex-col items-center gap-2.5 rounded-lg border bg-muted/50 px-3 py-3 text-center transition-colors hover:bg-muted',
                      selected && 'border-highlight'
                    )}
                  >
                    <div className="flex -space-x-1.5">
                      <Blob style={option.id} seed="settings one" size={30} interactive={false} />
                      <Blob style={option.id} seed="settings two" size={30} interactive={false} />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{option.name}</span>
                      <span className="text-[11px] text-muted-foreground">{option.hint}</span>
                    </div>
                    {selected && (
                      <Check className="absolute top-2 right-2 size-3.5 text-highlight" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Theme
            </h3>
            {THEME_GROUPS.map((group) => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <span className="text-[11px] text-muted-foreground">{group.name}</span>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.filter((theme) => theme.group === group.id).map((theme) => {
                    const selected = theme.id === settings.theme;
                    const { palette } = theme;
                    return (
                      <motion.button
                        key={theme.id}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        aria-pressed={selected}
                        onClick={() => onChange({ theme: theme.id })}
                        className={cn(
                          'relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-muted',
                          selected ? 'border-highlight' : 'border-border'
                        )}
                      >
                        {/* Swatch drawn in the theme's own colours: panel + bubble, with the highlight as a dot. */}
                        <span
                          className="relative flex size-8 flex-none items-end justify-end rounded-md border border-black/10 p-1"
                          style={{ background: palette.bg }}
                        >
                          <span
                            className="absolute inset-x-1 top-1 h-2.5 rounded-sm"
                            style={{ background: palette.elev }}
                          />
                          <span className="size-1.5 rounded-full" style={{ background: palette.highlight }} />
                        </span>
                        <span className="min-w-0 truncate font-medium">{theme.name}</span>
                        {selected && (
                          <Check className="absolute top-1.5 right-1.5 size-3 text-highlight" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
            </>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
