export const MAX_TEXT_INPUT_CHARS = 8000;
export const MAX_HISTORY_TURNS = 20;
export const MAX_CHAT_MESSAGES_PER_SESSION = 50;
export const MAX_JD_ANALYSES_PER_SESSION = 10;

const CHAT_KEY = 'cv.chat.count';
const JD_KEY = 'cv.jd.count';

function readCount(key: string): number {
  try {
    const raw = sessionStorage.getItem(key);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    /* private mode — silent */
  }
}

export function getChatCount(): number {
  return readCount(CHAT_KEY);
}

export function incChatCount(): number {
  const next = getChatCount() + 1;
  writeCount(CHAT_KEY, next);
  return next;
}

export function chatLimitReached(): boolean {
  return getChatCount() >= MAX_CHAT_MESSAGES_PER_SESSION;
}

export function getJDCount(): number {
  return readCount(JD_KEY);
}

export function incJDCount(): number {
  const next = getJDCount() + 1;
  writeCount(JD_KEY, next);
  return next;
}

export function jdLimitReached(): boolean {
  return getJDCount() >= MAX_JD_ANALYSES_PER_SESSION;
}

export function resetCounters(): void {
  try {
    sessionStorage.removeItem(CHAT_KEY);
    sessionStorage.removeItem(JD_KEY);
  } catch {
    /* private mode — silent */
  }
}

export function trimHistory<T>(messages: readonly T[], maxTurns = MAX_HISTORY_TURNS): T[] {
  const maxMessages = maxTurns * 2;
  if (messages.length <= maxMessages) return [...messages];
  // Align start to an even index so the slice always begins with a user turn.
  let start = messages.length - maxMessages;
  if (start % 2 !== 0) start -= 1;
  return messages.slice(start, start + maxMessages);
}
