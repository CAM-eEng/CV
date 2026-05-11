import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { AnthropicProvider } from '~/lib/ai/anthropic';

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
