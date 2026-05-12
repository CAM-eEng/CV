import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';
import { JD_RESPONSE_INSTRUCTION } from './jd-schema';
import { formatProviderError } from './errors';

const API_URL = 'https://api.openai.com/v1/chat/completions';

const MODELS: ModelInfo[] = [
  { id: 'gpt-5', label: 'GPT-5', contextWindow: 200_000, supportsCaching: true },
  { id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128_000, supportsCaching: true },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', contextWindow: 128_000, supportsCaching: true },
];

interface OpenAIStreamEvent {
  choices?: Array<{
    delta?: { content?: string };
  }>;
  usage?: {
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

interface OpenAIStructuredResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenAIProvider implements AIProvider {
  id = 'openai' as const;
  displayName = 'OpenAI (direct key)';
  models = MODELS;
  defaultModel = 'gpt-4o';

  private lastCached = 0;

  constructor(
    private apiKey: string,
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
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        stream: true,
        stream_options: { include_usage: true },
        messages,
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(formatProviderError('openai', res.status, await res.text()));

    let total = 0;
    for await (const ev of parseOpenAISSE(res.body!)) {
      const delta = ev.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        total += delta.length;
        yield { type: 'text', delta };
      }
      const cached = ev.usage?.prompt_tokens_details?.cached_tokens;
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
        authorization: `Bearer ${this.apiKey}`,
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
    if (!res.ok) throw new Error(formatProviderError('openai', res.status, await res.text()));
    const json = (await res.json()) as OpenAIStructuredResponse;
    const content = json.choices?.[0]?.message?.content ?? '{}';
    return opts.schema.parse(JSON.parse(content));
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

async function* parseOpenAISSE(body: ReadableStream<Uint8Array>): AsyncIterable<OpenAIStreamEvent> {
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
            yield JSON.parse(payload) as OpenAIStreamEvent;
          } catch {
            /* skip */
          }
        }
      }
    }
  }
}
