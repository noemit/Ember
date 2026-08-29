import * as React from 'react';
import type { Instance } from '../types';

type Props = {
  instances: Instance[];
  currentId: string | null;
  onOpen: (instanceId: string, mode: 'replace' | 'new') => void;
};

const kindLabel: Record<Instance['kind'], string> = {
  local: 'local',
  remote: 'remote',
  ssh: 'ssh',
  relay: 'private relay',
};

export default function InstanceBar({ instances, currentId, onOpen }: Props) {
  const [open, setOpen] = React.useState(false);
  const current = instances.find((instance) => instance.id === currentId) ?? null;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="topbar">
      <span className="brand">Ember</span>

      <button className="instance-button" onClick={() => setOpen((value) => !value)}>
        <span>{current ? current.label : 'Choose an instance'}</span>
        <span className="instance-meta">{open ? '▲' : '▼'}</span>
      </button>

      {current && !current.attachable ? (
        <span className="instance-meta">needs OpenChamber</span>
      ) : null}

      {open ? (
        <div className="instance-menu">
          {instances.length === 0 ? (
            <div className="instance-row">
              <span className="instance-meta">
                No instances found in ~/.config/openchamber/settings.json
              </span>
            </div>
          ) : null}

          {instances.map((instance) => (
            <div className="instance-row" key={instance.id}>
              <div className="instance-row-main">
                <div className="instance-name">{instance.label}</div>
                <div className="instance-meta">
                  {kindLabel[instance.kind]}
                  {instance.url ? ` · ${instance.url}` : ''}
                  {instance.attachable ? '' : ' · needs OpenChamber'}
                </div>
              </div>

              <button
                className="icon-button"
                disabled={!instance.attachable}
                title="Open in this window"
                onClick={() => {
                  onOpen(instance.id, 'replace');
                  setOpen(false);
                }}
              >
                Here
              </button>

              <button
                className="icon-button"
                disabled={!instance.attachable}
                title="Open in a new window"
                onClick={() => {
                  onOpen(instance.id, 'new');
                  setOpen(false);
                }}
              >
                ⧉
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
