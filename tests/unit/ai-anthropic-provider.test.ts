import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { AnthropicProvider } from '~/lib/ai/anthropic';
import { z } from 'zod';

const ssEvent = (event: string, data: object) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function makeStreamResponse(events: string[]): Response {
  const body = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      for (const e of events) controller.enqueue(enc.encode(e));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());

describe('AnthropicProvider', () => {
  it('sends API key in x-api-key header and dangerous-browser header', async () => {
    fetchSpy.mockResolvedValue(
      makeStreamResponse([
        ssEvent('message_start', { message: { usage: { cache_read_input_tokens: 0 } } }),
        ssEvent('message_stop', {}),
      ]),
    );
    const p = new AnthropicProvider('sk-ant-test123');
    for await (const _chunk of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      void _chunk;
    }
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test123');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['anthropic-version']).toBeTruthy();
  });

  it('decodes content_block_delta chunks into text', async () => {
    fetchSpy.mockResolvedValue(
      makeStreamResponse([
        ssEvent('content_block_delta', { delta: { type: 'text_delta', text: 'Hello ' } }),
        ssEvent('content_block_delta', { delta: { type: 'text_delta', text: 'world' } }),
        ssEvent('message_stop', {}),
      ]),
    );
    const p = new AnthropicProvider('sk-ant-x');
    let acc = '';
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text') acc += c.delta;
    }
    expect(acc).toBe('Hello world');
  });

  it('emits cache-info when cache_read_input_tokens > 0', async () => {
    fetchSpy.mockResolvedValue(
      makeStreamResponse([
        ssEvent('message_start', {
          message: { usage: { cache_read_input_tokens: 24891, input_tokens: 50 } },
        }),
        ssEvent('message_stop', {}),
      ]),
    );
    const p = new AnthropicProvider('sk-ant-x');
    const events: Array<{ type: string; cachedTokens?: number }> = [];
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      events.push(c);
    }
    const cache = events.find((e) => e.type === 'cache-info');
    expect(cache?.cachedTokens).toBe(24891);
  });

  it('throws on non-200 response with the API error body', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }),
    );
    const p = new AnthropicProvider('sk-ant-bad');
    await expect(async () => {
      for await (const _chunk of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
        void _chunk;
      }
    }).rejects.toThrow(/bad key/);
  });
});

describe('AnthropicProvider.structured — injection-resistant shape', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ text: '{"ok":true}' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends two user messages: body, then response instruction', async () => {
    const p = new AnthropicProvider('test-key', 'system text');
    await p.structured({ prompt: 'BODY_HERE', schema: z.object({ ok: z.boolean() }) });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: 'user', content: 'BODY_HERE' });
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toMatch(/JSON/);
    expect(body.messages[1].content).not.toContain('BODY_HERE');
  });

  it('uses formatProviderError on non-OK responses', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    const p = new AnthropicProvider('test-key', '');
    await expect(
      p.structured({ prompt: 'x', schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toThrowError(/^anthropic error \(429\): rate limited$/);
  });

  it('chat() uses formatProviderError on non-OK responses', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('server boom', { status: 500 }));
    const p = new AnthropicProvider('test-key', '');
    const it = p.chat({ messages: [{ role: 'user', content: 'hi' }] });
    await expect(it[Symbol.asyncIterator]().next()).rejects.toThrowError(
      /^anthropic error \(500\): server boom$/,
    );
  });
});
