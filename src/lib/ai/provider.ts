export type ProviderId = 'openrouter' | 'anthropic' | 'openai' | 'demo';

export interface ModelInfo {
  id: string; // provider-native model id, e.g. 'claude-opus-4-7'
  label: string; // human-friendly name
  contextWindow: number; // tokens
  supportsCaching: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatChunk =
  | { type: 'text'; delta: string }
  | { type: 'cache-info'; cachedTokens: number }
  | { type: 'done'; totalTokens: number };

export interface ChatOpts {
  messages: ChatMessage[];
  model?: string; // defaults to provider's default
  signal?: AbortSignal;
}

export interface StructuredOpts<T> {
  prompt: string;
  schema: import('zod').ZodSchema<T>;
  model?: string;
  signal?: AbortSignal;
}

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  models: ModelInfo[];
  defaultModel: string;

  chat(opts: ChatOpts): AsyncIterable<ChatChunk>;
  structured<T>(opts: StructuredOpts<T>): Promise<T>;

  /**
   * Number of tokens that were cache-hit on the most recent call.
   * Returns 0 if caching wasn't used or no calls have been made.
   */
  lastCachedTokens(): number;
}
