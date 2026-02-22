import { createElement } from 'react';
import {
  deliverCard,
  fetchWebIdProfile,
  type SolidSession,
  solidLogin,
  solidLogout
} from '@devalbo/solid-client';
import {
  getContact,
  getDefaultPersona,
  personaToJsonLd
} from '@devalbo/state';
import type { ContactId } from '@devalbo/shared';
import type { Store } from 'tinybase';
import {
  parseSolidFetchProfileArgs,
  parseSolidLoginArgs,
  parseSolidShareCardArgs
} from '@/lib/command-args.parser';
import { pullPodData, pushPodData } from '@/lib/pod-sync';
import { SolidProfileOutput } from '@/components/social/output/SolidProfileOutput';
import type { AsyncCommandHandler, ExtendedCommandOptions } from '@devalbo/cli-shell';
import { makeOutput, makeResult, makeResultError } from '@devalbo/cli-shell';

const hasStore = (options?: ExtendedCommandOptions): options is ExtendedCommandOptions & { store: Store } =>
  typeof options === 'object' && options != null && 'store' in options;
const asSolidSession = (session: unknown): SolidSession | null => {
  if (!session || typeof session !== 'object') return null;
  const candidate = session as Partial<SolidSession>;
  if (typeof candidate.webId !== 'string') return null;
  if (typeof candidate.isAuthenticated !== 'boolean') return null;
  if (typeof candidate.fetch !== 'function') return null;
  return candidate as SolidSession;
};

export const solidCommands: Record<
  | 'solid-fetch-profile'
  | 'solid-login'
  | 'solid-logout'
  | 'solid-whoami'
  | 'solid-pod-push'
  | 'solid-pod-pull'
  | 'solid-share-card',
  AsyncCommandHandler
> = {
  'solid-fetch-profile': async (args) => {
    const parsed = parseSolidFetchProfileArgs(args);
    if (!parsed.success) {
      return makeResultError(`Usage: solid-fetch-profile <webId>\n${parsed.error}`);
    }

    const result = await fetchWebIdProfile(parsed.value.webId);
    if (!result.ok) return makeResultError(result.error);

    return {
      ...makeResult(`Profile fetched for ${result.row.name}`, { id: result.id, row: result.row }),
      component: createElement(SolidProfileOutput, { id: result.id, row: result.row })
    };
  },
  'solid-login': async (args, options) => {
    const parsed = parseSolidLoginArgs(args);
    if (!parsed.success) return makeResultError(`Usage: solid-login <issuer>\n${parsed.error}`);
    try {
      const loginOptions = options?.config?.appName ? { clientName: options.config.appName } : undefined;
      await solidLogin(parsed.value.issuer, loginOptions);
      return makeOutput('Redirecting to login...');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return makeResultError(`Login failed: ${message}`);
    }
  },
  'solid-logout': async () => {
    await solidLogout();
    return makeOutput('Logged out');
  },
  'solid-whoami': async (_args, options) => {
    const session = asSolidSession(options?.session);
    if (!session?.isAuthenticated) return makeOutput('Not logged in');
    return makeOutput(session.webId);
  },
  'solid-pod-push': async (_args, options) => {
    const session = asSolidSession(options?.session);
    if (!session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
    if (!hasStore(options)) return makeResultError('solid-pod-push requires a store');

    try {
      const podNamespace = options.config?.podNamespace ?? 'devalbo';
      const result = await pushPodData(options.store, session, podNamespace);
      return makeResult(
        `Pushed to POD: ${result.counts.persona} persona, ${result.counts.contacts} contacts, ${result.counts.groups} groups`,
        { podRoot: result.podRoot, counts: { contacts: result.counts.contacts, groups: result.counts.groups } }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return makeResultError(message);
    }
  },
  'solid-pod-pull': async (_args, options) => {
    const session = asSolidSession(options?.session);
    if (!session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
    if (!hasStore(options)) return makeResultError('solid-pod-pull requires a store');

    try {
      const podNamespace = options.config?.podNamespace ?? 'devalbo';
      const result = await pullPodData(options.store, session, podNamespace);
      return makeResult(
        `Pulled from POD: ${result.counts.persona} persona, ${result.counts.contacts} contacts, ${result.counts.groups} groups`,
        { podRoot: result.podRoot, counts: { contacts: result.counts.contacts, groups: result.counts.groups } }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return makeResultError(message);
    }
  },
  'solid-share-card': async (args, options) => {
    const session = asSolidSession(options?.session);
    if (!session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
    if (!hasStore(options)) return makeResultError('solid-share-card requires a store');

    const parsed = parseSolidShareCardArgs(args);
    if (!parsed.success) return makeResultError(`Usage: solid-share-card <contactId>\n${parsed.error}`);

    const contact = getContact(options.store, parsed.value.contactId as ContactId);
    if (!contact) return makeResultError(`Contact not found: ${parsed.value.contactId}`);
    if (!contact.webId) return makeResultError('Contact has no WebID — cannot discover inbox');

    const profileResult = await fetchWebIdProfile(contact.webId);
    if (!profileResult.ok) return makeResultError(`Could not fetch contact profile: ${profileResult.error}`);
    if (!profileResult.row.inbox) return makeResultError("Contact's profile does not list an inbox");

    const defaultPersona = getDefaultPersona(options.store);
    if (!defaultPersona) return makeResultError('No default persona set. Run: persona set-default <id>');

    const cardJsonLd = personaToJsonLd(defaultPersona.row, defaultPersona.id);
    const delivered = await deliverCard(
      profileResult.row.inbox,
      defaultPersona.id,
      contact.webId,
      cardJsonLd,
      session.fetch
    );
    if (!delivered.ok) return makeResultError(delivered.error);

    return makeResult(`Card sent to ${contact.name || contact.webId}`, {
      inboxUrl: profileResult.row.inbox
    });
  }
};
