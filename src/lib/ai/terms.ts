const KEY = 'ai-terms-accepted-v1';

export function hasAcceptedTerms(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(KEY) === 'yes';
}

export function acceptTerms(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, 'yes');
}

export function revokeTerms(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
