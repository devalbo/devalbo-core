import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverCard } from '../src/activitypub-delivery';

const INBOX = 'https://bob.example/inbox';
const ACTOR = 'https://alice.example/profile#me';
const RECIPIENT = 'https://bob.example/profile#me';
const CARD = { name: 'Alice' };

const mockResponse = (status: number): Response => new Response(null, { status });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deliverCard', () => {
  it('returns ok:true on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(200));
    expect(await deliverCard(INBOX, ACTOR, RECIPIENT, CARD)).toEqual({ ok: true });
  });

  it('returns ok:true on 201', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(201));
    expect(await deliverCard(INBOX, ACTOR, RECIPIENT, CARD)).toEqual({ ok: true });
  });

  it('returns ok:true on 202', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(202));
    expect(await deliverCard(INBOX, ACTOR, RECIPIENT, CARD)).toEqual({ ok: true });
  });

  it('POSTs AS2 Offer payload to inbox', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(201));
    await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(url).toBe(INBOX);
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams');
    expect(body.type).toBe('Offer');
    expect(body.actor).toBe(ACTOR);
    expect(body.to).toBe(RECIPIENT);
    expect(body.object).toEqual(CARD);
  });

  it.each([401, 403])('returns descriptive error on auth rejection %i', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(status));
    const result = await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(status));
  });

  it('returns error containing status on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(500));
    const result = await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('500');
  });

  it('returns network error message when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connection refused'));
    const result = await deliverCard(INBOX, ACTOR, RECIPIENT, CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('connection refused');
  });
});
