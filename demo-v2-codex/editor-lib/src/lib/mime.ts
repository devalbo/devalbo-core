const extensionToMime: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  js: 'application/javascript',
  ts: 'application/typescript',
  jsx: 'text/jsx',
  tsx: 'text/tsx',
  css: 'text/css',
  html: 'text/html',
  csv: 'text/csv',
  yml: 'text/yaml',
  yaml: 'text/yaml',
  log: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon'
};

export const inferMimeTypeFromPath = (targetPath: string): string => {
  const lastDot = targetPath.lastIndexOf('.');
  if (lastDot < 0 || lastDot === targetPath.length - 1) return 'application/octet-stream';
  const extension = targetPath.slice(lastDot + 1).toLowerCase();
  return extensionToMime[extension] ?? 'application/octet-stream';
};

export const mimePrefersText = (mimeType: string): boolean => {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith('text/')) return true;
  return normalized === 'application/json' ||
    normalized === 'application/xml' ||
    normalized === 'application/javascript' ||
    normalized === 'image/svg+xml';
};
