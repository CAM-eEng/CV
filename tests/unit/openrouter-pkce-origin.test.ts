import { describe, it, expect, afterEach } from 'vitest';
import { assertTrustedOrigin } from '~/lib/ai/openrouter-pkce';

const originalLocation = window.location;

function setHostname(host: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, hostname: host, origin: `https://${host}` },
  });
}

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

describe('assertTrustedOrigin', () => {
  it('allows cameronhartman.dev', () => {
    setHostname('cameronhartman.dev');
    expect(() => assertTrustedOrigin()).not.toThrow();
  });

  it('allows the GH Pages fallback host', () => {
    setHostname('cam-eeng.github.io');
    expect(() => assertTrustedOrigin()).not.toThrow();
  });

  it('allows localhost', () => {
    setHostname('localhost');
    expect(() => assertTrustedOrigin()).not.toThrow();
  });

  it('allows 127.0.0.1', () => {
    setHostname('127.0.0.1');
    expect(() => assertTrustedOrigin()).not.toThrow();
  });

  it('rejects an unknown hostname', () => {
    setHostname('evil.example.com');
    expect(() => assertTrustedOrigin()).toThrowError(/untrusted origin: evil\.example\.com/);
  });
});
