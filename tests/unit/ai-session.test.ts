import { describe, it, expect, beforeEach } from 'vitest';
import { readSession, writeSession, clearSession, type Session } from '~/lib/ai/session';

describe('BYOK session storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(readSession()).toBeNull();
  });

  it('round-trips a session', () => {
    const s: Session = { providerId: 'anthropic', token: 'sk-ant-***', model: 'claude-opus-4-7' };
    writeSession(s);
    expect(readSession()).toEqual(s);
  });

  it('clear removes the session', () => {
    writeSession({ providerId: 'demo', token: '', model: 'demo' });
    clearSession();
    expect(readSession()).toBeNull();
  });

  it('never writes to localStorage', () => {
    writeSession({ providerId: 'openai', token: 'sk-***', model: 'gpt-4o' });
    expect(localStorage.length).toBe(0);
  });

  it('returns null on corrupted JSON', () => {
    sessionStorage.setItem('byok-session', '{not valid json');
    expect(readSession()).toBeNull();
  });
});
