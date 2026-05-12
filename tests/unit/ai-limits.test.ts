import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MAX_TEXT_INPUT_CHARS,
  MAX_HISTORY_TURNS,
  MAX_CHAT_MESSAGES_PER_SESSION,
  MAX_JD_ANALYSES_PER_SESSION,
  incChatCount,
  getChatCount,
  chatLimitReached,
  incJDCount,
  getJDCount,
  jdLimitReached,
  trimHistory,
  resetCounters,
} from '~/lib/ai/limits';

beforeEach(() => {
  sessionStorage.clear();
});

describe('constants', () => {
  it('exposes the agreed-upon caps', () => {
    expect(MAX_TEXT_INPUT_CHARS).toBe(8000);
    expect(MAX_HISTORY_TURNS).toBe(20);
    expect(MAX_CHAT_MESSAGES_PER_SESSION).toBe(50);
    expect(MAX_JD_ANALYSES_PER_SESSION).toBe(10);
  });
});

describe('chat counter', () => {
  it('starts at 0', () => {
    expect(getChatCount()).toBe(0);
    expect(chatLimitReached()).toBe(false);
  });

  it('inc returns the new value and persists', () => {
    expect(incChatCount()).toBe(1);
    expect(incChatCount()).toBe(2);
    expect(getChatCount()).toBe(2);
  });

  it('chatLimitReached flips at the cap', () => {
    for (let i = 0; i < MAX_CHAT_MESSAGES_PER_SESSION; i++) incChatCount();
    expect(chatLimitReached()).toBe(true);
  });

  it('returns 0 when sessionStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getChatCount()).toBe(0);
    spy.mockRestore();
  });
});

describe('jd counter', () => {
  it('matches chat semantics', () => {
    expect(getJDCount()).toBe(0);
    expect(incJDCount()).toBe(1);
    expect(getJDCount()).toBe(1);
    for (let i = 0; i < MAX_JD_ANALYSES_PER_SESSION - 1; i++) incJDCount();
    expect(jdLimitReached()).toBe(true);
  });
});

describe('resetCounters', () => {
  it('clears both', () => {
    incChatCount();
    incJDCount();
    resetCounters();
    expect(getChatCount()).toBe(0);
    expect(getJDCount()).toBe(0);
  });
});

describe('trimHistory', () => {
  const turns = (n: number) =>
    Array.from({ length: n * 2 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `msg ${i}`,
    }));

  it('returns the input unchanged when under the cap', () => {
    const msgs = turns(5);
    expect(trimHistory(msgs, 20)).toEqual(msgs);
  });

  it('trims to the most recent maxTurns turns when over', () => {
    const msgs = turns(25); // 50 messages
    const out = trimHistory(msgs, 20); // 40 messages
    expect(out).toHaveLength(40);
    expect(out[0].content).toBe('msg 10');
    expect(out[out.length - 1].content).toBe('msg 49');
  });

  it('preserves message alternation when the boundary is odd', () => {
    const msgs = Array.from({ length: 11 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `m${i}`,
    }));
    const out = trimHistory(msgs, 3); // last 3 turns = 6 messages
    expect(out).toHaveLength(6);
    expect(out[0].role).toBe('user');
  });

  it('returns empty when given empty', () => {
    expect(trimHistory([], 20)).toEqual([]);
  });
});

afterEach(() => {
  sessionStorage.clear();
});
