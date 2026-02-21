import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreContext, createDevalboStore, listPersonas, setPersona } from '@devalbo/state';
import { unsafeAsPersonaId } from '@devalbo/shared';
import { CreatePersonaPanel } from '@/components/social/d1/CreatePersonaPanel';

describe('CreatePersonaPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(async () => {
    store = createDevalboStore();
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <CreatePersonaPanel onCreated={() => { }} />
        </StoreContext.Provider>
      );
    });
  });

  it('shows validation error for empty name', async () => {
    const button = renderer.root.findByType('button');
    await act(async () => {
      button.props.onClick();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Name is required.');
    expect(listPersonas(store)).toHaveLength(0);
  });

  it('creates persona and calls onCreated', async () => {
    let createdId = '';
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <CreatePersonaPanel onCreated={(id) => { createdId = id; }} />
        </StoreContext.Provider>
      );
    });

    const inputs = renderer.root.findAllByType('input');
    const button = renderer.root.findByType('button');

    await act(async () => {
      inputs[0]?.props.onChange({ target: { value: 'Alice' } });
      inputs[1]?.props.onChange({ target: { value: 'alice@example.com' } });
    });
    await act(async () => {
      button.props.onClick();
    });

    expect(createdId).toBeTruthy();
    const created = store.getRow('personas', createdId);
    expect(created.name).toBe('Alice');
    expect(created.email).toBe('alice@example.com');
  });

  it('sets first persona as default', async () => {
    let createdId = '';
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <CreatePersonaPanel onCreated={(id) => { createdId = id; }} />
        </StoreContext.Provider>
      );
    });

    const nameInput = renderer.root.findAllByType('input')[0];
    const button = renderer.root.findByType('button');
    await act(async () => {
      nameInput?.props.onChange({ target: { value: 'Alice' } });
    });
    await act(async () => {
      button.props.onClick();
    });

    const created = store.getRow('personas', createdId);
    expect(created.isDefault).toBe(true);
  });

  it('does not override existing default persona', async () => {
    const existingId = unsafeAsPersonaId('persona_existing');
    setPersona(store, existingId, {
      name: 'Existing',
      isDefault: true,
      updatedAt: '2026-02-19T00:00:00.000Z'
    });

    let createdId = '';
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <CreatePersonaPanel onCreated={(id) => { createdId = id; }} />
        </StoreContext.Provider>
      );
    });

    const nameInput = renderer.root.findAllByType('input')[0];
    const button = renderer.root.findByType('button');
    await act(async () => {
      nameInput?.props.onChange({ target: { value: 'Alice' } });
    });
    await act(async () => {
      button.props.onClick();
    });

    expect(store.getRow('personas', existingId).isDefault).toBe(true);
    expect(store.getRow('personas', createdId).isDefault).toBe(false);
  });
});
