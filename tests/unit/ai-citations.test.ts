import { describe, it, expect } from 'vitest';
import { rewriteCitations, parseCitationKey } from '~/lib/ai/citations';

describe('parseCitationKey', () => {
  it('parses work-highlight keys', () => {
    expect(parseCitationKey('work.0.highlights.2')).toEqual({
      type: 'work-highlight',
      workIndex: 0,
      highlightIndex: 2,
    });
  });

  it('parses skill keys', () => {
    expect(parseCitationKey('skills.3')).toEqual({ type: 'skill', skillIndex: 3 });
  });

  it('returns null for unknown shapes', () => {
    expect(parseCitationKey('garbage')).toBeNull();
    expect(parseCitationKey('work.0')).toBeNull();
  });
});

describe('rewriteCitations', () => {
  it('replaces bracketed keys with markdown anchors', () => {
    const out = rewriteCitations(
      'Built X [work.0.highlights.1] and shipped Y [work.0.highlights.2].',
    );
    expect(out).toContain('[¹](/cv/#work-0-highlights-1)');
    expect(out).toContain('[²](/cv/#work-0-highlights-2)');
  });

  it('numbers citations in document order, deduping repeats', () => {
    const out = rewriteCitations('[work.0.highlights.0] and again [work.0.highlights.0].');
    expect(out.match(/¹/g)?.length).toBe(2);
    expect(out).not.toContain('²');
  });

  it('leaves unrelated bracket-like text alone', () => {
    const out = rewriteCitations('Square brackets [like this] should stay.');
    expect(out).toContain('[like this]');
  });
});
