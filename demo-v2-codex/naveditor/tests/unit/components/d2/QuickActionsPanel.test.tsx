import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreContext, createDevalboStore, listActivities, setPersona } from '@devalbo/state';
import { unsafeAsPersonaId } from '@devalbo/shared';
import { QuickActionsPanel } from '@/components/social/d2/QuickActionsPanel';

const PERSONA_ID = unsafeAsPersonaId('persona_d2_quick_actions');

describe('QuickActionsPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('disables actions when actorPersonaId is null', async () => {
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <QuickActionsPanel subjectType="contact" subjectId="contact_1" subjectName="Bob" actorPersonaId={null} />
        </StoreContext.Provider>
      );
    });

    const buttons = renderer.root.findAllByType('button');
    expect(buttons.slice(0, 4).every((button) => button.props.disabled)).toBe(true);
  });

  it('opens share-card mini form', async () => {
    setPersona(store, PERSONA_ID, { name: 'Alice', isDefault: true, updatedAt: '2026-02-18T00:00:00.000Z' });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <QuickActionsPanel subjectType="contact" subjectId="contact_1" subjectName="Bob" actorPersonaId={PERSONA_ID} />
        </StoreContext.Provider>
      );
    });

    const shareCard = renderer.root.findAllByType('button')[0];
    await act(async () => {
      shareCard?.props.onClick();
    });

    expect(renderer.root.findAllByType('textarea').length).toBeGreaterThan(0);
  });

  it('logs activity and fires callback', async () => {
    setPersona(store, PERSONA_ID, { name: 'Alice', isDefault: true, updatedAt: '2026-02-18T00:00:00.000Z' });
    let loggedId = '';

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <QuickActionsPanel
            subjectType="contact"
            subjectId="contact_1"
            subjectName="Bob"
            actorPersonaId={PERSONA_ID}
            onActivityLogged={(id) => { loggedId = id; }}
          />
        </StoreContext.Provider>
      );
    });

    const shareFile = renderer.root.findAllByType('button')[1];
    await act(async () => {
      shareFile?.props.onClick();
    });

    const inputs = renderer.root.findAllByType('input');
    const logButton = renderer.root.findAllByType('button').find((button) => button.children.join('') === 'Log');

    await act(async () => {
      inputs[0]?.props.onChange({ target: { value: '/tmp/notes.md' } });
      inputs[1]?.props.onChange({ target: { value: 'send file' } });
    });
    await act(async () => {
      logButton?.props.onClick();
    });

    expect(loggedId).not.toBe('');
    expect(listActivities(store)).toHaveLength(1);
  });

  it('shows validation error for empty required payload', async () => {
    setPersona(store, PERSONA_ID, { name: 'Alice', isDefault: true, updatedAt: '2026-02-18T00:00:00.000Z' });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <QuickActionsPanel subjectType="contact" subjectId="contact_1" subjectName="Bob" actorPersonaId={PERSONA_ID} />
        </StoreContext.Provider>
      );
    });

    const shareFile = renderer.root.findAllByType('button')[1];
    await act(async () => {
      shareFile?.props.onClick();
    });

    const logButton = renderer.root.findAllByType('button').find((button) => button.children.join('') === 'Log');
    await act(async () => {
      logButton?.props.onClick();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Please fill in the required field.');
    expect(listActivities(store)).toHaveLength(0);
  });
});
