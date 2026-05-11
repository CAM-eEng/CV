import { describe, it, expect } from 'vitest';
import { decodeJwtSub } from '~/lib/activity/htb';

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature_not_verified`;
}

describe('decodeJwtSub', () => {
  it('extracts sub when it is a numeric ID', () => {
    expect(decodeJwtSub(makeJwt({ sub: 12345 }))).toBe('12345');
  });

  it('extracts sub when it is a string', () => {
    expect(decodeJwtSub(makeJwt({ sub: 'user-abc' }))).toBe('user-abc');
  });

  it('falls back to id when sub is absent', () => {
    expect(decodeJwtSub(makeJwt({ id: 999 }))).toBe('999');
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwtSub('not.a.real.jwt.with.too.many.parts')).toBeNull();
    expect(decodeJwtSub('notajwt')).toBeNull();
  });

  it('returns null when the payload has neither sub nor id', () => {
    expect(decodeJwtSub(makeJwt({ random: 'thing' }))).toBeNull();
  });

  it('returns null when the payload is not valid JSON', () => {
    const bogus = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('not-json').toString('base64url')}.sig`;
    expect(decodeJwtSub(bogus)).toBeNull();
  });
});
