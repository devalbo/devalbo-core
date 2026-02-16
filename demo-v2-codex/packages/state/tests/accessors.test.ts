import { describe, expect, it } from 'vitest';
import { createDevalboStore } from '../src/store';
import {
  deleteBuffer,
  deleteEntry,
  getBuffer,
  getEntry,
  listBuffers,
  listEntries,
  setBuffer,
  setEntry
} from '../src/accessors';

describe('state accessors', () => {
  it('sets and gets an entry', () => {
    const store = createDevalboStore();

    setEntry(store, 'entry-1', {
      path: '/README.md',
      name: 'README.md',
      parentPath: '/',
      isDirectory: false,
      size: 123,
      mtime: '2026-02-16T00:00:00.000Z'
    });

    expect(getEntry(store, 'entry-1')).toEqual({
      path: '/README.md',
      name: 'README.md',
      parentPath: '/',
      isDirectory: false,
      size: 123,
      mtime: '2026-02-16T00:00:00.000Z'
    });
  });

  it('returns null for invalid entry rows', () => {
    const store = createDevalboStore();

    store.setRow('entries', 'bad-entry', {
      path: 123 as unknown as string,
      name: 'bad',
      parentPath: '/',
      isDirectory: false,
      size: 1,
      mtime: '2026-02-16T00:00:00.000Z'
    });

    expect(getEntry(store, 'bad-entry')).toBeNull();
  });

  it('lists valid entries only', () => {
    const store = createDevalboStore();

    setEntry(store, 'entry-1', {
      path: '/a',
      name: 'a',
      parentPath: '/',
      isDirectory: false,
      size: 1,
      mtime: '2026-02-16T00:00:00.000Z'
    });
    setEntry(store, 'entry-2', {
      path: '/b',
      name: 'b',
      parentPath: '/',
      isDirectory: true,
      size: 0,
      mtime: '2026-02-16T00:00:00.000Z'
    });
    setEntry(store, 'entry-3', {
      path: '/c',
      name: 'c',
      parentPath: '/',
      isDirectory: false,
      size: 2,
      mtime: '2026-02-16T00:00:00.000Z'
    });

    const rows = listEntries(store);
    expect(rows).toHaveLength(3);
    expect(rows.map((value) => value.id)).toEqual(['entry-1', 'entry-2', 'entry-3']);
  });

  it('deletes an entry', () => {
    const store = createDevalboStore();

    setEntry(store, 'entry-1', {
      path: '/README.md',
      name: 'README.md',
      parentPath: '/',
      isDirectory: false,
      size: 123,
      mtime: '2026-02-16T00:00:00.000Z'
    });

    deleteEntry(store, 'entry-1');
    expect(getEntry(store, 'entry-1')).toBeNull();
  });

  it('sets and gets a buffer', () => {
    const store = createDevalboStore();

    setBuffer(store, 'buffer-1', {
      path: '/README.md',
      content: 'hello',
      isDirty: true,
      cursorLine: 1,
      cursorCol: 2
    });

    expect(getBuffer(store, 'buffer-1')).toEqual({
      path: '/README.md',
      content: 'hello',
      isDirty: true,
      cursorLine: 1,
      cursorCol: 2
    });
  });

  it('returns null for invalid buffer rows', () => {
    const store = createDevalboStore();

    store.setRow('buffers', 'bad-buffer', {
      path: '/README.md',
      content: 'x',
      isDirty: 'yes' as unknown as boolean,
      cursorLine: 1,
      cursorCol: 2
    });

    expect(getBuffer(store, 'bad-buffer')).toBeNull();
  });

  it('lists valid buffers only', () => {
    const store = createDevalboStore();

    setBuffer(store, 'buffer-1', {
      path: '/a',
      content: 'a',
      isDirty: false,
      cursorLine: 1,
      cursorCol: 1
    });
    setBuffer(store, 'buffer-2', {
      path: '/b',
      content: 'b',
      isDirty: true,
      cursorLine: 2,
      cursorCol: 2
    });
    setBuffer(store, 'buffer-3', {
      path: '/c',
      content: 'c',
      isDirty: false,
      cursorLine: 3,
      cursorCol: 3
    });

    const rows = listBuffers(store);
    expect(rows).toHaveLength(3);
    expect(rows.map((value) => value.id)).toEqual(['buffer-1', 'buffer-2', 'buffer-3']);
  });

  it('deletes a buffer', () => {
    const store = createDevalboStore();

    setBuffer(store, 'buffer-1', {
      path: '/README.md',
      content: 'hello',
      isDirty: true,
      cursorLine: 1,
      cursorCol: 2
    });

    deleteBuffer(store, 'buffer-1');
    expect(getBuffer(store, 'buffer-1')).toBeNull();
  });
});
