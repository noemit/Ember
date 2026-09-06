import * as React from 'react';
import { ChevronDown, ChevronUp, ListOrdered, Loader2 } from 'lucide-react';
import { modelRefKey } from '../types';
import { Button } from '@/components/ui/button';
import { ModelPickerFallback } from './ModelPickerFallback';
import type { MessageQueueSession, ModelOption, QueuedMessage } from '../types';

const ModelPicker = React.lazy(() => import('./ModelPicker'));

type Props = {
  queue: MessageQueueSession | null;
  models: ModelOption[];
  recentModels: string[];
  defaultModelId: string | null;
  onSendQueued: (itemId: string) => Promise<boolean>;
  onQueuedModelChange: (itemId: string, model: ModelOption) => Promise<boolean>;
  onMoveQueued: (itemId: string, direction: -1 | 1) => Promise<boolean>;
  onRemoveQueued: (itemId: string) => Promise<boolean>;
};

/**
 * The follow-up queue above the composer. Key it by session so per-item UI state (the open
 * model picker, the in-flight lock) resets when the user switches chats.
 */
export default function QueuedMessageList({
  queue,
  models,
  recentModels,
  defaultModelId,
  onSendQueued,
  onQueuedModelChange,
  onMoveQueued,
  onRemoveQueued,
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

  if (queueItems.length === 0) return null;

  return (
    <>
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
    </>
  );
}
