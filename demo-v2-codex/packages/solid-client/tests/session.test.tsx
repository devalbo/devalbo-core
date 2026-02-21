import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSolidSession } from '../src/session';
import { SolidSessionProvider, useSolidSession } from '../src/session-context';
import * as sessionModule from '../src/session';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('solid session', () => {
  it('returns null when session is not logged in', () => {
    expect(getSolidSession()).toBeNull();
  });

  it('useSolidSession returns null when no provider is present', async () => {
    let observed: unknown = Symbol('unset');
    const Probe: React.FC = () => {
      observed = useSolidSession();
      return null;
    };
    await act(async () => {
      create(<Probe />);
    });
    expect(observed).toBeNull();
  });

  it('SolidSessionProvider renders children', async () => {
    vi.spyOn(sessionModule, 'handleIncomingRedirect').mockResolvedValueOnce(null);
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <SolidSessionProvider>
          <div id="child">ok</div>
        </SolidSessionProvider>
      );
    });
    expect(renderer.toJSON()).toBeTruthy();
  });

  it('SolidSessionProvider calls handleIncomingRedirect on mount', async () => {
    const spy = vi.spyOn(sessionModule, 'handleIncomingRedirect').mockResolvedValueOnce(null);
    await act(async () => {
      create(
        <SolidSessionProvider>
          <div>ok</div>
        </SolidSessionProvider>
      );
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
