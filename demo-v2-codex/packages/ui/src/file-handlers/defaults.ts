import {
  areDefaultMimeHandlersRegistered,
  markDefaultMimeHandlersRegistered,
  registerMimeTypeHandler
} from './registry';
import { ImageFilePreview } from './image-file-preview';
import { TextFileViewEdit } from './text-file-view-edit';

export const registerDefaultMimeTypeHandlers = (): void => {
  if (areDefaultMimeHandlersRegistered()) return;

  registerMimeTypeHandler('text/*', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('application/json', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('application/xml', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('application/javascript', { viewEdit: TextFileViewEdit });
  registerMimeTypeHandler('image/*', { preview: ImageFilePreview });

  markDefaultMimeHandlersRegistered();
};
