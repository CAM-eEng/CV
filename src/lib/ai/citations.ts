export type CitationKey =
  | { type: 'work-highlight'; workIndex: number; highlightIndex: number }
  | { type: 'skill'; skillIndex: number }
  | { type: 'project'; projectIndex: number };

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPTS[Number(d)])
    .join('');
}

const KEY_RE = /^(work|skills|projects)\.(\d+)(?:\.([a-z]+)\.(\d+))?$/;

export function parseCitationKey(key: string): CitationKey | null {
  const m = key.match(KEY_RE);
  if (!m) return null;
  const [, top, idx1, _sub, idx2] = m;
  if (top === 'work' && _sub === 'highlights' && idx2 !== undefined) {
    return { type: 'work-highlight', workIndex: Number(idx1), highlightIndex: Number(idx2) };
  }
  if (top === 'skills' && _sub === undefined) {
    return { type: 'skill', skillIndex: Number(idx1) };
  }
  if (top === 'projects' && _sub === undefined) {
    return { type: 'project', projectIndex: Number(idx1) };
  }
  return null;
}

const BRACKET_RE = /\[([a-z]+(?:\.\d+)?(?:\.[a-z]+\.\d+)?)\]/g;

export function rewriteCitations(text: string): string {
  const seen = new Map<string, number>();
  let counter = 0;
  return text.replace(BRACKET_RE, (full, inner: string) => {
    const parsed = parseCitationKey(inner);
    if (!parsed) return full;
    let num = seen.get(inner);
    if (num === undefined) {
      counter += 1;
      num = counter;
      seen.set(inner, num);
    }
    const anchor = inner.replace(/\./g, '-');
    return `[${toSuperscript(num)}](/cv/#${anchor})`;
  });
}
