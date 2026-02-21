import { useEffect, useState } from 'react';
import { getDefaultPersona, type DevalboStore } from '@devalbo/state';
import { podPull, podPush, solidLogin, useSolidSession } from '@devalbo/solid-client';

type SyncAction = 'connect' | 'push' | 'pull' | null;
type ClearState = 'idle' | 'confirm';

type IssuerOption = {
  label: string;
  issuer: string;
  recommended?: boolean;
  registerUrl?: string;
  dockerCommand?: string;
};

const ISSUER_OPTIONS: IssuerOption[] = [
  {
    label: 'solidcommunity.net',
    issuer: 'https://solidcommunity.net',
    recommended: true,
    registerUrl: 'https://solidcommunity.net/idp/register/'
  },
  {
    label: 'solidweb.me',
    issuer: 'https://solidweb.me',
    registerUrl: 'https://solidweb.me/idp/register/'
  },
  {
    label: 'Self-hosted',
    issuer: '',
    dockerCommand: 'docker run --rm -p 3000:3000 communitysolidserver/community-solid-server:latest'
  }
];

const statusText = (webId: string | undefined): string => {
  if (!webId) return 'Connected to Solid';
  try {
    const host = new URL(webId).host;
    return `Connected: ${host}`;
  } catch {
    return `Connected: ${webId}`;
  }
};

