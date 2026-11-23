import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { safeErrorMessage } from '~/lib/activity/safe-error';
import { fetchHtbStats } from '~/lib/activity/htb';

afterEach(() => {
  vi.restoreAllMocks();
});

const env = { GH_API_TOKEN: 'ghp_supersecretvalue', HTB_API_TOKEN: 'htb.secret.jwt' };

describe('safeErrorMessage', () => {
  it('returns name + message for a plain Error, without stack or cause', () => {
    const e = new Error('GitHub repos request failed (HTTP 500)', {
      cause: { headers: { authorization: 'Bearer ghp_supersecretvalue' } },
    });
    const msg = safeErrorMessage(e, env);
    expect(msg).toBe('Error: GitHub repos request failed (HTTP 500)');
    expect(msg).not.toMatch(/at |authorization|ghp_/);
  });

  it('redacts secret env values and bearer tokens that leak into a message', () => {
    const msg = safeErrorMessage(
      new Error('oops ghp_supersecretvalue and htb.secret.jwt; authorization: Bearer abc.def'),
      env,
    );
    expect(msg).not.toMatch(/ghp_supersecretvalue|htb\.secret\.jwt|abc\.def/);
    expect(msg).toContain('[GH_API_TOKEN redacted]');
    expect(msg).toContain('Bearer [redacted]');
  });

  it('hides SyntaxError text, which quotes the unparsed body', () => {
    let err: unknown;
    try {
      JSON.parse('<html>upstream error page with details</html>');
    } catch (e) {
      err = e;
    }
    expect(safeErrorMessage(err, env)).toBe('response was not valid JSON');
  });

  it('summarizes ZodErrors by path and message, without input values', () => {
    const r = z.object({ rank: z.string().max(3) }).safeParse({ rank: 'leaky-value' });
    const msg = safeErrorMessage(r.error, env);
    expect(msg).toMatch(/^validation failed: rank: /);
    expect(msg).not.toContain('leaky-value');
  });

  it('caps length and handles non-Error throws', () => {
    expect(safeErrorMessage(new Error('x'.repeat(1000)), env).length).toBeLessThanOrEqual(301);
    expect(safeErrorMessage('a string with ghp_supersecretvalue', env)).toBe('unknown error');
  });
});

describe('fetchHtbStats errors', () => {
  it('reports the HTTP status only, not the response body or token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"message":"Unauthenticated.","detail":"echo of request"}', { status: 401 }),
    );
    const err = await fetchHtbStats({ token: 'htb.secret.jwt', userId: '1' }).catch((e) => e);
    expect(err.message).toBe('HTB profile request failed (HTTP 401)');
  });

  it('does not echo the body when the profile shape is unexpected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ profile: { rank: 12345, secret: 'x' } }), { status: 200 }),
    );
    const err = await fetchHtbStats({ token: 'htb.secret.jwt', userId: '1' }).catch((e) => e);
    expect(err.message).toBe('HTB profile response had an unexpected shape (HTTP 200)');
  });
});
