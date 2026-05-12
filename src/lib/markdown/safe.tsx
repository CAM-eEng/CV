import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'code',
  'pre',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'sup',
  'sub',
];
const ALLOWED_ATTR = ['href', 'title', 'rel', 'target'];

// Explicit href scheme allowlist. Closes javascript:, data:, vbscript:,
// file:, etc. by name rather than by DOMPurify's default URI sanitizer.
// Also allows relative URLs (starting with /, ./, ../, or #).
const ALLOWED_URI_REGEXP = /^(?:https?|mailto):|^[/#.]/i;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // tagName check is cross-realm safe (jsdom vs runtime realms).
  if (node.nodeName === 'A') {
    (node as Element).setAttribute('rel', 'noopener noreferrer');
  }
});

export function SafeMarkdown({ content }: { content: string }) {
  const rawHtml = marked.parse(content, { async: false }) as string;
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP,
  });
  return (
    <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
