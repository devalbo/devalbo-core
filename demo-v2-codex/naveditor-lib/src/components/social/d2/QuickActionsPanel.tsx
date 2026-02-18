import { useMemo, useState } from 'react';
import { logActivity, personaToJsonLd, usePersona, useStore } from '@devalbo/state';
import { ActivityIdToolbox, unsafeAsActivityId, unsafeAsPersonaId, type ActivityId, type PersonaId } from '@devalbo/shared';

interface QuickActionsPanelProps {
  subjectType: 'contact' | 'group';
  subjectId: string;
  subjectName: string;
  actorPersonaId: PersonaId | null;
  onActivityLogged?: (id: ActivityId) => void;
}

type ActionMode = 'share-card' | 'share-file' | 'share-link' | 'invite' | null;

const buttonStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: '6px',
  background: '#1e293b',
  color: '#e2e8f0',
  padding: '6px 10px'
};

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  subjectType,
  subjectId,
  subjectName,
  actorPersonaId,
  onActivityLogged
}) => {
  const store = useStore();
  const actorId = unsafeAsPersonaId(actorPersonaId ?? '__missing-actor__');
  const actor = usePersona(actorId);

  const [mode, setMode] = useState<ActionMode>(null);
  const [valueA, setValueA] = useState('');
  const [valueB, setValueB] = useState('');
  const [error, setError] = useState('');

  const shareCardJson = useMemo(() => {
    if (!actorPersonaId || !actor) return '';
    return JSON.stringify(personaToJsonLd(actor, actorId), null, 2);
  }, [actor, actorId, actorPersonaId]);

  const disabled = !actorPersonaId;

  const resetForm = () => {
    setMode(null);
    setValueA('');
    setValueB('');
    setError('');
  };

  const log = (activityType: 'share-card' | 'share-file' | 'share-link' | 'invite' | 'note', payload: Record<string, unknown>) => {
    if (!actorPersonaId) {
      setError('Select a persona first.');
      return;
    }

    const id = unsafeAsActivityId(ActivityIdToolbox.createRandomId?.() ?? crypto.randomUUID());
    logActivity(store, id, {
      actorPersonaId,
      subjectType,
      subjectId,
      activityType,
      payload: JSON.stringify(payload),
      timestamp: new Date().toISOString()
    });
    onActivityLogged?.(id);
    resetForm();
  };

  const submit = () => {
    setError('');
    if (mode === 'share-card') {
      if (!shareCardJson.trim()) {
        setError('No card payload to share.');
        return;
      }
      log('share-card', { personaId: actorPersonaId, jsonLd: shareCardJson, subjectName });
      return;
    }

    if (!valueA.trim()) {
      setError('Please fill in the required field.');
      return;
    }

    if (mode === 'share-file') {
      log('share-file', { filePath: valueA.trim(), description: valueB.trim(), subjectName });
      return;
    }

    if (mode === 'share-link') {
      log('share-link', { url: valueA.trim(), description: valueB.trim(), subjectName });
      return;
    }

    if (mode === 'invite') {
      log('invite', { activityDescription: valueA.trim(), notes: valueB.trim(), subjectName });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h4 style={{ margin: 0 }}>Quick Actions</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button type="button" disabled={disabled} title={disabled ? 'Select a persona first' : ''} onClick={() => setMode('share-card')} style={buttonStyle}>Share Card</button>
        <button type="button" disabled={disabled} title={disabled ? 'Select a persona first' : ''} onClick={() => setMode('share-file')} style={buttonStyle}>Share File</button>
        <button type="button" disabled={disabled} title={disabled ? 'Select a persona first' : ''} onClick={() => setMode('share-link')} style={buttonStyle}>Share Link</button>
        <button type="button" disabled={disabled} title={disabled ? 'Select a persona first' : ''} onClick={() => setMode('invite')} style={buttonStyle}>Invite</button>
      </div>

      {mode && (
        <div style={{ border: '1px solid #334155', borderRadius: '8px', background: '#020617', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mode === 'share-card' && (
            <textarea readOnly value={shareCardJson} rows={6} style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '8px' }} />
          )}
          {mode !== 'share-card' && (
            <input
              type="text"
              value={valueA}
              onChange={(event) => setValueA(event.target.value)}
              placeholder={mode === 'share-file' ? 'File path' : mode === 'share-link' ? 'URL or link' : 'Activity description'}
              style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '8px' }}
            />
          )}
          <input
            type="text"
            value={valueB}
            onChange={(event) => setValueB(event.target.value)}
            placeholder="Description / notes"
            style={{ border: '1px solid #334155', borderRadius: '6px', background: '#0f172a', color: '#e2e8f0', padding: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={submit} style={buttonStyle}>Log</button>
            <button type="button" onClick={resetForm} style={buttonStyle}>Cancel</button>
          </div>
          {error && <div style={{ color: '#f87171' }}>{error}</div>}
        </div>
      )}
    </div>
  );
};
