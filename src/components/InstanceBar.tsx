import * as React from 'react';
import { ChevronDown, Menu, RefreshCw, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Instance, InstanceStatus } from '../types';

type Props = {
  instances: Instance[];
  hidden: Set<string>;
  refreshing: boolean;
  onToggle: (instanceId: string) => void;
  onToggleNavigation: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
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

export default function InstanceBar({
  instances,
  hidden,
  refreshing,
  onToggle,
  onToggleNavigation,
  onRefresh,
  onOpenSettings,
}: Props) {
  const connected = instances.filter((instance) => instance.attachable).length;

  return (
    <div
      className={cn(
        'safe-top-bar drag-region flex flex-none items-center gap-2 border-b bg-card pr-[max(0.75rem,env(safe-area-inset-right))]',
        isMac ? 'pl-3 md:pl-[76px]' : 'pl-[max(0.75rem,env(safe-area-inset-left))]'
      )}
    >
      <button
        type="button"
        onClick={onToggleNavigation}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        aria-label="Toggle sessions sidebar"
      >
        <Menu className="size-4" />
      </button>
      <span className="mr-1 text-[13px] font-semibold tracking-wide text-highlight">Ember</span>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 text-[12px] transition-colors hover:bg-muted"
            aria-label="Instances"
          >
            <span className={cn('size-1.5 rounded-full', connected > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/50')} />
            <span className="tabular-nums">
              {instances.length === 0 ? 'No instances' : `${connected}/${instances.length} instances`}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[min(320px,calc(100vw-1rem))]">
          {instances.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-muted-foreground">
              No instances in ~/.config/openchamber/settings.json
            </div>
          ) : (
            <>
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Connected instances show their sessions; untick one to hide it.
              </DropdownMenuLabel>
              {instances.map((instance) => (
                <DropdownMenuCheckboxItem
                  key={instance.id}
                  checked={instance.attachable && !hidden.has(instance.id)}
                  disabled={!instance.attachable}
                  // Keep the menu open so several can be toggled in a row.
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => onToggle(instance.id)}
                  className="items-start py-1.5"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('size-1.5 flex-none rounded-full', statusDot[instance.status])} />
                      <span className="truncate">{instance.label}</span>
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {kindLabel[instance.kind]}
                      {instance.url ? ` · ${instance.url}` : ''}
                      {' · '}
                      {statusLabel[instance.status]}
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onRefresh();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
            {refreshing ? 'Reprobing…' : 'Reprobe instances'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenSettings}>
            <Settings />
            Instance settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
