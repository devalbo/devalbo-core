import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RuntimePlatform } from '@devalbo/shared';
import * as shared from '@devalbo/shared';
import { commands } from '@/commands';

function extractText(node: ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    if (props?.children) return extractText(props.children);
  }
  return '';
}

describe('file terminal commands', () => {
  let workspace = '';

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), 'naveditor-cmds-'));
    await mkdir(path.join(workspace, 'docs'));
    await writeFile(path.join(workspace, 'docs', 'hello.txt'), 'Hello, World!\n', 'utf8');
  });

  afterEach(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('pwd prints current directory', async () => {
    const result = await commands.pwd([], { cwd: workspace });
    expect(extractText(result.component)).toContain(workspace);
  });

  it('cd updates cwd via callback', async () => {
    let cwd = workspace;
    const result = await commands.cd(['docs'], {
      cwd,
      setCwd: (next) => {
        cwd = next;
      }
    });

    expect(result.error).toBeUndefined();
    expect(cwd).toBe(path.join(workspace, 'docs'));
  });

  it('ls lists directory contents', async () => {
    const result = await commands.ls(['docs'], { cwd: workspace });
    expect(extractText(result.component)).toContain('hello.txt');
  });

  it('tree renders a recursive tree', async () => {
    await mkdir(path.join(workspace, 'docs', 'nested'));
    await writeFile(path.join(workspace, 'docs', 'nested', 'a.txt'), 'a', 'utf8');

    const result = await commands.tree(['docs'], { cwd: workspace });
    const text = extractText(result.component);
    expect(text).toContain('docs/');
    expect(text).toContain('nested/');
    expect(text).toContain('a.txt');
  });

  it('stat prints path metadata', async () => {
    const result = await commands.stat(['docs/hello.txt'], { cwd: workspace });
    const text = extractText(result.component);
    expect(text).toContain('Name: hello.txt');
    expect(text).toContain('Type: file');
  });

  it('clear calls clearScreen callback', async () => {
    const clearScreen = vi.fn();
    const result = await commands.clear([], { cwd: workspace, clearScreen });
    expect(result.error).toBeUndefined();
    expect(clearScreen).toHaveBeenCalledTimes(1);
  });

  it('cat prints file contents', async () => {
    const result = await commands.cat(['docs/hello.txt'], { cwd: workspace });
    expect(extractText(result.component)).toContain('Hello, World!');
  });

  it('touch creates a file', async () => {
    const target = path.join(workspace, 'docs', 'new.txt');
    const result = await commands.touch(['docs/new.txt'], { cwd: workspace });

    expect(result.error).toBeUndefined();
    const content = await readFile(target, 'utf8');
    expect(content).toBe('');
  });

  it('mkdir creates a directory', async () => {
    const target = path.join(workspace, 'docs', 'created');
    const result = await commands.mkdir(['docs/created'], { cwd: workspace });

    expect(result.error).toBeUndefined();
    const statResult = await commands.stat(['docs/created'], { cwd: workspace });
    expect(extractText(statResult.component)).toContain('Type: directory');
    expect(extractText(result.component)).toContain(target);
  });

  it('cp copies file', async () => {
    const result = await commands.cp(['docs/hello.txt', 'docs/copied.txt'], { cwd: workspace });
    expect(result.error).toBeUndefined();
    const copied = await readFile(path.join(workspace, 'docs', 'copied.txt'), 'utf8');
    expect(copied).toContain('Hello, World!');
  });

  it('mv moves file', async () => {
    const source = path.join(workspace, 'docs', 'hello.txt');
    const dest = path.join(workspace, 'docs', 'moved.txt');
    const result = await commands.mv(['docs/hello.txt', 'docs/moved.txt'], { cwd: workspace });

    expect(result.error).toBeUndefined();
    const moved = await readFile(dest, 'utf8');
    expect(moved).toContain('Hello, World!');
    await expect(readFile(source, 'utf8')).rejects.toThrow();
  });

  it('rm removes file', async () => {
    const target = path.join(workspace, 'docs', 'hello.txt');
    const result = await commands.rm(['docs/hello.txt'], { cwd: workspace });

    expect(result.error).toBeUndefined();
    await expect(readFile(target, 'utf8')).rejects.toThrow();
  });

  it('backend shows active filesystem adapter', async () => {
    const result = await commands.backend([], { cwd: workspace });
    const text = extractText(result.component);
    expect(result.error).toBeUndefined();
    expect(text).toContain('Platform: nodejs');
    expect(text).toContain('Adapter: native-node');
  });

  it('exit triggers terminal exit callback', async () => {
    const exit = vi.fn();
    const result = await commands.exit([], { cwd: workspace, exit });
    expect(result.error).toBeUndefined();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('exports and imports fileroot using BFT JSON format', async () => {
    const sourceDir = path.join(workspace, 'project');
    await mkdir(sourceDir);
    await writeFile(path.join(sourceDir, 'hello.txt'), 'Hello BFT\\n', 'utf8');
    await writeFile(path.join(sourceDir, 'blob.bin'), Buffer.from([0, 1, 2, 255]));

    const bundlePath = path.join(workspace, 'snapshot.bft');
    const exportResult = await commands['export'](['project', 'snapshot.bft'], { cwd: workspace });
    expect(exportResult.error).toBeUndefined();
    const bundleText = await readFile(bundlePath, 'utf8');
    expect(bundleText).toContain('\"type\": \"directory\"');

    const importResult = await commands['import'](['snapshot.bft', 'restored'], { cwd: workspace });
    expect(importResult.error).toBeUndefined();

    const restoredText = await readFile(path.join(workspace, 'restored', 'hello.txt'), 'utf8');
    expect(restoredText).toBe('Hello BFT\\n');
    const restoredBlob = await readFile(path.join(workspace, 'restored', 'blob.bin'));
    expect(Array.from(restoredBlob)).toEqual([0, 1, 2, 255]);
  });

  it('import opens a picker in browser mode when bft path is omitted', async () => {
    const sourceDir = path.join(workspace, 'project');
    await mkdir(sourceDir);
    await writeFile(path.join(sourceDir, 'hello.txt'), 'Hello Picker\\n', 'utf8');
    await commands['export'](['project', 'snapshot.bft'], { cwd: workspace });
    const bundleText = await readFile(path.join(workspace, 'snapshot.bft'), 'utf8');

    const detectSpy = vi.spyOn(shared, 'detectPlatform').mockReturnValue({
      platform: RuntimePlatform.Browser,
      hasSharedArrayBuffer: true,
      hasOPFS: false,
      hasFSWatch: false
    });

    const inputMock = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [{ name: 'snapshot.bft', text: async () => bundleText }],
      onchange: undefined as undefined | (() => void),
      oncancel: undefined as undefined | (() => void),
      click() {
        this.onchange?.();
      },
      remove: vi.fn()
    };

    const originalDocument = globalThis.document;
    (globalThis as { document?: Document }).document = {
      createElement: vi.fn(() => inputMock),
      body: { appendChild: vi.fn() }
    } as unknown as Document;

    try {
      const result = await commands['import'](['picked'], { cwd: workspace });
      expect(result.error).toBeUndefined();
      const restoredText = await readFile(path.join(workspace, 'picked', 'hello.txt'), 'utf8');
      expect(restoredText).toBe('Hello Picker\\n');
    } finally {
      detectSpy.mockRestore();
      if (originalDocument === undefined) {
        delete (globalThis as { document?: Document }).document;
      } else {
        (globalThis as { document?: Document }).document = originalDocument;
      }
    }
  });

  it('export triggers browser download when no output path is provided', async () => {
    const sourceDir = path.join(workspace, 'project');
    await mkdir(sourceDir);
    await writeFile(path.join(sourceDir, 'hello.txt'), 'Hello Download\\n', 'utf8');

    const detectSpy = vi.spyOn(shared, 'detectPlatform').mockReturnValue({
      platform: RuntimePlatform.Browser,
      hasSharedArrayBuffer: true,
      hasOPFS: false,
      hasFSWatch: false
    });

    const click = vi.fn();
    const remove = vi.fn();
    const anchorMock = {
      href: '',
      download: '',
      style: { display: '' },
      click,
      remove
    };

    const createElement = vi.fn((tag: string) => {
      if (tag !== 'a') throw new Error(`Unexpected element: ${tag}`);
      return anchorMock;
    });
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:naveditor-export');
    const revokeObjectURL = vi.fn();

    const originalDocument = globalThis.document;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    (globalThis as { document?: Document }).document = {
      createElement: createElement as unknown as Document['createElement'],
      body: { appendChild }
    } as unknown as Document;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    try {
      const result = await commands['export'](['project'], { cwd: workspace });
      expect(result.error).toBeUndefined();
      expect(extractText(result.component)).toContain('Downloaded project.bft.json');
      expect(createElement).toHaveBeenCalledWith('a');
      expect(appendChild).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(anchorMock.download).toBe('project.bft.json');
    } finally {
      detectSpy.mockRestore();
      if (originalDocument === undefined) {
        delete (globalThis as { document?: Document }).document;
      } else {
        (globalThis as { document?: Document }).document = originalDocument;
      }
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
