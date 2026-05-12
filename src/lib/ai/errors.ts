export type ProviderName = 'anthropic' | 'openai' | 'openrouter';

export function truncateError(body: string, max = 200): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max) + '...';
}

export function formatProviderError(provider: ProviderName, status: number, body: string): string {
  return `${provider} error (${status}): ${truncateError(body)}`;
}
