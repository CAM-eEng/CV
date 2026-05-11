import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import {
  generateVerifier,
  challengeFromVerifier,
  buildAuthorizeUrl,
  exchangeCode,
  CALLBACK_PATH,
} from '~/lib/ai/openrouter-pkce';

describe('PKCE helpers', () => {
  it('generates a verifier between 43 and 128 chars', () => {
    const v = generateVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('derives a deterministic S256 challenge', async () => {
    const v = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const c1 = await challengeFromVerifier(v);
    const c2 = await challengeFromVerifier(v);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds authorize URL with the right params', () => {
    const url = buildAuthorizeUrl({
      callbackUrl: 'https://cameronhartman.dev/oauth/callback',
      codeChallenge: 'CHAL',
      state: 'STATE123',
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://openrouter.ai/auth');
    expect(u.searchParams.get('callback_url')).toBe('https://cameronhartman.dev/oauth/callback');
    expect(u.searchParams.get('code_challenge')).toBe('CHAL');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe('STATE123');
  });

  it('CALLBACK_PATH is /oauth/callback', () => {
    expect(CALLBACK_PATH).toBe('/oauth/callback');
  });

  describe('exchangeCode', () => {
    let fetchSpy: MockInstance<typeof fetch>;
    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });
    afterEach(() => fetchSpy.mockRestore());

    it('POSTs code + code_verifier to the token endpoint', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ key: 'sk-or-***' }), { status: 200 }),
      );
      const token = await exchangeCode({ code: 'AUTH_CODE', codeVerifier: 'V' });
      expect(token).toBe('sk-or-***');
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.code).toBe('AUTH_CODE');
      expect(body.code_verifier).toBe('V');
      expect(body.code_challenge_method).toBe('S256');
    });

    it('throws on non-200', async () => {
      fetchSpy.mockResolvedValue(new Response('{"error":"bad"}', { status: 400 }));
      await expect(exchangeCode({ code: 'X', codeVerifier: 'Y' })).rejects.toThrow();
    });
  });
});
