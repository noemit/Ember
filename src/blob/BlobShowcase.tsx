import * as React from 'react';
import { motion } from 'motion/react';
import { Shuffle } from 'lucide-react';
import Blob from './Blob';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { BallState, BlobStyle } from '../types';

const SAMPLE_WORDS = [
  'amber', 'ocean', 'quiet', 'pixel', 'storm', 'lunar', 'coral', 'birch', 'violet', 'onyx',
  'drift', 'maple', 'cobalt', 'pearl', 'raven', 'solar', 'mint', 'obsidian', 'cinder', 'willow',
  'azure', 'quartz', 'thorn', 'frost', 'sable', 'jade', 'saffron', 'nocturne', 'garnet', 'topaz',
];

const STATES: BallState[] = ['idle', 'active', 'needs-input', 'error'];

const randomSeed = (): string => {
  const first = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
  const second = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
  return `${first} ${second}`;
};

type Props = {
  open: boolean;
  blobStyle: BlobStyle;
  onOpenChange: (open: boolean) => void;
};

export default function BlobShowcase({ open, blobStyle, onOpenChange }: Props) {
  const [style, setStyle] = React.useState<BlobStyle>(blobStyle);
  const [seeds, setSeeds] = React.useState<string[]>(() => Array.from({ length: 30 }, randomSeed));

  React.useEffect(() => {
    if (open) setStyle(blobStyle);
  }, [open, blobStyle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] w-[min(880px,92vw)] overflow-hidden p-0 sm:max-w-[880px]">
        <DialogHeader className="flex-row items-center gap-3 border-b px-5 py-4 text-left">
          <div className="flex-1">
            <DialogTitle>Blob showcase</DialogTitle>
            <DialogDescription>Every session gets a blob seeded from its first prompt.</DialogDescription>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={style}
            onValueChange={(value) => value && setStyle(value as BlobStyle)}
          >
            <ToggleGroupItem value="grok">Grok</ToggleGroupItem>
            <ToggleGroupItem value="gem">Gem</ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeeds(Array.from({ length: 30 }, randomSeed))}
          >
            <Shuffle />
            Shuffle
          </Button>
        </DialogHeader>

        <div className="overflow-y-auto px-5 pb-5">
          <div className="mb-4 grid grid-cols-4 gap-2">
            {STATES.map((state) => (
              <div
                key={state}
                className="flex flex-col items-center gap-2 rounded-lg bg-muted/60 px-3 py-3"
              >
                <Blob style={style} seed={`state ${state}`} size={44} state={state} interactive={false} />
                <span className="text-[11px] text-muted-foreground">{state}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
            {seeds.map((seed, index) => (
              <motion.div
                key={`${seed}-${index}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26, delay: index * 0.012 }}
                className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/60 p-2.5"
              >
                <Blob style={style} seed={seed} size={64} state="idle" interactive={false} />
                <span className="text-center text-[10px] text-muted-foreground">{seed}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
