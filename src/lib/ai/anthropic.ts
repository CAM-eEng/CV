import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';
import { JD_RESPONSE_INSTRUCTION } from './jd-schema';
import { formatProviderError } from './errors';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    contextWindow: 200_000,
    supportsCaching: true,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    contextWindow: 200_000,
    supportsCaching: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    supportsCaching: true,
  },
];

export class AnthropicProvider implements AIProvider {
  id = 'anthropic' as const;
  displayName = 'Anthropic (direct key)';
  models = MODELS;
  defaultModel = 'claude-opus-4-7';

  private lastCached = 0;

  constructor(
    private apiKey: string,
    private systemPrompt: string = '',
  ) {}

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const body = {
      model: opts.model ?? this.defaultModel,
      max_tokens: 4096,
      stream: true,
      system: this.systemPrompt
        ? [{ type: 'text', text: this.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(formatProviderError('anthropic', res.status, txt));
    }

    let total = 0;
    for await (const ev of parseSSE(res.body!)) {
      if (ev.event === 'message_start') {
        const data = ev.data as
          | { message?: { usage?: { cache_read_input_tokens?: number } } }
          | undefined;
        const usage = data?.message?.usage;
        if (usage?.cache_read_input_tokens && usage.cache_read_input_tokens > 0) {
          this.lastCached = usage.cache_read_input_tokens;
          yield { type: 'cache-info', cachedTokens: usage.cache_read_input_tokens };
        }
      } else if (ev.event === 'content_block_delta') {
        const data = ev.data as { delta?: { type?: string; text?: string } } | undefined;
        const d = data?.delta;
        if (d?.type === 'text_delta' && typeof d.text === 'string') {
          total += d.text.length;
          yield { type: 'text', delta: d.text };
        }
      } else if (ev.event === 'message_stop') {
        yield { type: 'done', totalTokens: total };
        return;
      }
    }
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: [
          { role: 'user', content: opts.prompt },
          { role: 'user', content: JD_RESPONSE_INSTRUCTION },
        ],
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(formatProviderError('anthropic', res.status, await res.text()));
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return opts.schema.parse(JSON.parse(match[0]));
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

interface SSEEvent {
  event?: string;
  data?: unknown;
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncIterable<SSEEvent> {
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
      const ev: SSEEvent = {};
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) {
          try {
            ev.data = JSON.parse(line.slice(5).trim());
          } catch {
            /* ignore */
          }
        }
      }
      yield ev;
    }
  }
}
