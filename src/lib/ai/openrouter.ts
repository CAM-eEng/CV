import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';
import { JD_RESPONSE_INSTRUCTION } from './jd-schema';
import { formatProviderError } from './errors';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS: ModelInfo[] = [
  {
    id: 'google/gemini-2.5-flash-lite:free',
    label: 'Gemini 2.5 Flash Lite (free)',
    contextWindow: 1_000_000,
    supportsCaching: false,
  },
  {
    id: 'anthropic/claude-opus-4-7',
    label: 'Claude Opus 4.7',
    contextWindow: 200_000,
    supportsCaching: true,
  },
  { id: 'openai/gpt-5', label: 'GPT-5', contextWindow: 200_000, supportsCaching: true },
];

interface OpenRouterStreamEvent {
  choices?: Array<{
    delta?: { content?: string };
  }>;
  usage?: {
    prompt_tokens_details?: { cached_tokens?: number };
    cache_tokens?: number;
  };
}

interface OpenRouterStructuredResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenRouterProvider implements AIProvider {
  id = 'openrouter' as const;
  displayName = 'OpenRouter';
  models = MODELS;
  defaultModel = 'google/gemini-2.5-flash-lite:free';

  private lastCached = 0;

  constructor(
    private token: string,
    private systemPrompt: string = '',
  ) {}

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const messages: Array<{ role: string; content: string }> = [];
    if (this.systemPrompt) messages.push({ role: 'system', content: this.systemPrompt });
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
        'HTTP-Referer': 'https://cameronhartman.dev',
        'X-Title': 'Cameron Hartman CV',
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        stream: true,
        messages,
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(formatProviderError('openrouter', res.status, await res.text()));

    let total = 0;
    for await (const ev of parseOpenRouterSSE(res.body!)) {
      const delta = ev.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        total += delta.length;
        yield { type: 'text', delta };
      }
      const cached = ev.usage?.prompt_tokens_details?.cached_tokens ?? ev.usage?.cache_tokens;
      if (typeof cached === 'number' && cached > 0) {
        this.lastCached = cached;
        yield { type: 'cache-info', cachedTokens: cached };
      }
    }
    yield { type: 'done', totalTokens: total };
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    const systemMessage = [this.systemPrompt, JD_RESPONSE_INSTRUCTION].filter(Boolean).join('\n\n');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
        'HTTP-Referer': 'https://cameronhartman.dev',
        'X-Title': 'Cameron Hartman CV',
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: opts.prompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(formatProviderError('openrouter', res.status, await res.text()));
    const json = (await res.json()) as OpenRouterStructuredResponse;
    const content = json.choices?.[0]?.message?.content ?? '{}';
    return opts.schema.parse(JSON.parse(content));
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

async function* parseOpenRouterSSE(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<OpenRouterStreamEvent> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') return;
          try {
            yield JSON.parse(payload) as OpenRouterStreamEvent;
          } catch {
            /* skip */
          }
        }
      }
    }
  }
}
