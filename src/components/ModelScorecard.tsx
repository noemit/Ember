import * as React from 'react';
import { clearModelStats, retryModelStats, summarizeModel, useModelStats } from '@/lib/modelStats';
import { Button } from '@/components/ui/button';
import type { ModelRef } from '../types';

export default function ModelScorecard({ model, instanceId, directory }: {
  model: ModelRef;
  instanceId?: string;
  directory?: string;
}) {
  const { records, error } = useModelStats();
  const [scope, setScope] = React.useState(directory ? 'project' : instanceId ? 'instance' : 'all');
  const [days, setDays] = React.useState(30);
  const rows = React.useMemo(() => records.filter((row) =>
    row.providerID === model.providerID && row.modelID === model.modelID &&
    (row.variant ?? '') === (model.variant ?? '') &&
    row.completedAt >= Date.now() - days * 86_400_000 &&
    (scope === 'all' || row.instanceId === instanceId) &&
    (scope !== 'project' || row.directory === directory)
  ), [records, model.providerID, model.modelID, model.variant, days, scope, instanceId, directory]);
  const stats = React.useMemo(() => summarizeModel(rows), [rows]);
  const number = (value: number | undefined, unit: string) => value === undefined ? 'Unknown' : `${value.toFixed(1)}${unit}`;
  const facts = [
    ['Median call duration', `${number(stats.duration === undefined ? undefined : stats.duration / 1000, 's')} · ${stats.durationSamples} samples`],
    ['Effective output rate', `${number(stats.rate, ' tok/s')} · ${stats.rateSamples} samples`],
    ['Median reported cost', `${stats.cost === undefined ? 'Unknown' : `$${stats.cost.toFixed(4)}`} · ${stats.costSamples} samples`],
    ['Prompt cache use', `${number(stats.cache === undefined ? undefined : stats.cache * 100, '%')} · ${stats.cacheSamples} samples`],
    ['Reported errors', `${stats.errors} · ${stats.cancelled} cancelled separately`],
    ['Helpful replies', `${stats.helpful} / ${stats.rated} rated`],
  ];
  return <section aria-label="Your model experience" className="flex flex-col gap-2 border-t pt-3">
    <h4 className="text-xs font-semibold">Your experience</h4>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Experience scope" value={scope} onChange={(event) => setScope(event.target.value)} className="min-w-0 rounded border bg-background p-1 text-xs">
        {directory ? <option value="project">This project</option> : null}
        {instanceId ? <option value="instance">This instance</option> : null}
        <option value="all">All observed instances</option>
      </select>
      <select aria-label="Experience date range" value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded border bg-background p-1 text-xs">
        <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
      </select>
    </div>
    <p className="text-[11px] text-muted-foreground">{stats.count} observed model calls · {model.variant || 'default / unknown effort'}{stats.count < 5 ? ' · limited data' : ''}</p>
    {facts.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-[11px]"><span className="text-muted-foreground">{label}</span><span className="text-right tabular-nums">{value}</span></div>)}
    <p className="text-[10px] text-muted-foreground">Only sessions seen by Ember. Calls are not whole tasks; durations can include tool/wait time. Ratings are yours, not an automatic quality score.</p>
    {error ? <div role="alert" className="text-xs text-destructive">{error} <button onClick={() => void retryModelStats()} className="underline">Retry</button></div> : null}
  </section>;
}

export function ModelExperienceSettings() {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return <section className="flex flex-col gap-2 rounded-lg border p-3">
    <h3 className="text-xs font-semibold">Model experience</h3>
    <p className="text-[11px] text-muted-foreground">Stored on this Ember host: usage metadata and your ratings only, no conversation text. Up to 10,000 observations from the last 90 days. Visible in the model picker.</p>
    <Button size="sm" variant="outline" disabled={busy} className="self-start" onClick={() => {
      if (!confirm) { setConfirm(true); return; }
      setBusy(true);
      void clearModelStats().then(() => { setConfirm(false); setError(null); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not clear experience')).finally(() => setBusy(false));
    }}>{busy ? 'Clearing…' : confirm ? 'Confirm: clear observations and ratings' : 'Clear model experience'}</Button>
    {confirm ? <Button size="xs" variant="ghost" className="self-start" onClick={() => setConfirm(false)}>Cancel</Button> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </section>;
}
