import * as React from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Instance, InstanceStatus } from '../types';

type Props = {
  instances: Instance[];
  hidden: Set<string>;
  refreshing: boolean;
  onToggle: (instanceId: string) => void;
  onRefresh: () => void;
};

const kindLabel: Record<Instance['kind'], string> = {
  local: 'local',
  remote: 'remote',
  ssh: 'ssh',
  relay: 'private relay',
};

const statusLabel: Record<InstanceStatus, string> = {
  ready: 'connected',
  unreachable: 'not connected — open it in OpenChamber',
  unsupported: 'needs OpenChamber',
};

const statusDot: Record<InstanceStatus, string> = {
  ready: 'bg-emerald-400',
  unreachable: 'bg-muted-foreground/50',
  unsupported: 'bg-muted-foreground/30',
};

// macOS traffic lights sit inside the inset title bar; leave room for them.
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

export default function InstanceBar({ instances, hidden, refreshing, onToggle, onRefresh }: Props) {
  const connected = instances.filter((instance) => instance.attachable).length;

  return (
    <div
      className={cn(
        'drag-region flex h-11 flex-none items-center gap-2 border-b bg-card pr-3',
        isMac ? 'pl-[76px]' : 'pl-3'
      )}
    >
      <span className="mr-1 text-[13px] font-semibold tracking-wide text-primary">Ember</span>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {instances.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">
            No instances in ~/.config/openchamber/settings.json
          </span>
        ) : null}

        {instances.map((instance) => {
          const off = hidden.has(instance.id);
          return (
            <Tooltip key={instance.id}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  layout
                  whileTap={{ scale: 0.95 }}
                  disabled={!instance.attachable}
                  onClick={() => onToggle(instance.id)}
                  className={cn(
                    'flex h-7 flex-none items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors',
                    instance.attachable
                      ? 'bg-muted/60 hover:bg-muted'
                      : 'cursor-default text-muted-foreground opacity-60',
                    off && 'border-dashed text-muted-foreground line-through opacity-70'
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', statusDot[instance.status])} />
                  <span className="max-w-[160px] truncate">{instance.label}</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[320px]">
                <div className="font-medium">{instance.label}</div>
                <div className="opacity-80">
                  {kindLabel[instance.kind]}
                  {instance.url ? ` · ${instance.url}` : ''}
                </div>
                <div className="opacity-80">{statusLabel[instance.status]}</div>
                {instance.attachable ? (
                  <div className="mt-1 opacity-60">
                    {off ? 'Click to show its sessions' : 'Click to hide its sessions'}
                  </div>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <span className="text-[11px] text-muted-foreground">
        {connected}/{instances.length} connected
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh instances">
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Re-probe instances</TooltipContent>
      </Tooltip>
    </div>
  );
}