export const SolidSyncBar: React.FC<{
  store: DevalboStore;
  config?: { podNamespace: string; appName: string; storageKey: string };
}> = ({ store, config }) => {
  const effectiveConfig = config ?? {
    podNamespace: 'devalbo',
    appName: 'devalbo naveditor',
    storageKey: 'devalbo-store'
  };
  const session = useSolidSession();
  const [selectedIssuerIndex, setSelectedIssuerIndex] = useState(0);
  const [customIssuer, setCustomIssuer] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [busyAction, setBusyAction] = useState<SyncAction>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [clearState, setClearState] = useState<ClearState>('idle');
  const connected = Boolean(session?.isAuthenticated);

  // Auto-dismiss onboarding when authenticated
  useEffect(() => {
    if (connected) {
      setShowOnboarding(false);
    }
  }, [connected]);

  const selectedOption = ISSUER_OPTIONS[selectedIssuerIndex];
  const issuer = selectedOption?.label === 'Self-hosted' ? customIssuer : (selectedOption?.issuer ?? '');
  const connectionLabel = connected ? statusText(session?.webId) : 'Not connected to Solid';

  const openOnboarding = () => setShowOnboarding(true);

  const runPush = async (): Promise<void> => {
    if (!session?.isAuthenticated) {
      openOnboarding();
      return;
    }
    setBusyAction('push');
    setStatusMessage('');
    try {
      const summary = await podPush(store, session, effectiveConfig.podNamespace);
      setStatusMessage(`Pushed ${summary.counts.contacts} contacts, ${summary.counts.groups} groups`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Push failed: ${message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const runPull = async (): Promise<void> => {
    if (!session?.isAuthenticated) {
      openOnboarding();
      return;
    }
    setBusyAction('pull');
    setStatusMessage('');
    try {
      const summary = await podPull(store, session, effectiveConfig.podNamespace);
      setStatusMessage(`Pulled ${summary.counts.contacts} contacts, ${summary.counts.groups} groups`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Pull failed: ${message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const runConnect = async (): Promise<void> => {
    const issuerToUse = issuer.trim();
    if (!issuerToUse) {
      setStatusMessage('Please enter an issuer URL');
      return;
    }
    setBusyAction('connect');
    setStatusMessage('');
    try {
      await solidLogin(issuerToUse, { clientName: effectiveConfig.appName });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Connect failed: ${message}`);
      setBusyAction(null);
    }
  };

  const handleClearClick = () => {
    if (clearState === 'idle') {
      setClearState('confirm');
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(effectiveConfig.storageKey);
        window.location.reload();
      }
    }
  };

  const persona = getDefaultPersona(store);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={connected ? undefined : openOnboarding}
          title={connected ? undefined : 'Click to connect to Solid'}
          style={{
            border: '1px solid #334155',
            borderRadius: '999px',
            padding: '4px 10px',
            cursor: connected ? 'default' : 'pointer',
            background: connected ? '#14532d' : '#1f2937',
            color: '#e2e8f0'
          }}
        >
          {connected ? '●' : '○'} {connectionLabel}
        </button>
        <button
          onClick={() => void runPush()}
          disabled={busyAction !== null}
          title={connected ? undefined : 'Not connected to Solid'}
          style={{
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: busyAction ? 'wait' : 'pointer',
            opacity: connected ? 1 : 0.65,
            background: '#0f172a',
            color: '#e2e8f0'
          }}
        >
          {busyAction === 'push' ? 'Pushing...' : '↑ Push'}
        </button>
        <button
          onClick={() => void runPull()}
          disabled={busyAction !== null}
          title={connected ? undefined : 'Not connected to Solid'}
          style={{
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: busyAction ? 'wait' : 'pointer',
            opacity: connected ? 1 : 0.65,
            background: '#0f172a',
            color: '#e2e8f0'
          }}
        >
          {busyAction === 'pull' ? 'Pulling...' : '↓ Pull'}
        </button>
        {clearState === 'idle' ? (
          <button
            onClick={handleClearClick}
            style={{
              border: 'none',
              background: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            Clear local data
          </button>
        ) : (
          <span style={{ fontSize: '12px', color: '#fca5a5' }}>
            Confirm clear?{' '}
            <button
              onClick={handleClearClick}
              style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              Yes
            </button>
            {' | '}
            <button
              onClick={() => setClearState('idle')}
              style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {showOnboarding && !connected && (
        <div
          style={{
            marginTop: '8px',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '12px',
            background: '#0b1220'
          }}
        >
          <div style={{ marginBottom: '10px', fontSize: '13px', color: '#cbd5e1' }}>
            Choose a Solid provider to connect.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {ISSUER_OPTIONS.map((option, i) => (
              <button
                key={option.label}
                onClick={() => {
                  setSelectedIssuerIndex(i);
                  if (option.label !== 'Self-hosted') setCustomIssuer('');
                }}
                style={{
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  background: selectedIssuerIndex === i ? '#1d4ed8' : '#111827',
                  color: '#e2e8f0',
                  fontSize: '13px'
                }}
              >
                {option.label}{option.recommended ? ' (recommended)' : ''}
              </button>
            ))}
          </div>

          {selectedOption?.registerUrl && (
            <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <code style={{ color: '#94a3b8', fontSize: '12px' }}>{selectedOption.issuer}</code>
              <a
                href={selectedOption.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#60a5fa' }}
              >
                Register →
              </a>
            </div>
          )}

          {selectedOption?.dockerCommand && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Start a local Solid server:
              </div>
              <code
                style={{
                  display: 'block',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: '#a3e635',
                  wordBreak: 'break-all',
                  marginBottom: '8px'
                }}
              >
                {selectedOption.dockerCommand}
              </code>
            </div>
          )}

          <input
            value={selectedOption?.label === 'Self-hosted' ? customIssuer : (selectedOption?.issuer ?? '')}
            onChange={(event) => {
              if (selectedOption?.label === 'Self-hosted') setCustomIssuer(event.target.value);
            }}
            readOnly={selectedOption?.label !== 'Self-hosted'}
            placeholder="https://solidcommunity.net"
            style={{
              width: '100%',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 8px',
              marginBottom: '10px',
              background: '#020617',
              color: '#e2e8f0',
              fontSize: '13px',
              boxSizing: 'border-box'
            }}
          />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => void runConnect()}
              disabled={busyAction === 'connect'}
              style={{
                border: '1px solid #2563eb',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: busyAction ? 'wait' : 'pointer',
                background: '#1d4ed8',
                color: '#e2e8f0'
              }}
            >
              {busyAction === 'connect' ? 'Connecting...' : 'Connect'}
            </button>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              You'll be redirected to log in, then returned here.
            </span>
          </div>

          {persona && (
            <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
              Default persona: {persona.row.name || persona.id}
            </div>
          )}
        </div>
      )}

      {statusMessage && (
        <div style={{ marginTop: '8px', color: '#cbd5e1', fontSize: '13px' }}>{statusMessage}</div>
      )}
    </div>
  );
};
