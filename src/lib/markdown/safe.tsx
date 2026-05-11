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

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Use tagName check (cross-realm safe) instead of instanceof, which fails
  // when DOMPurify's jsdom realm differs from the test/runtime realm.
  if (node.nodeName === 'A') {
    (node as Element).setAttribute('rel', 'noopener noreferrer');
    if ((node as Element).getAttribute('target') === '_blank') {
      // keep target, rel already set
    }
  }
});

export function SafeMarkdown({ content }: { content: string }) {
  const rawHtml = marked.parse(content, { async: false }) as string;
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  return (
    <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
