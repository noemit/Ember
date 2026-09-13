import { previewOf } from '../api';
import { isThinkingMessages } from '../blob/mood';
import type { ChatMessage } from '../types';

/**
 * Compact rail metadata derived from a transcript (or a bounded tail of one). Kept independent of
 * the full message cache so a session's preview, failure mood and thinking mood survive eviction.
 */
export type SessionMessageSummary = {
  preview: string;
  failed: boolean;
  thinking: boolean;
  /** `session.updated` the summary was derived from, used to skip redundant preview loads. */
  version?: number;
};

/**
 * Derives a summary from fetched messages. A partial tail that carries no textual turn yet must not
 * erase a preview established from an older, fuller fetch; a complete response is authoritative and
 * may clear it.
 */
export function summarizeMessages(
  messages: readonly ChatMessage[],
  options: { previous?: SessionMessageSummary; complete: boolean; version?: number }
): SessionMessageSummary {
  const preview = previewOf([...messages]);
  const failed = isFailedTail(messages);
  return {
    preview: preview || (options.complete ? '' : (options.previous?.preview ?? '')),
    failed,
    thinking: isThinkingMessages([...messages]),
    version: options.version,
  };
}

/** True when the latest turn is an assistant failure the user did not abort. */
const isFailedTail = (messages: readonly ChatMessage[]): boolean => {
  const last = messages[messages.length - 1];
  return Boolean(last && last.role === 'assistant' && last.error && !last.aborted);
};
