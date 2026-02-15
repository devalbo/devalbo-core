import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
});
