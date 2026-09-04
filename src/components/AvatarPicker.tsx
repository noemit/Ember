import * as React from 'react';
import Blob from '../blob/Blob';
import { blobColor } from '../blob/color';
import { GLYPH_COLORS } from '../blob/contrast';
import { GLYPHS } from '../blob/glyphs';
import { GROK_COLORS, GROK_SHAPES } from '../blob/grok';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import type { AvatarIdentity, AvatarOverride, BlobStyle } from '../types';

type Scope = { key: string; label: string };

type Props = {
  open: boolean;
  title: string;
  style: BlobStyle;
  identity: AvatarIdentity;
  scopes: Scope[];
  overrides: Record<string, AvatarOverride>;
  onSave: (scopeKey: string, override: AvatarOverride | null) => void;
  onOpenChange: (open: boolean) => void;
};

const COLOR_COUNT = GLYPH_COLORS.length;

export default function AvatarPicker({
  open,
  title,
  style,
  identity,
  scopes,
  overrides,
  onSave,
  onOpenChange,
}: Props) {
  const [scopeKey, setScopeKey] = React.useState(scopes[0]?.key ?? '');
  const [draft, setDraft] = React.useState<AvatarOverride>({});
  const shapes = style === 'glyph'
    ? GLYPHS.map((glyph) => glyph.name)
    : style === 'grok'
      ? GROK_SHAPES.map((shape) => shape.name)
      : [];

  const firstScopeKey = scopes[0]?.key ?? '';
  const scopeSignature = scopes.map((scope) => scope.key).join('\u0000');

  React.useEffect(() => {
    if (open) setScopeKey(firstScopeKey);
  }, [open, identity.sessionKey, firstScopeKey, scopeSignature]);

  React.useEffect(() => {
    if (open && scopeKey) setDraft({ ...(overrides[scopeKey] ?? {}) });
  }, [open, scopeKey, overrides]);

  const previewIdentity = (patch: AvatarOverride): AvatarIdentity => ({
    ...identity,
    ...draft,
    ...patch,
  });
  const hasOverride = draft.colorIndex !== undefined || draft.shapeName !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[500px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[86vh] sm:max-w-[500px]">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>Customize appearance</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 touch-pan-y flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium">Apply to</span>
            <Select value={scopeKey} onValueChange={setScopeKey}>
              <SelectTrigger size="sm" className="w-[min(220px,58vw)]" aria-label="Appearance scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((scope) => (
                  <SelectItem key={scope.key} value={scope.key}>{scope.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
            <Blob
              style={style}
              seed={identity.sessionKey}
              identity={previewIdentity({})}
              size={56}
              interactive={false}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">Preview</span>
              <span className="text-xs text-muted-foreground">
                Color identifies the project; shape identifies the task or session.
              </span>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <span className="text-xs font-medium">Color</span>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: COLOR_COUNT }, (_, colorIndex) => {
                const selected = draft.colorIndex === colorIndex;
                const color = blobColor(style, previewIdentity({ colorIndex }));
                return (
                  <button
                    key={colorIndex}
                    type="button"
                    title={`Color ${colorIndex + 1}`}
                    aria-label={`Color ${colorIndex + 1}`}
                    aria-pressed={selected}
                    onClick={() => setDraft((prev) => ({ ...prev, colorIndex }))}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg border transition-colors hover:bg-muted',
                      selected && 'border-highlight ring-2 ring-highlight/30'
                    )}
                  >
                    <span className="size-5 rounded-full" style={{ backgroundColor: color }} />
                  </button>
                );
              })}
            </div>
          </section>

          {shapes.length > 0 ? (
            <section className="flex flex-col gap-2">
              <span className="text-xs font-medium">Shape</span>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
                {shapes.map((shapeName) => {
                  const selected = draft.shapeName === shapeName;
                  return (
                    <button
                      key={shapeName}
                      type="button"
                      title={shapeName}
                      aria-label={shapeName}
                      aria-pressed={selected}
                      onClick={() => setDraft((prev) => ({ ...prev, shapeName }))}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-lg border transition-colors hover:bg-muted',
                        selected && 'border-highlight bg-muted ring-2 ring-highlight/30'
                      )}
                    >
                      <Blob
                        style={style}
                        seed={identity.sessionKey}
                        identity={previewIdentity({ shapeName })}
                        size={30}
                        interactive={false}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button
            variant="outline"
            disabled={!overrides[scopeKey]}
            onClick={() => {
              onSave(scopeKey, null);
              onOpenChange(false);
            }}
          >
            Reset
          </Button>
          <Button
            disabled={!scopeKey || !hasOverride}
            onClick={() => {
              onSave(scopeKey, draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
