import { afterEach, describe, expect, it } from 'vitest';
import { detectPlatform } from '../src/environment/detect';
import { RuntimePlatform } from '../src/types/environment';

const originalWindow = (globalThis as { window?: unknown }).window;
const originalSelf = (globalThis as { self?: unknown }).self;
const originalImportScripts = (globalThis as { importScripts?: unknown }).importScripts;
const originalProcess = (globalThis as { process?: unknown }).process;

afterEach(() => {
  if (typeof originalWindow === 'undefined') {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }

  if (typeof originalSelf === 'undefined') {
    delete (globalThis as { self?: unknown }).self;
  } else {
    (globalThis as { self?: unknown }).self = originalSelf;
  }

  if (typeof originalImportScripts === 'undefined') {
    delete (globalThis as { importScripts?: unknown }).importScripts;
  } else {
    (globalThis as { importScripts?: unknown }).importScripts = originalImportScripts;
  }

  if (typeof originalProcess === 'undefined') {
    delete (globalThis as { process?: unknown }).process;
  } else {
    (globalThis as { process?: unknown }).process = originalProcess;
  }
});

describe('detectPlatform', () => {
  it('detects node by default in test runtime', () => {
    expect(detectPlatform().platform).toBe(RuntimePlatform.NodeJS);
  });

  it('detects browser when window exists and process is absent', () => {
    (globalThis as { process?: unknown }).process = undefined;
    (globalThis as { window?: unknown }).window = {};
    expect(detectPlatform().platform).toBe(RuntimePlatform.Browser);
  });

  it('detects worker when importScripts exists', () => {
    (globalThis as { process?: unknown }).process = undefined;
    (globalThis as { self?: unknown }).self = {};
    (globalThis as { importScripts?: unknown }).importScripts = () => {};
    expect(detectPlatform().platform).toBe(RuntimePlatform.Worker);
  });
});
