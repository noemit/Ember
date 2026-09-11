import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = {
  /** Tokens currently in context (the last assistant turn's prompt + output). */
  used: number;
  /** The selected model's context window. */
  limit: number;
  compacting: boolean;
  onCompact: () => void;
};

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const formatTokens = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return `${count}`;
};

/**
 * The composer's context-usage ring. Hovering explains the count; clicking asks the instance to
 * compact the session (`POST /api/session/:id/compact`), which summarizes older turns and keeps a
 * recent tail per the instance's `compaction` config.
 */
export default function ContextMeter({ used, limit, compacting, onCompact }: Props) {
  const percent = limit > 0 ? Math.min(999, (used / limit) * 100) : 0;
  const tone = percent >= 90 ? 'text-destructive' : percent >= 70 ? 'text-warning' : 'text-muted-foreground';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onCompact}
          disabled={compacting}
          aria-label={`Context ${Math.round(percent)}% used. Click to compact.`}
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-50',
            tone
          )}
        >
          {compacting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
              <circle cx="9" cy="9" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <circle
                cx="9"
                cy="9"
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${(percent / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform="rotate(-90 9 9)"
              />
            </svg>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {compacting
          ? 'Compacting context…'
          : `Context ${Math.round(percent)}% used · ${formatTokens(used)} / ${formatTokens(limit)} — click to compact`}
      </TooltipContent>
    </Tooltip>
  );
}
