import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, Loader2, Minus, NotebookPen, Pencil, Play } from 'lucide-react';
import { modelRefKey } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ModelPickerFallback } from './ModelPickerFallback';
import { cn } from '@/lib/utils';
import { springTransition } from '@/lib/animation';
import type { MessageQueueSession, ModelOption, QueuedMessage } from '../types';

const ModelPicker = React.lazy(() => import('./ModelPicker'));

type Props = {
  open: boolean;
  queue: MessageQueueSession | null;
  models: ModelOption[];
  recentModels: string[];
  defaultModelId: string | null;
  onOpenChange: (open: boolean) => void;
  onSendQueued: (itemId: string) => Promise<boolean>;
  onQueuedModelChange: (itemId: string, model: ModelOption, variant?: string) => Promise<boolean>;
  onMoveQueued: (itemId: string, direction: -1 | 1) => Promise<boolean>;
  onRemoveQueued: (itemId: string) => Promise<boolean>;
  onParkQueued: (itemId: string) => Promise<boolean>;
  onEditQueued: (itemId: string) => Promise<boolean>;
  onRetryQueued: (itemId: string) => Promise<boolean>;
  onDiscardQueued: (itemId: string) => boolean;
};

/**
 * The follow-up queue above the composer. Key it by session so per-item UI state (the open
 * model picker, the in-flight lock) resets when the user switches chats.
 */
export default function QueuedMessageList({
  open,
  queue,
  models,
  recentModels,
  defaultModelId,
  onOpenChange,
  onSendQueued,
  onQueuedModelChange,
  onMoveQueued,
  onRemoveQueued,
  onParkQueued,
  onEditQueued,
  onRetryQueued,
  onDiscardQueued,
}: Props) {
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

  const queueItems = queue?.items ?? [];
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

  if (queueItems.length === 0 || !open) return null;

  const rail = (
    <span className="relative inline-flex">
      <Play className="size-3.5 fill-current text-highlight" />
      <span className="absolute -right-1.5 -top-1.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-highlight px-0.5 text-[9px] font-semibold leading-none text-highlight-foreground">
        {queueItems.length}
      </span>
    </span>
  );

  return (
    <>
      <Card className="group/card relative bg-background/80 shadow-sm">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={() => onOpenChange(false)}
          aria-label="Minimize queued messages"
          title="Minimize queued messages"
          className="absolute -top-2 -right-2 z-10 size-5 rounded-full bg-background text-muted-foreground opacity-60 shadow-xs transition-opacity hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
        >
          <Minus className="size-3" />
        </Button>
        <CardContent className="flex items-stretch gap-1.5 p-2 text-[11.5px]">
          <div className="flex flex-none items-center self-center px-1.5 py-1 text-muted-foreground">{rail}</div>
          <ol className="flex min-w-0 max-h-28 flex-1 flex-col gap-1 overflow-y-auto">
            <AnimatePresence initial={false} mode="popLayout">
              {queueItems.map((item, index) => {
                const sendingItem = queue?.sendingId === item.id;
                const pending = Boolean(item.pending);
                const failed = Boolean(item.error);
                const busy = sendingItem || busyQueueItemId === item.id || pending;
                const reorderLocked = Boolean(queue?.sendingId) || busyQueueItemId !== null;
                const preview =
                  item.text.trim() ||
                  item.content.trim() ||
                  `${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`;
                return (
                  <motion.li
                    key={item.id}
                    layout="position"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={springTransition}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5',
                      failed ? 'bg-destructive/10' : 'bg-muted/50'
                    )}
                  >
                    {busy ? <Loader2 className="size-3 flex-none animate-spin text-highlight" /> : null}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate" title={preview}>
                        {preview}
                      </span>
                      {failed ? (
                        <span className="mt-0.5 block truncate text-[10.5px] text-destructive" title={item.error}>
                          {item.error}
                        </span>
                      ) : (
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
                      )}
                    </div>
                    {item.attachments.length ? (
                      <Badge variant="secondary" className="flex-none px-1 py-0 text-[10px]">
                        {item.attachments.length} file{item.attachments.length === 1 ? '' : 's'}
                      </Badge>
                    ) : null}
                    <div className="flex flex-none items-center gap-0.5">
                      {failed ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void runQueueAction(item.id, () => onRetryQueued(item.id))}
                            aria-label={`Retry queueing this message: ${preview.slice(0, 60)}`}
                            title="Retry queueing this message"
                            className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Retry
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => onDiscardQueued(item.id)}
                            aria-label={`Discard this message: ${preview.slice(0, 60)}`}
                            title="Discard this message"
                            className="px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : pending ? null : (
                        <>
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
                            disabled={busy || !(item.text.trim() || item.content.trim())}
                            onClick={() => void runQueueAction(item.id, () => onParkQueued(item.id))}
                            aria-label={`Park queued message as a note: ${preview.slice(0, 60)}`}
                            title="Park it as a note"
                            className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <NotebookPen />
                            Park it
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
                            disabled={busy || !(item.text.trim() || item.content.trim())}
                            onClick={() => void runQueueAction(item.id, () => onEditQueued(item.id))}
                            aria-label={`Edit queued message: ${preview.slice(0, 60)}`}
                            title="Edit in composer"
                            className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Pencil />
                            Edit
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
                        </>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        </CardContent>
      </Card>
      {queueModelPickerItem ? (
        <React.Suspense fallback={<ModelPickerFallback />}>
          <ModelPicker
            open
            models={models}
            recentModels={recentModels}
            value={modelRefKey(queueModelPickerItem.sendConfig)}
            variant={queueModelPickerItem.sendConfig.variant ?? ''}
            defaultModelId={defaultModelId}
            collapseProviders
            onSelect={(next, nextVariant) => {
              const nextModel = models.find((entry) => modelRefKey(entry) === next);
              const itemId = queueModelPickerItem.id;
              setQueueModelPickerItemId(null);
              if (nextModel) {
                void runQueueAction(itemId, () => onQueuedModelChange(itemId, nextModel, nextVariant || undefined));
              }
            }}
            onOpenChange={(open) => {
              if (!open) setQueueModelPickerItemId(null);
            }}
          />
        </React.Suspense>
      ) : null}
    </>
  );
}
