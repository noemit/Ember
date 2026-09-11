import ThinkingIcon from './ThinkingIcon';
import ToolCallsIcon from './ToolCallsIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReasoningDisplay } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideToolCalls: boolean;
  reasoningDisplay: ReasoningDisplay;
  onHideToolCallsChange: (hide: boolean) => void;
  onReasoningDisplayChange: (mode: ReasoningDisplay) => void;
};

const REASONING_LABELS: Record<ReasoningDisplay, string> = {
  expanded: 'Expanded',
  collapsed: 'Collapsed',
  hidden: 'Hidden',
};

/** Global display preferences for the transcript. */
export default function ViewOptionsDialog({
  open,
  onOpenChange,
  hideToolCalls,
  reasoningDisplay,
  onHideToolCallsChange,
  onReasoningDisplayChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>View options</DialogTitle>
          <DialogDescription>How the transcript renders, across every session.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <ToolCallsIcon hidden={hideToolCalls} className="mt-0.5 size-4 flex-none text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">Show tool calls</span>
                <span className="text-[11px] text-muted-foreground">
                  Expandable rows for the agent's tool use.
                </span>
              </div>
            </div>
            <Switch
              checked={!hideToolCalls}
              onCheckedChange={(checked) => onHideToolCallsChange(!checked)}
              aria-label="Show tool calls"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <ThinkingIcon mode={reasoningDisplay} className="mt-0.5 size-4 flex-none text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">Thinking</span>
                <span className="text-[11px] text-muted-foreground">
                  How the agent's reasoning is shown.
                </span>
              </div>
            </div>
            <Select
              value={reasoningDisplay}
              onValueChange={(value) => onReasoningDisplayChange(value as ReasoningDisplay)}
            >
              <SelectTrigger size="sm" className="w-[130px] text-xs" aria-label="Thinking display">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REASONING_LABELS) as ReasoningDisplay[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {REASONING_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
