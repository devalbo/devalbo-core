import path from 'path';
import type { FileEntry } from '@devalbo/shared';
import { asDirectoryPath, asFilePath, detectPlatform, RuntimePlatform } from '@devalbo/shared';
import { getDriver } from './file-operations';
import {
  bftNodeToBytes,
  bytesToBftNode,
  parseBftJson,
  sortedEntries,
  stringifyBft,
  type BftDirectoryNode
} from './bft-transfer';
import { PathTokenSchema } from './command-args.schema';

export interface FsTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FsTreeNode[];
}

const isNode = () => detectPlatform().platform === RuntimePlatform.NodeJS;
const pathOps = () => (isNode() ? path : path.posix);

export const getDefaultCwd = (): string => {
  if (!isNode()) return '/';
  const nodeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
  return nodeProcess?.cwd?.() ?? '/';
};

export const joinFsPath = (left: string, right: string): string => pathOps().join(left, right);

export const splitFsPath = (input: string): string[] => input.split('/').filter(Boolean);

export const resolveFsPath = (cwd: string, input = '.'): string => {
  const ops = pathOps();
  return isNode() ? ops.resolve(cwd, input) : ops.normalize(input.startsWith('/') ? input : ops.join(cwd, input));
};

const basename = (targetPath: string): string => pathOps().basename(targetPath);

const toFilePath = (targetPath: string) => asFilePath(targetPath);
const toDirectoryPath = (targetPath: string) => asDirectoryPath(targetPath);

const validatePathArg = (value: string, label: string): string => {
  const parsed = PathTokenSchema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`${label}: ${message}`);
  }
  return parsed.data;
};

const sortEntries = (entries: FileEntry[]): FileEntry[] =>
  entries.slice().sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

export const changeDir = async (cwd: string, requested: string): Promise<string> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid directory path'));
  const driver = await getDriver();
  const entry = await driver.stat(toFilePath(targetPath));
  if (!entry.isDirectory) {
    throw new Error(`Not a directory: ${requested}`);
  }
  return targetPath;
};

export const listDirectory = async (cwd: string, requested = '.'): Promise<FileEntry[]> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid directory path'));
  const driver = await getDriver();
  const entries = await driver.readdir(toDirectoryPath(targetPath));
  return sortEntries(entries);
};

export const readTextFile = async (cwd: string, requested: string): Promise<string> => {
  const bytes = await readBytesFile(cwd, requested);
  return new TextDecoder().decode(bytes);
};

export const readBytesFile = async (cwd: string, requested: string): Promise<Uint8Array> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid file path'));
  const driver = await getDriver();
  const entry = await driver.stat(toFilePath(targetPath));
  if (entry.isDirectory) {
    throw new Error(`Not a file: ${requested}`);
  }
  return driver.readFile(toFilePath(targetPath));
};

export const writeTextFile = async (cwd: string, requested: string, content: string): Promise<string> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid file path'));
  const driver = await getDriver();
  await driver.writeFile(toFilePath(targetPath), new TextEncoder().encode(content));
  return targetPath;
};

export const writeBytesFile = async (cwd: string, requested: string, data: Uint8Array): Promise<string> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid file path'));
  const driver = await getDriver();
  await driver.writeFile(toFilePath(targetPath), data);
  return targetPath;
};

export const touchFile = async (cwd: string, requested: string): Promise<string> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid file path'));
  const driver = await getDriver();
  const exists = await driver.exists(toFilePath(targetPath));
  if (exists) {
    const entry = await driver.stat(toFilePath(targetPath));
    if (entry.isDirectory) {
      throw new Error(`Not a file: ${requested}`);
    }
  }
  await driver.writeFile(toFilePath(targetPath), new Uint8Array());
  return targetPath;
};

export const makeDirectory = async (cwd: string, requested: string): Promise<string> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid directory path'));
  const driver = await getDriver();
  await driver.mkdir(toDirectoryPath(targetPath));
  return targetPath;
};

