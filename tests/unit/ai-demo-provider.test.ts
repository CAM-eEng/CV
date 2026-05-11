import { describe, it, expect } from 'vitest';
import { DemoProvider } from '~/lib/ai/demo';

async function collect(stream: AsyncIterable<{ type: string; delta?: string }>) {
  const chunks: string[] = [];
  for await (const c of stream) {
    if (c.type === 'text' && c.delta) chunks.push(c.delta);
  }
  return chunks.join('');
}

describe('DemoProvider', () => {
  const provider = new DemoProvider();

  it('has id "demo"', () => {
    expect(provider.id).toBe('demo');
  });

  it('streams a canned answer about embedded experience', async () => {
    const text = await collect(
      provider.chat({
        messages: [{ role: 'user', content: 'Tell me about Cameron embedded experience' }],
      }),
    );
    expect(text.toLowerCase()).toMatch(/firmware|embedded|circuitpython|stm32/);
  });

  it('streams a canned answer about AI work', async () => {
    const text = await collect(
      provider.chat({
        messages: [{ role: 'user', content: 'has cameron worked with AI?' }],
      }),
    );
    expect(text.toLowerCase()).toMatch(/regression ai agent|snowflake|azure/);
  });

  it('falls back to a generic answer when no keyword matches', async () => {
    const text = await collect(
      provider.chat({
        messages: [{ role: 'user', content: 'asldkfjaslkdjfasdf' }],
      }),
    );
    expect(text.length).toBeGreaterThan(20);
  });

  it('emits a final "done" chunk', async () => {
    const events: string[] = [];
    for await (const c of provider.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      events.push(c.type);
    }
    expect(events.at(-1)).toBe('done');
  });

  it('respects AbortSignal mid-stream', async () => {
    const ctrl = new AbortController();
    const stream = provider.chat({
      messages: [{ role: 'user', content: 'hi' }],
      signal: ctrl.signal,
    });
    const iter = stream[Symbol.asyncIterator]();
    await iter.next(); // first chunk
    ctrl.abort();
    const next = await iter.next();
    expect(next.done || next.value?.type === 'done').toBeTruthy();
  });
});
