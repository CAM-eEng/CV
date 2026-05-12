const KEY = 'ai-terms-accepted-v1';
const EVENT_NAME = 'cv:terms-changed';

export function hasAcceptedTerms(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(KEY) === 'yes';
}

export function acceptTerms(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, 'yes');
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function revokeTerms(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export const TERMS_CHANGED_EVENT = EVENT_NAME;
