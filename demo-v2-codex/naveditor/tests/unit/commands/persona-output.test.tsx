import { beforeEach, describe, expect, it } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import { isValidElement, type ReactElement } from 'react';
import { commands } from '@/commands';
import { PersonaDetailOutput } from '@/components/social/output/PersonaDetailOutput';
import { PersonaListOutput } from '@/components/social/output/PersonaListOutput';

describe('persona command output components', () => {
  let store = createDevalboStore();

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('renders empty state for persona list', async () => {
    const result = await commands.persona(['list'], { store });
    expect(isValidElement(result.component)).toBe(true);
    expect((result.component as ReactElement).type).toBe(PersonaListOutput);
    expect((result.component as ReactElement<{ personas: unknown[] }>).props.personas).toHaveLength(0);
  });

  it('renders persona list rows', async () => {
    await commands.persona(['create', 'Alice'], { store });
    await commands.persona(['create', 'Bob'], { store });

    const result = await commands.persona(['list'], { store });
    expect((result.component as ReactElement).type).toBe(PersonaListOutput);
    const personas = (result.component as ReactElement<{ personas: Array<{ row: { name: string } }> }>).props.personas;
    expect(personas.map((entry) => entry.row.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });

  it('renders single persona detail for show', async () => {
    const created = await commands.persona(['create', 'Alice'], { store });
    const id = (created.data as { id: string }).id;

    const result = await commands.persona(['show', id], { store });
    expect((result.component as ReactElement).type).toBe(PersonaDetailOutput);
    const props = (result.component as ReactElement<{ id: string; row: { name: string } }>).props;
    expect(props.id).toBe(id);
    expect(props.row.name).toBe('Alice');
  });

  it('renders created persona detail', async () => {
    const result = await commands.persona(['create', 'Alice'], { store });
    expect((result.component as ReactElement).type).toBe(PersonaDetailOutput);
    const row = (result.component as ReactElement<{ row: { name: string } }>).props.row;
    expect(row.name).toBe('Alice');
  });
});