const removeRecursiveAbsolute = async (targetPath: string): Promise<void> => {
  const driver = await getDriver();
  const entry = await driver.stat(toFilePath(targetPath));
  if (entry.isDirectory) {
    const children = await driver.readdir(toDirectoryPath(targetPath));
    for (const child of children) {
      await removeRecursiveAbsolute(joinFsPath(targetPath, child.name));
    }
  }
  await driver.rm(toFilePath(targetPath));
};

const copyRecursiveAbsolute = async (sourcePath: string, destPath: string): Promise<void> => {
  const driver = await getDriver();
  const source = await driver.stat(toFilePath(sourcePath));
  if (source.isDirectory) {
    await driver.mkdir(toDirectoryPath(destPath));
    const children = await driver.readdir(toDirectoryPath(sourcePath));
    for (const child of children) {
      await copyRecursiveAbsolute(joinFsPath(sourcePath, child.name), joinFsPath(destPath, child.name));
    }
    return;
  }

  const data = await driver.readFile(toFilePath(sourcePath));
  await driver.writeFile(toFilePath(destPath), data);
};

export const removePath = async (cwd: string, requested: string): Promise<string> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid path'));
  await removeRecursiveAbsolute(targetPath);
  return targetPath;
};

export const copyPath = async (cwd: string, source: string, dest: string): Promise<{ sourcePath: string; destPath: string }> => {
  const sourcePath = resolveFsPath(cwd, validatePathArg(source, 'Invalid source path'));
  const destPath = resolveFsPath(cwd, validatePathArg(dest, 'Invalid destination path'));
  await copyRecursiveAbsolute(sourcePath, destPath);
  return { sourcePath, destPath };
};

export const movePath = async (cwd: string, source: string, dest: string): Promise<{ sourcePath: string; destPath: string }> => {
  const sourcePath = resolveFsPath(cwd, validatePathArg(source, 'Invalid source path'));
  const destPath = resolveFsPath(cwd, validatePathArg(dest, 'Invalid destination path'));
  await copyRecursiveAbsolute(sourcePath, destPath);
  await removeRecursiveAbsolute(sourcePath);
  return { sourcePath, destPath };
};

export const statPath = async (cwd: string, requested: string): Promise<{ path: string; entry: FileEntry }> => {
  const targetPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid path'));
  const driver = await getDriver();
  const entry = await driver.stat(toFilePath(targetPath));
  return { path: targetPath, entry };
};

export const buildTree = async (cwd: string, requested = '.'): Promise<FsTreeNode> => {
  const rootPath = resolveFsPath(cwd, validatePathArg(requested, 'Invalid directory path'));
  const driver = await getDriver();

  const root = await driver.stat(toFilePath(rootPath));
  if (!root.isDirectory) {
    throw new Error(`Not a directory: ${requested}`);
  }

  const walk = async (dirPath: string, name: string): Promise<FsTreeNode> => {
    const entries = sortEntries(await driver.readdir(toDirectoryPath(dirPath)));
    const children = await Promise.all(
      entries.map(async (entry) => {
        const childPath = joinFsPath(dirPath, entry.name);
        if (!entry.isDirectory) {
          return { name: entry.name, path: childPath, isDirectory: false } as FsTreeNode;
        }
        return walk(childPath, entry.name);
      })
    );

    return {
      name,
      path: dirPath,
      isDirectory: true,
      children
    };
  };

  const rootName = basename(rootPath) || rootPath;
  return walk(rootPath, rootName);
};

