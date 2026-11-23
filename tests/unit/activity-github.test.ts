import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { fetchGithubActivity } from '~/lib/activity/github';

let fetchSpy: MockInstance<typeof fetch>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());

const ok = (body: object) => new Response(JSON.stringify(body), { status: 200 });

describe('fetchGithubActivity', () => {
  it('sends Authorization Bearer token', async () => {
    fetchSpy.mockResolvedValue(
      ok({
        data: {
          user: {
            contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } },
          },
        },
      }),
    );
    await fetchGithubActivity({ token: 'ghp_xxx', login: 'CAM-eEng' }).catch(() => null);
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer ghp_xxx');
    expect(headers['accept']).toContain('application/json');
  });

  it('flattens GraphQL contribution weeks into a flat days array', async () => {
    fetchSpy.mockResolvedValueOnce(
      ok({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: {
                totalContributions: 7,
                weeks: [
                  {
                    contributionDays: [
                      { date: '2026-05-04', contributionCount: 1 },
                      { date: '2026-05-05', contributionCount: 2 },
                    ],
                  },
                  { contributionDays: [{ date: '2026-05-11', contributionCount: 4 }] },
                ],
              },
            },
          },
        },
      }),
    );
    // Subsequent calls (repos, languages) return empty so test focuses on calendar parsing.
    fetchSpy.mockResolvedValue(ok([]));

    const result = await fetchGithubActivity({ token: 't', login: 'u' });
    expect(result.contributions.totalLastYear).toBe(7);
    expect(result.contributions.days).toHaveLength(3);
    expect(result.contributions.days[0]).toEqual({ date: '2026-05-04', count: 1 });
  });

  it('throws on non-200 with the status only, not the response body', async () => {
    fetchSpy.mockResolvedValue(new Response('{"message":"bad credentials"}', { status: 401 }));
    const err = await fetchGithubActivity({ token: 'secret-token', login: 'u' }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/HTTP 401/);
    expect(err.message).not.toMatch(/bad credentials|secret-token/);
  });

  it('does not echo GraphQL error messages', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'detail from upstream' }] }), {
        status: 200,
      }),
    );
    const err = await fetchGithubActivity({ token: 'secret-token', login: 'u' }).catch((e) => e);
    expect(err.message).toMatch(/1 error\(s\)/);
    expect(err.message).not.toMatch(/detail from upstream|secret-token/);
  });
});
