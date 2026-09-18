import * as React from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { observationId, rateModel, useModelStats } from '@/lib/modelStats';
import { parseSessionKey } from '@/lib/workspace';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../types';

export default function ModelRating({ message, sessionKey }: { message: ChatMessage; sessionKey: string }) {
  const { records } = useModelStats();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = parseSessionKey(sessionKey);
  const id = ref ? observationId(ref.instanceId, ref.sessionId, message.id) : '';
  const record = records.find((entry) => entry.id === id);
  if (!record || message.aborted || message.error) return null;
  return <span className="flex items-center gap-0.5">
    {(['helpful', 'unhelpful'] as const).map((rating) => {
      const selected = record.rating === rating;
      const Icon = rating === 'helpful' ? ThumbsUp : ThumbsDown;
      const label = rating === 'helpful' ? 'Helpful' : 'Not helpful';
      return <Tooltip key={rating}><TooltipTrigger asChild>
        <button type="button" disabled={busy} aria-label={`Mark response ${label.toLowerCase()}`} aria-pressed={selected}
          className={cn('rounded p-1 hover:bg-muted focus-visible:opacity-100 sm:opacity-0 sm:group-hover/message:opacity-100', selected && 'text-highlight sm:opacity-100')}
          onClick={() => {
            setBusy(true);
            void rateModel(id, selected ? null : rating).then(() => setError(null)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not save rating')).finally(() => setBusy(false));
          }}><Icon className="size-3" /></button>
      </TooltipTrigger><TooltipContent>{selected ? 'Clear rating' : label} · saved only in Ember</TooltipContent></Tooltip>;
    })}
    {error ? <span role="alert" className="text-destructive">{error}</span> : null}
  </span>;
}
