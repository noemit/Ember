import * as React from 'react';
import { Check, ChevronRight, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_MODEL, modelRefKey } from '../types';
import type { ModelOption } from '../types';

type Props = {
  open: boolean;
  models: ModelOption[];
  /** `provider/model` keys the instance used most recently, newest first. */
  recentModels: string[];
  /** Selected key, or DEFAULT_MODEL to let the instance decide. */
  value: string;
  collapseProviders?: boolean;
  onSelect: (key: string) => void;
  onOpenChange: (open: boolean) => void;
};

type Group = { id: string; title: string; models: ModelOption[] };

const formatTokens = (value: number): string =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M` : `${Math.round(value / 1000)}k`;

const formatCost = (value: number): string => (value === 0 ? 'free' : `$${value < 1 ? value.toFixed(2) : value.toFixed(value % 1 ? 2 : 0)}`);

const matches = (model: ModelOption, needle: string): boolean =>
  [model.details.name, model.modelID, model.details.providerName, model.providerID, model.details.family]
    .some((field) => field?.toLowerCase().includes(needle));

const Row = React.memo(function Row({
  model,
  selected,
  active,
  onHover,
  onPick,
}: {
  model: ModelOption;
  selected: boolean;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-active={active}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] outline-none',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span className="min-w-0 flex-1 truncate">{model.details.name}</span>
      {model.details.status && model.details.status !== 'active' ? (
        <span className="flex-none rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {model.details.status}
        </span>
      ) : null}
      {selected ? <Check className="size-3.5 flex-none text-highlight" /> : null}
    </button>
  );
});

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 text-[12px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right tabular-nums">{value}</span>
  </div>
);

const Details = ({ model }: { model: ModelOption }) => {
  const { details } = model;
  const chips = [
    details.reasoning && 'Reasoning',
    details.toolcall && 'Tools',
    details.attachment && 'Attachments',
    ...details.inputs.map((kind) => (kind === 'pdf' ? 'PDF' : kind[0].toUpperCase() + kind.slice(1))),
  ].filter((chip): chip is string => Boolean(chip));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{details.providerName}</span>
        <h3 className="text-[15px] font-semibold leading-tight">{details.name}</h3>
        <code className="truncate text-[11px] text-muted-foreground" title={modelRefKey(model)}>
          {model.modelID}
        </code>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span key={chip} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {details.contextTokens ? <Fact label="Context" value={`${formatTokens(details.contextTokens)} tokens`} /> : null}
        {details.outputTokens ? <Fact label="Max output" value={`${formatTokens(details.outputTokens)} tokens`} /> : null}
        {details.costInput !== undefined && details.costOutput !== undefined ? (
          <Fact
            label="Cost / 1M tokens"
            value={
              details.costInput === 0 && details.costOutput === 0
                ? 'free'
                : `${formatCost(details.costInput)} in · ${formatCost(details.costOutput)} out`
            }
          />
        ) : null}
        {details.family ? <Fact label="Family" value={details.family} /> : null}
        {details.releaseDate ? <Fact label="Released" value={details.releaseDate} /> : null}
        {details.variants.length ? <Fact label="Effort levels" value={details.variants.join(' · ')} /> : null}
      </div>
    </div>
  );
};

export default function ModelPicker({
  open,
  models,
  recentModels,
  value,
  collapseProviders = false,
  onSelect,
  onOpenChange,
}: Props) {
  const [query, setQuery] = React.useState('');
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = React.useState<Set<string>>(() => new Set());
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setHovered(null);
      setExpandedProviders(new Set());
      // Radix moves focus after mount; wait a tick so ours wins.
      window.setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  const byKey = React.useMemo(() => new Map(models.map((model) => [modelRefKey(model), model])), [models]);

  const groups = React.useMemo<Group[]>(() => {
    const needle = query.trim().toLowerCase();
    const visible = needle ? models.filter((model) => matches(model, needle)) : models;
    const recent = recentModels
      .map((key) => byKey.get(key))
      .filter((model): model is ModelOption => Boolean(model) && visible.includes(model as ModelOption));
    const byProvider = new Map<string, Group>();
    visible.forEach((model) => {
      const group = byProvider.get(model.providerID) ?? {
        id: model.providerID,
        title: model.details.providerName,
        models: [],
      };
      group.models.push(model);
      byProvider.set(model.providerID, group);
    });
    const providers = [...byProvider.values()].sort((a, b) => a.title.localeCompare(b.title));
    return recent.length ? [{ id: 'recent', title: 'Recent', models: recent }, ...providers] : providers;
  }, [models, recentModels, byKey, query]);

  const activeKey = hovered ?? (value !== DEFAULT_MODEL ? value : null);
  const activeModel = activeKey ? byKey.get(activeKey) ?? null : null;
  const total = groups.reduce((sum, group) => sum + (group.id === 'recent' ? 0 : group.models.length), 0);

  const pick = (key: string) => {
    onSelect(key);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[calc(100dvh-1rem)] max-h-[560px] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[min(560px,80vh)] sm:w-[min(820px,92vw)] sm:max-w-[820px]"
        showCloseButton={false}
        // First Escape clears the search, the next one closes — like a native combobox.
        onEscapeKeyDown={(event) => {
          if (query) {
            event.preventDefault();
            setQuery('');
          }
        }}
      >
        <DialogTitle className="sr-only">Choose a model</DialogTitle>
        <DialogDescription className="sr-only">
          Pick the model for this session, or leave it on the instance default.
        </DialogDescription>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 w-full flex-none flex-col sm:w-[360px] sm:border-r">
            <div className="relative border-b p-2.5">
              <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={`Search ${models.length} models…`}
                aria-label="Search models"
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 pl-8 pr-7 text-base shadow-none sm:h-8 sm:text-xs [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute top-1/2 right-4 -translate-y-1/2"
                >
                  <X />
                </Button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-1.5" onMouseLeave={() => setHovered(null)}>
              {!query ? (
                <button
                  type="button"
                  onMouseEnter={() => setHovered(null)}
                  onClick={() => pick(DEFAULT_MODEL)}
                  className={cn(
                    'mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px]',
                    value === DEFAULT_MODEL ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <Sparkles className="size-3.5 flex-none" />
                  <span className="flex-1">Default model</span>
                  {value === DEFAULT_MODEL ? <Check className="size-3.5 flex-none text-highlight" /> : null}
                </button>
              ) : null}

              {groups.map((group) => {
                const collapsible = collapseProviders && group.id !== 'recent' && !query.trim();
                const expanded = !collapsible || expandedProviders.has(group.id);
                return (
                  <div key={group.id} className="mb-2">
                    {collapsible ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedProviders((current) => {
                          const next = new Set(current);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })}
                        className="sticky top-0 z-10 flex w-full items-center bg-popover px-2.5 pt-1.5 pb-1 text-left text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className={cn('mr-1 size-3 transition-transform', expanded && 'rotate-90')} />
                        {group.title}
                        <span className="ml-auto tabular-nums opacity-70">{group.models.length}</span>
                      </button>
                    ) : (
                      <div className="sticky top-0 z-10 bg-popover px-2.5 pt-1.5 pb-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                        {group.title}
                        <span className="ml-1.5 tabular-nums opacity-70">{group.models.length}</span>
                      </div>
                    )}
                    {expanded ? group.models.map((model) => {
                      const key = modelRefKey(model);
                      return (
                        <Row
                          key={`${group.id}:${key}`}
                          model={model}
                          selected={key === value}
                          active={key === activeKey}
                          onHover={() => setHovered(key)}
                          onPick={() => pick(key)}
                        />
                      );
                    }) : null}
                  </div>
                );
              })}

              {groups.length === 0 ? (
                <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">
                  No models match “{query.trim()}”.
                </div>
              ) : null}
            </div>

            <div className="flex-none border-t px-3 py-1.5 text-[10.5px] text-muted-foreground">
              {total} models from {groups.filter((group) => group.id !== 'recent').length} connected providers
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 overflow-y-auto p-5 sm:block">
            {activeModel ? (
              <Details model={activeModel} />
            ) : (
              <div className="flex h-full flex-col justify-center gap-2 text-center text-muted-foreground">
                <Sparkles className="mx-auto size-5" />
                <p className="text-[13px] font-medium text-foreground">Default model</p>
                <p className="text-[12px]">
                  The instance picks its configured default. Hover a model on the left to see what it offers.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
