import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const boot = async () => {
  if (!window.ember) {
    if (import.meta.env.DEV) await import('./dev/mockBridge');
    else await import('./remoteBridge');
  }
  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
};

void boot();
