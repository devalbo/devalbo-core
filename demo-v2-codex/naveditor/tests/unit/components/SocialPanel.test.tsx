import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreContext, createDevalboStore, deletePersona, setContact, setGroup, setPersona } from '@devalbo/state';
import { unsafeAsContactId, unsafeAsGroupId, unsafeAsPersonaId } from '@devalbo/shared';
import { SocialPanel } from '@/components/social/SocialPanel';

const PERSONA_ID = unsafeAsPersonaId('persona_test_social_panel');

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buttonText = (button: { children: Array<unknown> }): string =>
  button.children
    .filter((child): child is string => typeof child === 'string')
    .join('');

describe('SocialPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(async () => {
    store = createDevalboStore();
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SocialPanel />
        </StoreContext.Provider>
      );
      await flush();
    });
  });

  it('renders empty states', () => {
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('No personas yet');
    expect(text).toContain('Select a persona, contact, or group to view details.');
  });

  it('updates persona list reactively after store mutation', async () => {
    await act(async () => {
      setPersona(store, PERSONA_ID, {
        name: 'Alice',
        isDefault: false,
        updatedAt: '2026-02-18T00:00:00.000Z'
      });
      await flush();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Alice');
  });

  it('renders persona detail on click and shows not-found after deletion', async () => {
    await act(async () => {
      setPersona(store, PERSONA_ID, {
        name: 'Alice',
        isDefault: false,
        updatedAt: '2026-02-18T00:00:00.000Z'
      });
      await flush();
    });

    const aliceButton = renderer.root.findAllByType('button').find((button) =>
      button.findAllByType('strong').some((node) => node.children.join('').includes('Alice'))
    );

    expect(aliceButton).toBeDefined();

    await act(async () => {
      aliceButton?.props.onClick();
      await flush();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Alice');

    await act(async () => {
      deletePersona(store, PERSONA_ID);
      await flush();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Entity not found.');
  });

  it('clears selection when switching entity tabs', async () => {
    await act(async () => {
      setPersona(store, PERSONA_ID, {
        name: 'Alice',
        isDefault: false,
        updatedAt: '2026-02-18T00:00:00.000Z'
      });
      setContact(store, unsafeAsContactId('contact_test_social_panel'), {
        name: 'Bob',
        uid: 'urn:uuid:contact_test_social_panel',
        kind: 'person',
        updatedAt: '2026-02-18T00:00:00.000Z'
      });
      setGroup(store, unsafeAsGroupId('group_test_social_panel'), {
        name: 'Core Team',
        groupType: 'group',
        updatedAt: '2026-02-18T00:00:00.000Z'
      });
      await flush();
    });

    const aliceButton = renderer.root.findAllByType('button').find((button) =>
      button.findAllByType('strong').some((node) => node.children.join('').includes('Alice'))
    );

    await act(async () => {
      aliceButton?.props.onClick();
      await flush();
    });

    const contactsTabButton = renderer.root.findAllByType('button').find((button) =>
      buttonText(button).includes('Contacts')
    );

    await act(async () => {
      contactsTabButton?.props.onClick();
      await flush();
    });

    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Search contacts');
    expect(text).toContain('Select a persona, contact, or group to view details.');
  });
});
