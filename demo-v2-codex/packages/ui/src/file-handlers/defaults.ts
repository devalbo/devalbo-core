import {
  areDefaultMimeHandlersRegistered,
  markDefaultMimeHandlersRegistered,
  registerMimeTypeHandler
} from './registry';
import { ImageFilePreview } from './image-file-preview';
import { MarkdownEdit } from './markdown-edit';
import { MarkdownView } from './markdown-view';
import { MarkdownViewEdit } from './markdown-view-edit';
import { TextFileViewEdit } from './text-file-view-edit';

export const registerDefaultMimeTypeHandlers = (): void => {
  if (areDefaultMimeHandlersRegistered()) return;

  registerMimeTypeHandler('text/*', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('text/markdown', {
    preview: MarkdownView,
    edit: MarkdownEdit,
    viewEdit: MarkdownViewEdit
  });
  registerMimeTypeHandler('application/json', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('application/xml', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('application/javascript', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('image/*', { preview: ImageFilePreview });

  markDefaultMimeHandlersRegistered();
};
