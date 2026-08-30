import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Provide browser fallback stubs if running outside Electron
if (typeof window !== 'undefined' && !window.ember) {
  window.ember = {
    listInstances: async () => [
      { id: 'demo-local', label: 'Ember Local Demo', kind: 'local', status: 'ready', attachable: true },
    ],
    windowInstance: async () => 'demo-local',
    openInstance: async () => null,
    getTheme: async () => 'warm-charcoal',
    setTheme: async () => null,
    modelsGet: async () => [],
    modelsSet: async () => null,
    request: async (_id, _method, path) => {
      if (path === '/api/session') {
        return {
          ok: true,
          status: 200,
          data: [
            { id: 'habit-qa', title: 'Habit QA', directory: '/workspace/ember', updated: Date.now() - 3600000 },
            { id: 'habit-dist', title: 'Habit distribution', directory: '/workspace/ember', updated: Date.now() - 7200000 },
            { id: 'yt-mgr', title: 'Youtube Manager', directory: '/workspace/ember', updated: Date.now() - 10800000 },
            { id: 'habit-am', title: 'Habit.am manager', directory: '/workspace/ember', updated: Date.now() - 14400000 },
            { id: 'qa-eng', title: 'QA Engineer', directory: '/workspace/ember', updated: Date.now() - 18000000 },
            { id: 'habit-ig', title: 'Habit Instagram', directory: '/workspace/ember', updated: Date.now() - 21600000 },
          ],
        };
      }
      if (path === '/api/project') {
        return {
          ok: true,
          status: 200,
          data: [{ id: 'ember-proj', name: 'ember', path: '/workspace/ember' }],
        };
      }
      if (path === '/api/sessions/status') {
        return {
          ok: true,
          status: 200,
          data: {
            sessions: {
              'habit-qa': { status: 'idle' },
              'habit-dist': { status: 'active' },
              'yt-mgr': { status: 'idle' },
              'habit-am': { status: 'needs-input' },
              'qa-eng': { status: 'idle' },
              'habit-ig': { status: 'idle' },
            },
          },
        };
      }
      if (path.includes('/message')) {
        return {
          ok: true,
          status: 200,
          data: [
            { id: 'm1', role: 'user', content: 'Help me review the new blob avatar designs' },
            { id: 'm2', role: 'assistant', content: 'Here are the 7 experimental personality directions ready for review!' },
          ],
        };
      }
      if (path === '/api/provider') {
        return {
          ok: true,
          status: 200,
          data: {
            connected: ['anthropic', 'openai'],
            all: [
              {
                id: 'anthropic',
                name: 'Anthropic',
                models: {
                  'claude-3-7-sonnet': { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
                },
              },
            ],
            default: { providerID: 'anthropic', modelID: 'claude-3-7-sonnet' },
          },
        };
      }
      return { ok: true, status: 200, data: {} };
    },
    onInstanceChanged: () => () => {},
  };
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
