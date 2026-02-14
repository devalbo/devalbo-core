import React from 'react';
import { createRoot } from 'react-dom/client';
import 'ink-web/css';
import 'xterm/css/xterm.css';
import '@/index.css';
import { App } from './App';
import { cli } from './console-helpers';

declare global {
  interface Window {
    cli: typeof cli;
  }
}

window.cli = cli;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
