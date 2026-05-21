import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveProvider } from '~/lib/ai/registry';
import { writeSession, clearSession } from '~/lib/ai/session';
import { AnthropicProvider } from '~/lib/ai/anthropic';
import { OpenAIProvider } from '~/lib/ai/openai';
import { OpenRouterProvider } from '~/lib/ai/openrouter';

describe('getActiveProvider', () => {
  beforeEach(() => {
    clearSession();
    sessionStorage.clear();
  });

  it('throws when no session is set', () => {
    expect(() => getActiveProvider('')).toThrow(/No active provider session/);
  });

  it('throws when sessionStorage holds an unknown providerId', () => {
    // Simulates a stale session — readSession() silently rejects it, so
    // getActiveProvider sees no session and throws via the no-session path.
    sessionStorage.setItem(
      'byok-session',
      JSON.stringify({ providerId: 'xyz', token: 'x', model: 'y' }),
    );
    expect(() => getActiveProvider('')).toThrow(/No active provider session/);
  });

  it('returns AnthropicProvider for an anthropic session', () => {
    writeSession({ providerId: 'anthropic', token: 'sk-ant-x', model: 'claude-opus-4-7' });
    const p = getActiveProvider('sys');
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it('returns OpenAIProvider for an openai session', () => {
    writeSession({ providerId: 'openai', token: 'sk-x', model: 'gpt-4o' });
    expect(getActiveProvider('sys')).toBeInstanceOf(OpenAIProvider);
  });

  it('returns OpenRouterProvider for an openrouter session', () => {
    writeSession({
      providerId: 'openrouter',
      token: 'sk-or-x',
      model: 'anthropic/claude-opus-4-7',
    });
    expect(getActiveProvider('sys')).toBeInstanceOf(OpenRouterProvider);
  });
});
