import React from 'react';
import { createRoot } from 'react-dom/client';
import 'ink-web/css';
import '@xterm/xterm/css/xterm.css';
import '@/index.css';
import { App } from './App';
import { cli } from './console-helpers';

declare global {
  interface Window {
    cli: typeof cli;
  }
}

const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; VITE_ENABLE_WINDOW_CLI?: string } }).env;
if (env?.DEV || env?.VITE_ENABLE_WINDOW_CLI === 'true') {
  window.cli = cli;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
