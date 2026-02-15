import {
  MarkdownEdit,
  MarkdownView,
  MarkdownViewEdit,
  registerDefaultMimeTypeHandlers,
  registerMimeTypeHandler
} from '@devalbo/ui';

export const registerDesktopMimeTypeHandlers = (): void => {
  // Start from shared defaults so desktop stays aligned with web/common behavior.
  registerDefaultMimeTypeHandlers();

  // Explicit desktop markdown registration point (safe override for future desktop-specific behavior).
  registerMimeTypeHandler('text/markdown', {
    preview: MarkdownView,
    edit: MarkdownEdit,
    viewEdit: MarkdownViewEdit
  });
};
