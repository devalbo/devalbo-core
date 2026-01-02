// Web browser entry point
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import 'ink-web/css';
import 'xterm/css/xterm.css';
import { App } from './App';

// Render the React app
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
