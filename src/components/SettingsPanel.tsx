import * as React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import Blob from '../blob/Blob';
import { THEMES } from '../themes';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BlobStyle, EmberSettings } from '../types';

type Props = {
  open: boolean;
  settings: EmberSettings;
  onChange: (patch: Partial<EmberSettings>) => void;
  onOpenChange: (open: boolean) => void;
};

const BLOB_STYLES: Array<{ id: BlobStyle; name: string; hint: string }> = [
  { id: 'grok', name: 'Grok', hint: 'Flat, matte, soft shapes' },
  { id: 'gem', name: 'Gem', hint: 'Faceted gemstones' },
];

export default function SettingsPanel({ open, settings, onChange, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[460px] gap-0 p-0 sm:max-w-[460px]">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Applies to this window across every instance.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-5 py-5">
          <section className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Blobs
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {BLOB_STYLES.map((option) => {
                const selected = option.id === settings.blobStyle;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onChange({ blobStyle: option.id })}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-3 text-left transition-colors hover:bg-muted',
                      selected && 'border-primary'
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
                      <Check className="absolute top-2 right-2 size-3.5 text-primary" />
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
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((theme) => {
                const selected = theme.id === settings.theme;
                return (
                  <motion.button
                    key={theme.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onChange({ theme: theme.id })}
                    className={cn(
                      'relative flex flex-col items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-left transition-colors hover:bg-muted',
                      selected && 'border-primary'
                    )}
                  >
                    <span className="font-medium">{theme.name}</span>
                    <span className="flex gap-1">
                      {[theme.palette.bg, theme.palette.panel, theme.palette.accent].map((color) => (
                        <span
                          key={color}
                          className="size-3 rounded-[3px] border border-black/10"
                          style={{ background: color }}
                        />
                      ))}
                    </span>
                    {selected && (
                      <Check className="absolute top-2 right-2 size-3.5 text-primary" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
