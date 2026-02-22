import { useEffect } from 'react';
import {
  fetchWebIdProfile,
  useSolidSession
} from '@devalbo/solid-client';
import {
  getDefaultPersona,
  setPersona,
  type DevalboStore
} from '@devalbo/state';
import type { PersonaRow, PersonaRowInput } from '@devalbo/shared';

const SOLID_PROFILE_FIELDS = ['inbox', 'storage', 'publicTypeIndex', 'oidcIssuer', 'profileDoc'] as const;

const mergeSolidProfileFields = (existing: PersonaRow, fetched: PersonaRowInput): PersonaRowInput => {
  const next = { ...existing };
  for (const field of SOLID_PROFILE_FIELDS) {
    const localValue = (next[field] ?? '').trim();
    const fetchedValue = (fetched[field] ?? '').trim();
    if (localValue && fetchedValue && localValue !== fetchedValue) {
      throw new Error(`Solid profile field conflict for "${field}": local="${localValue}" fetched="${fetchedValue}"`);
    }
    if (!localValue && fetchedValue) {
      next[field] = fetchedValue;
    }
  }
  return next;
};

export const useSolidProfileSync = (store: DevalboStore): void => {
  const session = useSolidSession();

  useEffect(() => {
    if (!session?.isAuthenticated) return;
    let cancelled = false;

    const syncProfile = async (): Promise<void> => {
      const result = await fetchWebIdProfile(session.webId);
      if (!result.ok) {
        throw new Error(`Failed to fetch Solid profile after login: ${result.error}`);
      }
      if (cancelled) return;

      const defaultPersona = getDefaultPersona(store);
      if (!defaultPersona) {
        setPersona(store, result.id, {
          ...result.row,
          profileDoc: result.row.profileDoc || session.webId,
          isDefault: true
        });
        return;
      }

      const merged = mergeSolidProfileFields(defaultPersona.row, {
        ...result.row,
        profileDoc: result.row.profileDoc || session.webId
      });
      setPersona(store, defaultPersona.id, merged);
    };

    void syncProfile().catch((error) => {
      console.error('[SolidProfileSync] post-login profile merge failed:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [session, store]);
};
