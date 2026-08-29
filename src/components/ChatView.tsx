import * as React from 'react';
import type { ChatMessage, ModelOption } from '../types';

type Props = {
  sessionId: string | null;
  messages: ChatMessage[];
  models: ModelOption[];
  onSend: (text: string, model: ModelOption | undefined, mode: string) => void;
};

export default function ChatView({ sessionId, messages, models, onSend }: Props) {
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState('build');
  const [modelId, setModelId] = React.useState('');
  const [attachment, setAttachment] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

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
            {models.map((entry) => (
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