export const treeText = async (cwd: string, requested = '.'): Promise<string> => {
  const tree = await buildTree(cwd, requested);
  const lines: string[] = [`${tree.name}/`];

  const walk = (node: FsTreeNode, prefix: string): void => {
    const children = node.children ?? [];
    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const branch = isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${branch}${child.name}${child.isDirectory ? '/' : ''}`);
      if (child.isDirectory) {
        walk(child, `${prefix}${isLast ? '    ' : '│   '}`);
      }
    });
  };

  walk(tree, '');
  return lines.join('\n');
};

const encodeDirectoryAbsolute = async (dirPath: string): Promise<BftDirectoryNode> => {
  const driver = await getDriver();
  const entries = sortEntries(await driver.readdir(toDirectoryPath(dirPath)));
  const encodedEntries: Record<string, import('./bft-transfer').BftNode> = {};

  for (const entry of entries) {
    const entryPath = joinFsPath(dirPath, entry.name);
    if (entry.isDirectory) {
      encodedEntries[entry.name] = await encodeDirectoryAbsolute(entryPath);
      continue;
    }
    const bytes = await driver.readFile(toFilePath(entryPath));
    encodedEntries[entry.name] = bytesToBftNode(bytes);
  }

  return {
    type: 'directory',
    entries: encodedEntries
  };
};

const decodeDirectoryAbsolute = async (node: BftDirectoryNode, destPath: string): Promise<void> => {
  const driver = await getDriver();
  await driver.mkdir(toDirectoryPath(destPath));

  for (const [name, child] of sortedEntries(node.entries)) {
    const childPath = joinFsPath(destPath, name);
    if (child.type === 'directory') {
      await decodeDirectoryAbsolute(child, childPath);
      continue;
    }
    await driver.writeFile(toFilePath(childPath), bftNodeToBytes(child));
  }
};

export const exportDirectoryAsBft = async (
  cwd: string,
  sourcePath = '.',
  outputPath?: string
): Promise<{ sourcePath: string; outputPath?: string; json: string }> => {
  const absoluteSourcePath = resolveFsPath(cwd, validatePathArg(sourcePath, 'Invalid source directory path'));
  const driver = await getDriver();
  const entry = await driver.stat(toFilePath(absoluteSourcePath));
  if (!entry.isDirectory) {
    throw new Error(`Not a directory: ${sourcePath}`);
  }

  const payload = await encodeDirectoryAbsolute(absoluteSourcePath);
  const json = stringifyBft(payload);

  if (!outputPath) {
    return {
      sourcePath: absoluteSourcePath,
      json
    };
  }

  const absoluteOutputPath = resolveFsPath(cwd, validatePathArg(outputPath, 'Invalid output file path'));
  await driver.writeFile(toFilePath(absoluteOutputPath), new TextEncoder().encode(json));
  return {
    sourcePath: absoluteSourcePath,
    outputPath: absoluteOutputPath,
    json
  };
};

export const importBftToLocation = async (
  cwd: string,
  bftFilePath: string,
  locationName: string
): Promise<{ bftFilePath: string; targetPath: string }> => {
  const absoluteBftPath = resolveFsPath(cwd, validatePathArg(bftFilePath, 'Invalid import file path'));
  const driver = await getDriver();

  const bftEntry = await driver.stat(toFilePath(absoluteBftPath));
  if (bftEntry.isDirectory) {
    throw new Error(`BFT input must be a file: ${bftFilePath}`);
  }

  const text = new TextDecoder().decode(await driver.readFile(toFilePath(absoluteBftPath)));
  const result = await importBftTextToLocation(cwd, text, locationName);

  return {
    bftFilePath: absoluteBftPath,
    targetPath: result.targetPath
  };
};

export const importBftTextToLocation = async (
  cwd: string,
  bftText: string,
  locationName: string
): Promise<{ targetPath: string }> => {
  const absoluteTargetPath = resolveFsPath(cwd, validatePathArg(locationName, 'Invalid import target path'));
  const driver = await getDriver();

  const exists = await driver.exists(toFilePath(absoluteTargetPath));
  if (exists) {
    throw new Error(`Target already exists: ${locationName}`);
  }

  const payload = parseBftJson(bftText);
  await decodeDirectoryAbsolute(payload, absoluteTargetPath);

  return {
    targetPath: absoluteTargetPath
  };
};
