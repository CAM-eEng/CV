import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { OpenRouterProvider } from '~/lib/ai/openrouter';

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

let fetchSpy: MockInstance<typeof fetch>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());

describe('OpenRouterProvider', () => {
  it('targets openrouter.ai with Authorization Bearer', async () => {
    fetchSpy.mockResolvedValue(streamRes(['{}']));
    const p = new OpenRouterProvider('sk-or-tok');
    for await (const _chunk of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      void _chunk;
    }
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer sk-or-tok');
  });

  it('forwards the model id verbatim (OpenRouter uses prefixed IDs)', async () => {
    fetchSpy.mockResolvedValue(streamRes(['{}']));
    const p = new OpenRouterProvider('sk-or-x');
    for await (const _chunk of p.chat({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'anthropic/claude-opus-4-7',
    })) {
      void _chunk;
    }
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe('anthropic/claude-opus-4-7');
  });

  it('decodes content deltas like OpenAI', async () => {
    fetchSpy.mockResolvedValue(
      streamRes([
        JSON.stringify({ choices: [{ delta: { content: 'foo' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'bar' } }] }),
      ]),
    );
    const p = new OpenRouterProvider('sk-or-x');
    let acc = '';
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text') acc += c.delta;
    }
    expect(acc).toBe('foobar');
  });
});
