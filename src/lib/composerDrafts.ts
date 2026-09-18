import type { ChatMessage, FileAttachment, StoredComposerDraft } from '../types';

export type ComposerState = {
  text: string;
  modelId: string;
  variant: string;
  attachments: FileAttachment[];
  replyContext: ChatMessage | null;
};

export type DraftChanges = Record<string, StoredComposerDraft | null>;

export const mergeDraftChanges = (
  current: Record<string, StoredComposerDraft>,
  changes: DraftChanges
): Record<string, StoredComposerDraft> => {
  const next = { ...current };
  for (const [key, draft] of Object.entries(changes)) {
    if (!key || key.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (draft === null) delete next[key];
    else next[key] = draft;
  }
  return next;
};

export const composerMemory = new Map<string, ComposerState>();
export const removedDrafts = new Set<string>();
