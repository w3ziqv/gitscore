import { describe, it, expect, vi, afterEach } from 'vitest';
import { isBearerTokenValid, isSafeWebhookUrl } from '../src/lib/webhook.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isBearerTokenValid', () => {
  it('rejects everything when no env secret is configured', () => {
    vi.stubEnv('WEBHOOK_SUB_TOKEN', '');
    expect(isBearerTokenValid('a'.repeat(32))).toBe(false);
    expect(isBearerTokenValid(undefined)).toBe(false);
  });

  it('accepts only the configured secret', () => {
    vi.stubEnv('WEBHOOK_SUB_TOKEN', 'super-secret-token-1234567890');
    expect(isBearerTokenValid('super-secret-token-1234567890')).toBe(true);
    expect(isBearerTokenValid('super-secret-token-1234567890X')).toBe(false);
    expect(isBearerTokenValid('a'.repeat(32))).toBe(false);
    expect(isBearerTokenValid('')).toBe(false);
  });
});

describe('isSafeWebhookUrl', () => {
  it('accepts public https URLs', async () => {
    expect(await isSafeWebhookUrl('https://example.com/hook')).toBe(true);
    expect(await isSafeWebhookUrl('https://example.com:8443/hook?x=1')).toBe(true);
  });

  it('rejects non-https schemes', async () => {
    expect(await isSafeWebhookUrl('http://example.com/hook')).toBe(false);
    expect(await isSafeWebhookUrl('ftp://example.com/hook')).toBe(false);
    expect(await isSafeWebhookUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects URLs with embedded credentials', async () => {
    expect(await isSafeWebhookUrl('https://user:pass@example.com/hook')).toBe(false);
  });

  it('rejects localhost and private host names', async () => {
    expect(await isSafeWebhookUrl('https://localhost:8443/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://foo.localhost/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://foo.local/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://foo.internal/hook')).toBe(false);
  });

  it('rejects private, loopback, link-local and CGNAT addresses', async () => {
    expect(await isSafeWebhookUrl('https://127.0.0.1/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://10.0.0.1/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://172.16.0.1/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://192.168.1.1/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(await isSafeWebhookUrl('https://100.64.0.1/hook')).toBe(false);
    expect(await isSafeWebhookUrl('https://[::1]/hook')).toBe(false);
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    // localtest.me is a well-known DNS alias for 127.0.0.1
    expect(await isSafeWebhookUrl('https://localtest.me/hook')).toBe(false);
  });

  it('rejects unresolvable hostnames', async () => {
    expect(await isSafeWebhookUrl('https://this-host-does-not-exist-abc123.invalid/hook')).toBe(false);
  });
});
