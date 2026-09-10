import type { BallMood, BallState, ChatMessage } from '../types';

/** Turns the coarse ball state plus the prompt kind and reasoning flag into a blob mood. */
export const moodFrom = (
  state: BallState,
  prompt: 'input' | 'question' | undefined,
  thinking: boolean
): BallMood => {
  if (state === 'error') return 'error';
  if (state === 'needs-input') return prompt === 'question' ? 'question' : 'input';
  if (state === 'active') return thinking ? 'thinking' : 'busy';
  return 'idle';
};

/** Collapses a mood back to the ball state, for surfaces that only understand the coarse state. */
export const stateFromMood = (mood: BallMood): BallState => {
  if (mood === 'error') return 'error';
  if (mood === 'input' || mood === 'question') return 'needs-input';
  if (mood === 'busy' || mood === 'thinking') return 'active';
  return 'idle';
};

/** True when the latest assistant turn is still streaming and no tool is running (so: reasoning). */
export const isThinkingMessages = (messages: ChatMessage[]): boolean => {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || last.completed) return false;
  const running = last.parts.some(
    (part) =>
      part.type === 'tool' && (part.call.status === 'running' || part.call.status === 'pending')
  );
  return !running;
};
