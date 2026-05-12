import { describe, it, expect } from 'vitest';
import { truncateError, formatProviderError } from '~/lib/ai/errors';

describe('truncateError', () => {
  it('returns short input unchanged', () => {
    expect(truncateError('short error')).toBe('short error');
  });

  it('truncates at max with ellipsis indicator', () => {
    const body = 'a'.repeat(500);
    const got = truncateError(body, 200);
    expect(got.length).toBeLessThanOrEqual(204); // 200 + '...'
    expect(got.startsWith('a'.repeat(200))).toBe(true);
    expect(got.endsWith('...')).toBe(true);
  });

  it('replaces newlines with spaces before truncation', () => {
    expect(truncateError('line1\nline2\nline3')).toBe('line1 line2 line3');
  });

  it('collapses runs of whitespace introduced by newline replacement', () => {
    expect(truncateError('a\n\n\nb')).toBe('a b');
  });

  it('handles empty input', () => {
    expect(truncateError('')).toBe('');
  });

  it('honours custom max', () => {
    expect(truncateError('abcdefghij', 5)).toBe('abcde...');
  });
});

describe('formatProviderError', () => {
  it('shapes the message consistently', () => {
    expect(formatProviderError('anthropic', 429, 'rate limit exceeded')).toBe(
      'anthropic error (429): rate limit exceeded',
    );
  });

  it('truncates the body', () => {
    const body = 'x'.repeat(500);
    const got = formatProviderError('openai', 500, body);
    expect(got.length).toBeLessThanOrEqual('openai error (500): '.length + 204);
    expect(got.endsWith('...')).toBe(true);
  });
});
