// Web browser entry point
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import 'ink-web/css';
import 'xterm/css/xterm.css';
import { App } from './App';
import { cli } from './console-helpers';

// Expose CLI to browser dev console for debugging
declare global {
  interface Window {
    cli: typeof cli;
  }
}

window.cli = cli;

// Render the React app
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
