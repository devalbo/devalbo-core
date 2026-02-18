import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreContext, createDevalboStore, listContacts } from '@devalbo/state';
import { ImportCardPanel } from '@/components/social/d1/ImportCardPanel';

describe('ImportCardPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(async () => {
    store = createDevalboStore();
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ImportCardPanel />
        </StoreContext.Provider>
      );
    });
  });

  it('shows error on empty submit', async () => {
    const button = renderer.root.findByType('button');
    await act(async () => {
      button.props.onClick();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Paste some JSON-LD');
  });

  it('shows error on invalid json', async () => {
    const textarea = renderer.root.findByType('textarea');
    const button = renderer.root.findByType('button');
    await act(async () => {
      textarea.props.onChange({ target: { value: 'not-json' } });
    });
    await act(async () => {
      button.props.onClick();
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Error');
  });

  it('imports valid contact json-ld and calls callback', async () => {
    let importedId = '';
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ImportCardPanel onImported={(id) => { importedId = id; }} />
        </StoreContext.Provider>
      );
    });

    const json = JSON.stringify({
      '@context': {},
      '@type': 'vcard:Individual',
      '@id': 'contact_d1_import',
      'vcard:fn': 'Bob',
      'vcard:hasUID': 'urn:uuid:bob'
    });

    const textarea = renderer.root.findByType('textarea');
    const button = renderer.root.findByType('button');

    await act(async () => {
      textarea.props.onChange({ target: { value: json } });
    });
    await act(async () => {
      button.props.onClick();
    });

    expect(importedId).toBe('contact_d1_import');
    expect(listContacts(store)).toHaveLength(1);
    expect(listContacts(store)[0]?.row.name).toBe('Bob');
  });
});
