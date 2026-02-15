const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeUrl = (raw: string): string => {
  const value = raw.trim();
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:') || value.startsWith('#') || value.startsWith('/')) {
    return value;
  }
  return '#';
};

const renderInline = (input: string): string => {
  let out = escapeHtml(input);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, href: string) => {
    const safeHref = sanitizeUrl(href);
    return `<a href="${safeHref}" target="_blank" rel="noreferrer">${text}</a>`;
  });
  return out;
};

export const toMarkdownText = (content: string | Uint8Array): string =>
  typeof content === 'string' ? content : new TextDecoder().decode(content);

export const renderMarkdownHtml = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inCodeFence = false;
  let inList = false;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    html.push(`<p>${paragraphBuffer.join(' ')}</p>`);
    paragraphBuffer = [];
  };

  const closeList = () => {
    if (!inList) return;
    html.push('</ul>');
    inList = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushParagraph();
      closeList();
      if (!inCodeFence) {
        html.push('<pre><code>');
        inCodeFence = true;
      } else {
        html.push('</code></pre>');
        inCodeFence = false;
      }
      continue;
    }

    if (inCodeFence) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const marks = heading[1] ?? '#';
      const value = heading[2] ?? '';
      const level = marks.length;
      html.push(`<h${level}>${renderInline(value)}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^\s*[-*+]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(listItem[1] ?? '')}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote><p>${renderInline(quote[1] ?? '')}</p></blockquote>`);
      continue;
    }

    closeList();
    paragraphBuffer.push(renderInline(line.trim()));
  }

  flushParagraph();
  closeList();
  if (inCodeFence) html.push('</code></pre>');

  return html.join('\n');
};
