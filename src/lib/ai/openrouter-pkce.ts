export const CALLBACK_PATH = '/oauth/callback';
const AUTH_URL = 'https://openrouter.ai/auth';
const TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateVerifier(): string {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr).slice(0, 96);
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const enc = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return base64UrlEncode(new Uint8Array(hash));
}

export function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

export function buildAuthorizeUrl(opts: {
  callbackUrl: string;
  codeChallenge: string;
  state: string;
}): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set('callback_url', opts.callbackUrl);
  u.searchParams.set('code_challenge', opts.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', opts.state);
  return u.toString();
}

export async function exchangeCode(opts: { code: string; codeVerifier: string }): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: opts.code,
      code_verifier: opts.codeVerifier,
      code_challenge_method: 'S256',
    }),
  });
  if (!res.ok)
    throw new Error(`OpenRouter token exchange failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { key?: string; error?: string };
  if (!json.key) throw new Error('OpenRouter response missing key');
  return json.key;
}

// Storage for PKCE state across the redirect — sessionStorage so it survives the auth bounce.
const VERIFIER_KEY = 'openrouter-pkce-verifier';
const STATE_KEY = 'openrouter-pkce-state';

export function storePendingPkce(verifier: string, state: string): void {
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
}

export function readAndClearPendingPkce(): { verifier: string; state: string } | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!verifier || !state) return null;
  return { verifier, state };
}
