import type React from 'react';

export type FileContent = string | Uint8Array;

export interface FileHandlerBaseProps {
  path: string;
  mimeType: string;
}

export interface FilePreviewProps extends FileHandlerBaseProps {
  content: FileContent;
}

export interface FileEditProps extends FileHandlerBaseProps {
  content: FileContent;
  onSave: (nextContent: FileContent) => Promise<void> | void;
}

export type FilePreviewHandler = React.ComponentType<FilePreviewProps>;
export type FileEditHandler = React.ComponentType<FileEditProps>;

export interface MimeTypeHandler {
  preview?: FilePreviewHandler;
  edit?: FileEditHandler;
  viewEdit?: FileEditHandler;
}

export interface ResolvedMimeTypeHandler extends MimeTypeHandler {
  pattern: string;
}
