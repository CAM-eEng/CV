import { describe, it, expect } from 'vitest';
import { filter } from '~/lib/ai/moderation';

describe('moderation.filter', () => {
  it('passes safe text through unchanged', () => {
    const r = filter('Cameron worked on embedded firmware and AI agents at LitePoint Corp.');
    expect(r.safe).toBe(true);
    expect(r.sanitized).toBe(
      'Cameron worked on embedded firmware and AI agents at LitePoint Corp.',
    );
    expect(r.matched).toEqual([]);
  });

  it('does not false-positive on legitimate technical terms', () => {
    const legit = [
      'kill -9 to terminate a process',
      'SQL injection is an attack vector worth knowing',
      'this exploit has been patched',
      'null pointer dereference in C',
      'penetration testing methodology',
      'an attack surface analysis',
      'shoot for an SLA of 99.9%',
      'execute the script with sudo',
      'kill process with PID 1234',
    ];
    for (const t of legit) {
      const r = filter(t);
      expect(r.safe, `expected safe: "${t}"`).toBe(true);
      expect(r.sanitized).toBe(t);
    }
  });

  it('replaces blocklist matches with placeholder', () => {
    const blocked = 'this contains BLOCKED_TERM_FOR_TEST in the middle';
    const real = filter('blow up the building');
    expect(real.safe).toBe(false);
    expect(real.sanitized).toContain('[content blocked by site]');
    expect(real.matched.length).toBeGreaterThan(0);
    void blocked;
  });

  it('handles empty input', () => {
    const r = filter('');
    expect(r.safe).toBe(true);
    expect(r.sanitized).toBe('');
    expect(r.matched).toEqual([]);
  });

  it('is case-insensitive', () => {
    const r = filter('I will Blow Up the building');
    expect(r.safe).toBe(false);
    expect(r.sanitized).toContain('[content blocked by site]');
  });

  it('redacts every occurrence', () => {
    const r = filter('blow up here and blow up there');
    expect(r.safe).toBe(false);
    expect((r.sanitized.match(/\[content blocked by site\]/g) ?? []).length).toBe(2);
  });
});
