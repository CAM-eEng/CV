import { ZodError } from 'zod';

const MAX_LEN = 300;
const SECRET_ENV = ['GH_API_TOKEN', 'HTB_API_TOKEN', 'HTB_USER_ID'] as const;

/**
 * Turn any thrown value into a short, log-safe one-line message.
 *
 * The refresh job's logs are public (GitHub Actions on a public repo), so:
 * - never the error object itself, its stack, or its `cause` chain;
 * - SyntaxError → fixed text (JSON.parse messages quote the unparsed body);
 * - ZodError → issue paths + messages only (zod doesn't include input values);
 * - any secret env value or `Bearer …` token that somehow appears is redacted;
 * - capped at MAX_LEN characters.
 */
export function safeErrorMessage(e: unknown, env: NodeJS.ProcessEnv = process.env): string {
  let msg: string;
  if (e instanceof ZodError) {
    const issues = e.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    const more = e.issues.length > 5 ? ` (+${e.issues.length - 5} more)` : '';
    msg = `validation failed: ${issues}${more}`;
  } else if (e instanceof SyntaxError) {
    msg = 'response was not valid JSON';
  } else if (e instanceof Error) {
    msg = `${e.name}: ${e.message}`;
  } else {
    msg = 'unknown error';
  }

  for (const name of SECRET_ENV) {
    const v = env[name];
    if (v && v.length >= 4) msg = msg.split(v).join(`[${name} redacted]`);
  }
  msg = msg.replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]');
  msg = msg.replace(/\s+/g, ' ').trim();
  return msg.length > MAX_LEN ? `${msg.slice(0, MAX_LEN)}…` : msg;
}
