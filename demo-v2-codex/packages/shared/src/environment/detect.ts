import { RuntimePlatform, type RuntimeEnv } from '../types/environment';

export const detectPlatform = (): RuntimeEnv => {
  const hasWindow = typeof window !== 'undefined';
  const hasTauri = hasWindow && typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  const nodeProcess = (globalThis as { process?: { versions?: { node?: string } } }).process;
  const hasProcess = !!nodeProcess?.versions?.node;
  const hasWorker = typeof self !== 'undefined' && typeof (globalThis as { importScripts?: unknown }).importScripts === 'function';

  const platform = hasWorker
    ? RuntimePlatform.Worker
    : hasTauri
      ? RuntimePlatform.Tauri
    : hasWindow
      ? RuntimePlatform.Browser
      : RuntimePlatform.NodeJS;

  return {
    platform,
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hasOPFS: typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory,
    hasFSWatch: hasProcess
  };
};
