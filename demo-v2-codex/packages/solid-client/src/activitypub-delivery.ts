type FetchFn = typeof globalThis.fetch;
type JsonLdObject = Record<string, unknown>;

export type ActivityPubDeliveryResult =
  | { ok: true }
  | { ok: false; error: string };

export const deliverCard = async (
  inboxUrl: string,
  actorWebId: string,
  recipientWebId: string,
  cardJsonLd: JsonLdObject,
  fetchFn: FetchFn = globalThis.fetch
): Promise<ActivityPubDeliveryResult> => {
  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Offer',
    actor: actorWebId,
    object: cardJsonLd,
    to: recipientWebId
  };

  let response: Response;
  try {
    response = await fetchFn(inboxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(activity)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Network error: ${message}` };
  }

  if (response.ok) return { ok: true };
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: `Inbox rejected the request (HTTP ${response.status}). The contact's server may require a trusted sender.`
    };
  }
  return { ok: false, error: `Delivery failed: HTTP ${response.status}` };
};
