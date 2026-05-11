import { describe, it, expect, beforeEach } from 'vitest';
import { hasAcceptedTerms, acceptTerms, revokeTerms } from '~/lib/ai/terms';

describe('AI terms acceptance', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns false when nothing is stored', () => {
    expect(hasAcceptedTerms()).toBe(false);
  });

  it('returns true after acceptTerms()', () => {
    acceptTerms();
    expect(hasAcceptedTerms()).toBe(true);
  });

  it('revoke clears acceptance', () => {
    acceptTerms();
    revokeTerms();
    expect(hasAcceptedTerms()).toBe(false);
  });

  it('never writes to localStorage', () => {
    acceptTerms();
    expect(localStorage.length).toBe(0);
  });
});
