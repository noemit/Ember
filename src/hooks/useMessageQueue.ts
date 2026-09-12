import * as React from 'react';
import {
  enqueueMessage,
  removeQueuedMessage,
  reorderQueuedMessages,
  takeQueuedMessage,
  type ModelList,
  type PromptInput,
  type QueueMessageInput,
} from '../api';
import { modelRefKey } from '../types';
import type {
  MessageQueueSession,
  ModelOption,
  QueuedMessage,
  Session,
  SessionRef,
} from '../types';

/**
 * Keep local-only rows (still enqueuing, or failed) when a poll replaces the server queue snapshot
 * with fresh data, so an in-flight message doesn't vanish before its request settles.
 */
export const mergePolledQueues = (
  prev: Record<string, MessageQueueSession[]>,
  next: Record<string, MessageQueueSession[]>
): Record<string, MessageQueueSession[]> => {
  const merged: Record<string, MessageQueueSession[]> = {};
  const instanceIds = new Set([...Object.keys(prev), ...Object.keys(next)]);
  instanceIds.forEach((instanceId) => {
    const local = prev[instanceId] ?? [];
    const server = next[instanceId];
    if (!server) {
      merged[instanceId] = local;
      return;
    }
    const serverSessionIds = new Set(server.map((queue) => queue.sessionId));
    const result = server.map((queue) => {
      const locals = (local.find((entry) => entry.sessionId === queue.sessionId)?.items ?? []).filter(
        (item) => item.pending || item.error
      );
      if (locals.length === 0) return queue;
      const serverIds = new Set(queue.items.map((item) => item.id));
      return {
        ...queue,
        items: [...locals.filter((item) => !serverIds.has(item.id)), ...queue.items],
      };
    });
    local.forEach((queue) => {
      if (serverSessionIds.has(queue.sessionId)) return;
      const locals = queue.items.filter((item) => item.pending || item.error);
      if (locals.length > 0) result.push({ ...queue, items: locals });
    });
    merged[instanceId] = result;
  });
  return merged;
};

type Options = {
  selected: SessionRef | null;
  selectedSession: Session | null;
  selectedQueue: MessageQueueSession | null;
  modelsByInstance: Record<string, ModelList>;
  setQueuesByInstance: React.Dispatch<React.SetStateAction<Record<string, MessageQueueSession[]>>>;
  showActionError: (message: string | null, retry?: () => void) => void;
  /** Sends a prompt on the selected session; the queue hands items to this when "Send now" is used. */
  sendPrompt: (input: PromptInput) => Promise<boolean>;
};

/**
 * OpenChamber's server-owned follow-up queue for the selected session: add, send now, change
 * model, cancel, reorder. Every mutation is applied optimistically and the server's returned
 * queue snapshot replaces it; failures roll the local copy back and offer a retry.
 */
