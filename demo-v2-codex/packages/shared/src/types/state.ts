export interface FileTreeRow {
  path: string;
  name: string;
  parentPath: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
}

export interface EditorBufferRow {
  path: string;
  content: string;
  isDirty: boolean;
  cursorLine: number;
  cursorCol: number;
}
