export type BridgePayload = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface BridgeRequest<T = BridgePayload> {
  id: string;
  type: string;
  payload: T;
}

export interface BridgeSuccess<T = BridgePayload> {
  id: string;
  ok: true;
  payload: T;
}

export interface BridgeFailure {
  id: string;
  ok: false;
  error: string;
}

export type BridgeResponse<T = BridgePayload> = BridgeSuccess<T> | BridgeFailure;

export interface BridgeEnvelope<T = BridgePayload> {
  request: BridgeRequest<T> | null;
  response: BridgeResponse<T> | null;
}

export const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
