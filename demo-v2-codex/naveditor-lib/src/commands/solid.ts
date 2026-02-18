import { createElement } from 'react';
import { fetchWebIdProfile } from '@devalbo/solid-client';
import { parseSolidFetchProfileArgs } from '@/lib/command-args.parser';
import { SolidProfileOutput } from '@/components/social/output/SolidProfileOutput';
import type { AsyncCommandHandler } from './_util';
import { makeResult, makeResultError } from './_util';

export const solidCommands: Record<'solid-fetch-profile', AsyncCommandHandler> = {
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
  }
};
