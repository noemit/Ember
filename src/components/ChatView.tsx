import * as React from 'react';
import type { ChatMessage, ModelOption } from '../types';

type Props = {
  sessionId: string | null;
  messages: ChatMessage[];
  models: ModelOption[];
  defaultModelId: string | null;
  mru: string[];
  onSend: (text: string, model: ModelOption | undefined, mode: string) => void;
};

export default function ChatView({ sessionId, messages, models, defaultModelId, mru, onSend }: Props) {
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState('build');
  const [modelId, setModelId] = React.useState('');
  const [attachment, setAttachment] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const orderedModels = React.useMemo(() => {
    const keyOf = (model: ModelOption) => `${model.providerID}/${model.modelID}`;
    const keys = new Set(models.map(keyOf));
    const mruKeys = (mru ?? []).filter((key) => keys.has(key));
    const rest = models
      .map(keyOf)
      .filter((key) => !mruKeys.includes(key));
    return [...mruKeys, ...rest].map((key) => models.find((model) => keyOf(model) === key)).filter(
      (model): model is ModelOption => Boolean(model)
    );
  }, [models, mru]);

  React.useEffect(() => {
    if (defaultModelId) setModelId(defaultModelId);
  }, [defaultModelId]);

  const model = models.find((entry) => `${entry.providerID}/${entry.modelID}` === modelId);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;
    onSend(trimmed, model, mode);
    setText('');
    setAttachment(null);
  };

  return (
    <div className="chat">
      {sessionId ? (
        <div className="messages">
          {messages.map((message) => (
            <div className="message" data-role={message.role} key={message.id}>
              {message.text}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Pick a session, or start a new agent.</div>
      )}

      <div className="composer">
        <div className="composer-row">
          <select className="sorter" value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">Model: default</option>
            {orderedModels.map((entry) => (
              <option key={entry.label} value={`${entry.providerID}/${entry.modelID}`}>
                {entry.label}
              </option>
            ))}
          </select>

          <select className="sorter" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="build">Build</option>
            <option value="plan">Plan</option>
          </select>

          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(event) => setAttachment(event.target.files?.[0]?.name ?? null)}
          />
          <button className="icon-button" onClick={() => fileRef.current?.click()}>
            Attach
          </button>
          {attachment ? <span className="instance-meta">{attachment}</span> : null}
        </div>

        <textarea
          value={text}
          placeholder={sessionId ? 'Message the agent…' : 'Select a session first'}
          disabled={!sessionId}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />

        <div className="composer-row" style={{ justifyContent: 'flex-end' }}>
          <button className="primary-button" style={{ width: 'auto' }} onClick={submit} disabled={!sessionId}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
