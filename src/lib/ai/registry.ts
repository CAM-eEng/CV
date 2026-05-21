import type { AIProvider } from './provider';
import { readSession } from './session';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';

export function getActiveProvider(systemPrompt: string): AIProvider {
  const s = readSession();
  if (!s) throw new Error('No active provider session — connect a provider first.');
  switch (s.providerId) {
    case 'anthropic':
      return new AnthropicProvider(s.token, systemPrompt);
    case 'openai':
      return new OpenAIProvider(s.token, systemPrompt);
    case 'openrouter':
      return new OpenRouterProvider(s.token, systemPrompt);
  }
}