export const useMessageQueue = ({
  selected,
  selectedSession,
  selectedQueue,
  modelsByInstance,
  setQueuesByInstance,
  showActionError,
  sendPrompt,
}: Options) => {
  const applyQueueMutation = React.useCallback(
    (instanceId: string, mutation: { session: MessageQueueSession } | null) => {
      if (!mutation) return;
      setQueuesByInstance((prev) => {
        const existing = prev[instanceId] ?? [];
        const without = existing.filter((queue) => queue.sessionId !== mutation.session.sessionId);
        return {
          ...prev,
          [instanceId]: mutation.session.items.length || mutation.session.sendingId
            ? [mutation.session, ...without]
            : without,
        };
      });
    },
    [setQueuesByInstance]
  );

  /** Swap the selected session's queue for `queue` (used for optimistic edits and rollback). */
  const replaceSelectedQueue = (queue: MessageQueueSession, keepWhenEmpty = true) => {
    if (!selected) return;
    setQueuesByInstance((prev) => {
      const without = (prev[selected.instanceId] ?? []).filter(
        (entry) => entry.sessionId !== selected.sessionId
      );
      const keep = keepWhenEmpty || queue.items.length || queue.sendingId;
      return { ...prev, [selected.instanceId]: keep ? [queue, ...without] : without };
    });
  };

  const queuedMessageModel = (instanceId: string, item: QueuedMessage): ModelOption => {
    const modelList = modelsByInstance[instanceId];
    const found = modelList?.models.find(
      (candidate) =>
        candidate.providerID === item.sendConfig.providerID &&
        candidate.modelID === item.sendConfig.modelID
    );
    if (found) return found;
    return {
      providerID: item.sendConfig.providerID,
      modelID: item.sendConfig.modelID,
      label: `${item.sendConfig.providerID} / ${item.sendConfig.modelID}`,
      details: {
        name: item.sendConfig.modelID,
        providerName: item.sendConfig.providerID,
        reasoning: false,
        toolcall: false,
        attachment: item.attachments.length > 0,
        inputs: [],
        variants: item.sendConfig.variant ? [item.sendConfig.variant] : [],
      },
    };
  };

  const queuedMessageInput = (
    instanceId: string,
    item: QueuedMessage,
    model: ModelOption = queuedMessageModel(instanceId, item),
    variant: string | undefined = item.sendConfig.variant
  ): QueueMessageInput => ({
    text: item.text || item.content,
    model,
    mode: item.sendConfig.agent,
    variant,
    attachments: item.attachments.flatMap((file) =>
      file.dataUrl ? [{ filename: file.filename, mime: file.mimeType, url: file.dataUrl }] : []
    ),
    queuedContext: item.context,
    agentMention: item.agentMention,
  });

  const takeErrorMessage = (status: number): string =>
    status === 409
      ? 'That queued message is already being sent.'
      : status === 404
        ? 'That queued message is no longer available.'
        : 'Could not take the queued message.';

  // Optimistic queue rows live in the same state as server rows, marked `pending`/`error`. Their
  // original input is kept here so Retry can replay it after a failure.
  const pendingInputsRef = React.useRef(new Map<string, QueueMessageInput>());

  const updateSelectedQueue = (updater: (queue: MessageQueueSession | null) => MessageQueueSession | null) => {
    if (!selected) return;
    const { instanceId, sessionId } = selected;
    setQueuesByInstance((prev) => {
      const list = prev[instanceId] ?? [];
      const current = list.find((entry) => entry.sessionId === sessionId) ?? null;
      const next = updater(current);
      const without = list.filter((entry) => entry.sessionId !== sessionId);
      return { ...prev, [instanceId]: next ? [next, ...without] : without };
    });
  };

  const insertLocalItem = (item: QueuedMessage) => {
    if (!selected) return;
    updateSelectedQueue((queue) => {
      const base = queue ?? {
        sessionId: selected.sessionId,
        directory: selectedSession?.directory ?? '',
        items: [],
        sendingId: null,
      };
      return { ...base, items: [...base.items, item] };
    });
  };

  const patchLocalItem = (itemId: string, patch: Partial<QueuedMessage>) => {
    updateSelectedQueue((queue) =>
      queue
        ? { ...queue, items: queue.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }
        : queue
    );
  };

  const removeLocalItem = (itemId: string) => {
    updateSelectedQueue((queue) => {
      if (!queue) return queue;
      const items = queue.items.filter((item) => item.id !== itemId);
      return items.length > 0 || queue.sendingId ? { ...queue, items } : null;
    });
  };

  const enqueueLocal = async (
    localId: string,
    instanceId: string,
    sessionId: string,
    directory: string,
    input: QueueMessageInput
  ): Promise<boolean> => {
    try {
      const queued = await enqueueMessage(instanceId, sessionId, directory, input);
      if (!queued.ok || !queued.data) {
        if (queued.status === 404) {
          pendingInputsRef.current.delete(localId);
          removeLocalItem(localId);
          showActionError('This OpenChamber instance does not support message queueing yet.');
        } else {
          patchLocalItem(localId, { pending: false, error: 'Could not queue this message.' });
        }
        return false;
      }
      pendingInputsRef.current.delete(localId);
      removeLocalItem(localId);
      applyQueueMutation(instanceId, queued.data);
      return true;
    } catch (err) {
      console.error('Queue failed', err);
      patchLocalItem(localId, {
        pending: false,
        error: err instanceof Error ? err.message : 'Could not queue this message.',
      });
      return false;
    }
  };

  const queueMessage = async (input: PromptInput): Promise<boolean> => {
    if (!selected) return false;
    showActionError(null);
    const { instanceId, sessionId } = selected;
    const directory = selectedSession?.directory;
    if (!directory) {
      showActionError('Could not queue this message because the session folder is unknown.');
      return false;
    }
    const modelList = modelsByInstance[instanceId];
    const model = input.model ?? modelList?.models.find(
      (candidate) => modelRefKey(candidate) === modelList.defaultModelId
    );
    if (!model) {
      showActionError('Could not queue this message until the instance default model is known.');
      return false;
    }

    const localId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const queuedInput: QueueMessageInput = { ...input, model };
    pendingInputsRef.current.set(localId, queuedInput);
    insertLocalItem({
      id: localId,
      createdAt: Date.now(),
      text: input.text,
      content: input.text,
      attachments: (input.attachments ?? []).map((file) => ({
        filename: file.filename,
        mimeType: file.mime,
        dataUrl: file.url,
      })),
      context: input.queuedContext ?? [],
      sendConfig: {
        providerID: model.providerID,
        modelID: model.modelID,
        agent: input.mode,
        variant: input.variant,
      },
      agentMention: input.agentMention,
      pending: true,
    });
    return enqueueLocal(localId, instanceId, sessionId, directory, queuedInput);
  };

  const retryQueued = async (itemId: string): Promise<boolean> => {
    if (!selected) return false;
    const input = pendingInputsRef.current.get(itemId);
    const directory = selectedSession?.directory;
    if (!input || !directory) return false;
    showActionError(null);
    patchLocalItem(itemId, { pending: true, error: undefined });
    return enqueueLocal(itemId, selected.instanceId, selected.sessionId, directory, input);
  };

  const discardQueued = (itemId: string): boolean => {
    if (!pendingInputsRef.current.has(itemId)) return false;
    pendingInputsRef.current.delete(itemId);
    removeLocalItem(itemId);
    return true;
  };

  const sendQueuedMessage = async (itemId: string): Promise<boolean> => {
    if (!selected) return false;
    showActionError(null);
    const { instanceId, sessionId } = selected;
    const directory = selectedSession?.directory;
    if (!directory) {
      showActionError('Could not send this queued message because the session folder is unknown.');
      return false;
    }

    let input: QueueMessageInput | null = null;
    try {
      const taken = await takeQueuedMessage(instanceId, sessionId, itemId);
      if (!taken.ok || !taken.data) {
        showActionError(
          takeErrorMessage(taken.status),
          taken.status === 409 || taken.status === 404 ? undefined : () => void sendQueuedMessage(itemId)
        );
        return false;
      }
      applyQueueMutation(instanceId, taken.data);
      input = queuedMessageInput(instanceId, taken.data.item);
      if (await sendPrompt(input)) return true;

      // Taken but not sent: put it back so nothing is lost.
      const requeued = await enqueueMessage(instanceId, sessionId, directory, input);
      if (requeued.ok && requeued.data) applyQueueMutation(instanceId, requeued.data);
      const retryId = requeued.data?.itemId;
      const retryInput = input;
      showActionError(
        requeued.ok
          ? 'Could not send the queued message now; it was returned to the queue.'
          : 'Could not send the queued message now or return it to the queue.',
        retryId ? () => void sendQueuedMessage(retryId) : () => void sendPrompt(retryInput)
      );
      return false;
    } catch (err) {
      console.error('Send queued message failed', err);
      const retryInput = input;
      showActionError(
        err instanceof Error ? err.message : 'Could not send the queued message now.',
        retryInput ? () => void sendPrompt(retryInput) : () => void sendQueuedMessage(itemId)
      );
      return false;
    }
  };

  const changeQueuedModel = async (itemId: string, nextModel: ModelOption): Promise<boolean> => {
    if (!selected || !selectedQueue) return false;
    showActionError(null);
    const { instanceId, sessionId } = selected;
    const directory = selectedSession?.directory;
    const originalIndex = selectedQueue.items.findIndex((item) => item.id === itemId);
    if (!directory || originalIndex < 0) return false;
    const queuedItem = selectedQueue.items[originalIndex];
    if (
      queuedItem.sendConfig.providerID === nextModel.providerID &&
      queuedItem.sendConfig.modelID === nextModel.modelID
    ) return true;
    if (selectedQueue.sendingId) {
      showActionError('Wait until the current queued message finishes sending before changing models.');
      return false;
    }

    // The server has no "edit" endpoint: take the item out, re-enqueue with the new model, and
    // move it back to where it was.
    let takenItem: QueuedMessage | null = null;
    const restore = async () => {
      if (!takenItem) return false;
      const restored = await enqueueMessage(
        instanceId,
        sessionId,
        directory,
        queuedMessageInput(instanceId, takenItem)
      );
      if (restored.ok && restored.data) applyQueueMutation(instanceId, restored.data);
      return restored.ok;
    };

    try {
      const taken = await takeQueuedMessage(instanceId, sessionId, itemId);
      if (!taken.ok || !taken.data) {
        showActionError(takeErrorMessage(taken.status));
        return false;
      }
      applyQueueMutation(instanceId, taken.data);
      takenItem = taken.data.item;

      const nextVariant =
        takenItem.sendConfig.variant && nextModel.details.variants.includes(takenItem.sendConfig.variant)
          ? takenItem.sendConfig.variant
          : undefined;
      const changed = await enqueueMessage(
        instanceId,
        sessionId,
        directory,
        queuedMessageInput(instanceId, takenItem, nextModel, nextVariant)
      );
      if (!changed.ok || !changed.data) {
        const restored = await restore();
        showActionError(
          restored
            ? 'Could not change the queued message model; it was returned to the queue.'
            : 'Could not change the queued message model or return it to the queue.'
        );
        return false;
      }
      applyQueueMutation(instanceId, changed.data);

      const newItemId =
        changed.data.itemId ?? changed.data.session.items[changed.data.session.items.length - 1]?.id;
      if (newItemId) {
        const currentIds = changed.data.session.items.map((item) => item.id);
        const orderedIds = currentIds.filter((id) => id !== newItemId);
        orderedIds.splice(Math.min(originalIndex, orderedIds.length), 0, newItemId);
        if (orderedIds.join('\u0000') !== currentIds.join('\u0000')) {
          const reordered = await reorderQueuedMessages(instanceId, sessionId, orderedIds);
          if (reordered.ok && reordered.data) applyQueueMutation(instanceId, reordered.data);
          else showActionError('Model changed, but the queued message moved to the end.');
        }
      }
      return true;
    } catch (err) {
      console.error('Change queued message model failed', err);
      try {
        await restore();
      } catch (restoreError) {
        console.error('Could not restore queued message', restoreError);
      }
      showActionError(
        err instanceof Error ? err.message : 'Could not change the queued message model.',
        takenItem ? undefined : () => void changeQueuedModel(itemId, nextModel)
      );
      return false;
    }
  };

  const removeQueued = async (itemId: string): Promise<boolean> => {
    if (!selected) return false;
    showActionError(null);
    const previousQueue = selectedQueue;
    if (previousQueue) {
      replaceSelectedQueue(
        { ...previousQueue, items: previousQueue.items.filter((item) => item.id !== itemId) },
        false
      );
    }
    const rollback = () => previousQueue && replaceSelectedQueue(previousQueue);

    try {
      const removed = await removeQueuedMessage(selected.instanceId, selected.sessionId, itemId);
      if (!removed.ok || !removed.data) {
        rollback();
        showActionError(
          removed.status === 409
            ? 'That queued message is already being sent.'
            : 'Could not cancel the queued message.',
          removed.status === 409 ? undefined : () => void removeQueued(itemId)
        );
        return false;
      }
      applyQueueMutation(selected.instanceId, removed.data);
      return true;
    } catch (err) {
      console.error('Cancel queued message failed', err);
      rollback();
      showActionError(
        err instanceof Error ? err.message : 'Could not cancel the queued message.',
        () => void removeQueued(itemId)
      );
      return false;
    }
  };

  const moveQueued = async (itemId: string, direction: -1 | 1): Promise<boolean> => {
    if (!selected || !selectedQueue || selectedQueue.sendingId) return false;
    showActionError(null);
    const index = selectedQueue.items.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selectedQueue.items.length) return false;

    const previousQueue = selectedQueue;
    const items = [...selectedQueue.items];
    [items[index], items[target]] = [items[target], items[index]];
    replaceSelectedQueue({ ...selectedQueue, items });
    const rollback = () => replaceSelectedQueue(previousQueue);

    try {
      const reordered = await reorderQueuedMessages(
        selected.instanceId,
        selected.sessionId,
        items.map((item) => item.id)
      );
      if (!reordered.ok || !reordered.data) {
        rollback();
        showActionError('Could not reorder the queued messages.', () => void moveQueued(itemId, direction));
        return false;
      }
      applyQueueMutation(selected.instanceId, reordered.data);
      return true;
    } catch (err) {
      console.error('Reorder queued messages failed', err);
      rollback();
      showActionError(
        err instanceof Error ? err.message : 'Could not reorder the queued messages.',
        () => void moveQueued(itemId, direction)
      );
      return false;
    }
  };

  return {
    applyQueueMutation,
    queueMessage,
    sendQueuedMessage,
    changeQueuedModel,
    removeQueued,
    moveQueued,
    retryQueued,
    discardQueued,
  };
};
