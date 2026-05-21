import type { ProviderId } from './provider';

const KEY = 'byok-session';
const SESSION_CHANGED_EVENT = 'cv:session-changed';
const REQUEST_CONNECT_EVENT = 'cv:request-connect';
// Keep in sync with ProviderId in ./provider.ts
const VALID_PROVIDER_IDS: readonly ProviderId[] = ['openrouter', 'anthropic', 'openai'];

export interface Session {
  providerId: ProviderId;
  token: string;
  model: string;
}

export function readSession(): Session | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.providerId || typeof parsed.token !== 'string' || !parsed.model) return null;
    if (!VALID_PROVIDER_IDS.includes(parsed.providerId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export function clearSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export { SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT };
