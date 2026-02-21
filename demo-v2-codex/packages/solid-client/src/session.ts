type AuthSessionLike = {
  info: {
    isLoggedIn: boolean;
    webId?: string;
  };
  fetch: typeof globalThis.fetch;
  login: (options: { oidcIssuer: string; redirectUrl: string; clientName: string }) => Promise<void>;
  handleIncomingRedirect: (options: { restorePreviousSession: boolean; url?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

export type SolidSession = {
  webId: string;
  isAuthenticated: boolean;
  fetch: typeof globalThis.fetch;
};

type SessionListener = (session: SolidSession | null) => void;

let authSessionPromise: Promise<AuthSessionLike> | null = null;
let currentSession: SolidSession | null = null;
const listeners = new Set<SessionListener>();

const emit = (): void => {
  for (const listener of listeners) listener(currentSession);
};

const toSolidSession = (session: AuthSessionLike): SolidSession | null => {
  if (!session.info.isLoggedIn || !session.info.webId) return null;
  return {
    webId: session.info.webId,
    isAuthenticated: true,
    fetch: session.fetch
  };
};

const getAuthSession = async (): Promise<AuthSessionLike> => {
  if (!authSessionPromise) {
    authSessionPromise = import('@inrupt/solid-client-authn-browser')
      .then(({ Session }) => new Session() as unknown as AuthSessionLike);
  }
  return authSessionPromise;
};

export const getSolidSession = (): SolidSession | null => currentSession;

export const subscribeSolidSession = (listener: SessionListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const handleIncomingRedirect = async (): Promise<SolidSession | null> => {
  if (typeof window === 'undefined') {
    currentSession = null;
    emit();
    return null;
  }
  const session = await getAuthSession();
  await session.handleIncomingRedirect({
    restorePreviousSession: true,
    url: window.location.href
  });
  currentSession = toSolidSession(session);
  emit();
  return currentSession;
};

export const solidLogin = async (issuer: string, options?: { clientName?: string }): Promise<SolidSession | null> => {
  if (typeof window === 'undefined') {
    throw new Error('solid-login is only available in browser/desktop runtimes');
  }
  const session = await getAuthSession();
    await session.login({
      oidcIssuer: issuer,
      redirectUrl: window.location.href,
      clientName: options?.clientName ?? 'devalbo naveditor'
    });
  currentSession = toSolidSession(session);
  emit();
  return currentSession;
};

export const solidLogout = async (): Promise<void> => {
  const session = await getAuthSession();
  await session.logout();
  currentSession = null;
  emit();
};
