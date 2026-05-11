import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '~/lib/ai/openai';

function streamRes(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${ch}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());

describe('OpenAIProvider', () => {
  it('sends Authorization Bearer header', async () => {
    fetchSpy.mockResolvedValue(streamRes(['{}']));
    const p = new OpenAIProvider('sk-test');
    for await (const _chunk of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      void _chunk;
    }
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer sk-test');
  });

  it('decodes choices[0].delta.content chunks', async () => {
    fetchSpy.mockResolvedValue(
      streamRes([
        JSON.stringify({ choices: [{ delta: { content: 'Hello ' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'world' } }] }),
      ]),
    );
    const p = new OpenAIProvider('sk-x');
    let acc = '';
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text') acc += c.delta;
    }
    expect(acc).toBe('Hello world');
  });

  it('emits cache-info when usage.prompt_tokens_details.cached_tokens > 0', async () => {
    fetchSpy.mockResolvedValue(
      streamRes([
        JSON.stringify({
          choices: [{ delta: { content: 'x' } }],
          usage: { prompt_tokens_details: { cached_tokens: 1024 } },
        }),
      ]),
    );
    const p = new OpenAIProvider('sk-x');
    const events: Array<{ type: string; cachedTokens?: number }> = [];
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) events.push(c);
    expect(events.find((e) => e.type === 'cache-info')?.cachedTokens).toBe(1024);
  });

  it('throws on non-200', async () => {
    fetchSpy.mockResolvedValue(new Response('{"error":{"message":"bad"}}', { status: 401 }));
    const p = new OpenAIProvider('sk-bad');
    await expect(async () => {
      for await (const _chunk of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
        void _chunk;
      }
    }).rejects.toThrow(/bad/);
  });
});
