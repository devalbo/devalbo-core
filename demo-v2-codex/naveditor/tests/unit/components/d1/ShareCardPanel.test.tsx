import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreContext, createDevalboStore, setPersona } from '@devalbo/state';
import { unsafeAsPersonaId } from '@devalbo/shared';
import { ShareCardPanel } from '@/components/social/d1/ShareCardPanel';

const PERSONA_ID = unsafeAsPersonaId('persona_d1_share_test');

describe('ShareCardPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('renders prompt when personaId is null', async () => {
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ShareCardPanel personaId={null} />
        </StoreContext.Provider>
      );
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Select a persona to share.');
  });

  it('renders json-ld for valid persona', async () => {
    setPersona(store, PERSONA_ID, { name: 'Alice', isDefault: true, updatedAt: '2026-02-18T00:00:00.000Z' });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ShareCardPanel personaId={PERSONA_ID} />
        </StoreContext.Provider>
      );
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('foaf:Person');
    expect(JSON.stringify(renderer.toJSON())).toContain('Alice');
  });

  it('calls onCopy on copy click', async () => {
    setPersona(store, PERSONA_ID, { name: 'Alice', isDefault: true, updatedAt: '2026-02-18T00:00:00.000Z' });
    let copied = '';

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ShareCardPanel personaId={PERSONA_ID} onCopy={(text) => { copied = text; }} />
        </StoreContext.Provider>
      );
    });

    const button = renderer.root.findAllByType('button')[0];
    await act(async () => {
      button?.props.onClick();
    });

    expect(copied).toContain('Alice');
  });

  it('commits edited name on blur and updates timestamp', async () => {
    setPersona(store, PERSONA_ID, {
      name: 'Alice',
      isDefault: true,
      updatedAt: '2026-02-18T00:00:00.000Z'
    });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ShareCardPanel personaId={PERSONA_ID} />
        </StoreContext.Provider>
      );
    });

    const nameInput = renderer.root.findAllByType('input')[0];
    await act(async () => {
      nameInput?.props.onChange({ target: { value: 'Alice Updated' } });
    });
    await act(async () => {
      nameInput?.props.onBlur();
    });

    const row = store.getRow('personas', PERSONA_ID);
    expect(row.name).toBe('Alice Updated');
    expect(row.updatedAt).not.toBe('2026-02-18T00:00:00.000Z');
  });
});
