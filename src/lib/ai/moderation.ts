// Defense-in-depth content moderation. Narrow, word-boundary-anchored regex
// blocklist for severe slurs and explicit violence cues. This is NOT a content
// guarantee — it catches unambiguous severe cases only. The structural defense
// remains DOMPurify markup sanitization (src/lib/markdown/safe.tsx) and the
// system-prompt design. Keep this list short and avoid keyword-fuzzy entries.

export const PLACEHOLDER = '[content blocked by site]';

// Word-boundary anchored. The visible patterns target unambiguous violent
// imperative phrases that a recruiter-facing CV site should not surface even
// if a visitor wires up an uncensored model.
export const BLOCKLIST: readonly RegExp[] = [
  /\bblow\s+up\b/gi, // "blow up [target]"
  /\bgun\s+down\b/gi,
  /\bshoot\s+up\b/gi,
  /\bkill\s+(everyone|them all|all of them)\b/gi,
  /\bmake\s+a\s+bomb\b/gi,
  // Add severe slurs if/when needed; intentionally left off this list so the
  // codebase doesn't carry the literal strings. Add via a follow-up if a real
  // miss is observed.
];

export function filter(text: string): {
  safe: boolean;
  sanitized: string;
  matched: string[];
} {
  let sanitized = text;
  const matched: string[] = [];
  for (const re of BLOCKLIST) {
    sanitized = sanitized.replace(re, (m) => {
      matched.push(m);
      return PLACEHOLDER;
    });
  }
  return { safe: matched.length === 0, sanitized, matched };
}
