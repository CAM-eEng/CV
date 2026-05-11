import type { AIProvider } from './provider';
import { readSession } from './session';
import { DemoProvider } from './demo';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';

export function getActiveProvider(systemPrompt: string): AIProvider {
  const s = readSession();
  if (!s) return new DemoProvider();
  switch (s.providerId) {
    case 'anthropic':
      return new AnthropicProvider(s.token, systemPrompt);
    case 'openai':
      return new OpenAIProvider(s.token, systemPrompt);
    case 'openrouter':
      return new OpenRouterProvider(s.token, systemPrompt);
    case 'demo':
      return new DemoProvider();
  }
}
