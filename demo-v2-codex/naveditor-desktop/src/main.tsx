import React from 'react';
import { createRoot } from 'react-dom/client';
import 'ink-web/css';
import '@xterm/xterm/css/xterm.css';
import '@/index.css';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
