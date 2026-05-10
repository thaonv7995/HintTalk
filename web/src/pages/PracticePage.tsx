import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockScenarios } from '../data/mockScenarios';
import type { HintLevel, MockScenario } from '../types';

type Track = 'conversation' | 'toeic-speaking' | 'toeic-writing';

export function PracticePage() {
  const navigate = useNavigate();
  const [track, setTrack] = useState<Track>('conversation');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<HintLevel>('beginner');
  const [sessionMode, setSessionMode] = useState<'speak' | 'write'>('speak');

  const filtered = useMemo(() => {
    if (track === 'conversation') return mockScenarios.filter((s) => s.practiceType === 'conversation');
    if (track === 'toeic-speaking') return mockScenarios.filter((s) => s.practiceType === 'toeic' && s.toeicSection === 'speaking');
    return mockScenarios.filter((s) => s.practiceType === 'toeic' && s.toeicSection === 'writing');
  }, [track]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!selectedId || !filtered.some((s) => s.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(() => filtered.find((s) => s.id === selectedId) ?? filtered[0], [filtered, selectedId]);

  const launchChat = (mode: 'speak' | 'write') => {
    if (!selected || selected.sessionKind !== 'chat') return;
    const path = mode === 'speak' ? '/session/speak' : '/session/chat';
    navigate(path, { state: { scenarioId: selected.id, level, mode } });
  };

  const launchDoc = () => {
    if (!selected || selected.sessionKind !== 'document') return;
    navigate('/session/document', { state: { scenarioId: selected.id, level, mode: 'write' } });
  };

  const launchLiveVoice = () => {
    if (!selected || selected.sessionKind !== 'chat') return;
    navigate('/live-voice', { state: { scenarioId: selected.id, level, mode: 'live_voice' } });
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Practice studio</p>
          <h2>Train by scenario or TOEIC type — hints stay separate from voice models.</h2>
        </div>
        <div className="top-actions">
          <button type="button" className="soft" onClick={() => navigate('/settings')}>
            Settings
          </button>
          <button
            type="button"
            className="primary"
            disabled={!selected || selected.sessionKind !== 'chat'}
            title={selected?.sessionKind !== 'chat' ? 'Pick a speaking/chat scenario (not a writing sheet)' : undefined}
            onClick={launchLiveVoice}
          >
            Live voice
          </button>
        </div>
      </header>

      <nav className="mode-tabs">
        <button type="button" className={track === 'conversation' ? 'active' : ''} onClick={() => setTrack('conversation')}>
          Conversation
        </button>
        <button type="button" className={track === 'toeic-speaking' ? 'active' : ''} onClick={() => setTrack('toeic-speaking')}>
          TOEIC Speaking
        </button>
        <button type="button" className={track === 'toeic-writing' ? 'active' : ''} onClick={() => setTrack('toeic-writing')}>
          TOEIC Writing
        </button>
      </nav>

      <section className="catalog-layout">
        <div className="scenario-board">
          {filtered.map((s: MockScenario) => (
            <article key={s.id} className={`scenario-large${selected?.id === s.id ? ' selected' : ''}`} onClick={() => setSelectedId(s.id)} style={{ cursor: 'pointer' }}>
              <span>{s.category}</span>
              <h3>{s.title}</h3>
              <p>{s.goal}</p>
              <div className="top-actions">
                {s.sessionKind === 'chat' ? (
                  <>
                    <button
                      type="button"
                      className="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        launchChat('speak');
                      }}
                    >
                      Start speaking
                    </button>
                    <button
                      type="button"
                      className="soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        launchChat('write');
                      }}
                    >
                      Start writing
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      launchDoc();
                    }}
                  >
                    Open draft sheet
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <aside className="session-panel">
          <div className="panel-card selected-plan">
            <p className="eyebrow">Session setup</p>
            <h3>{selected?.title ?? '—'}</h3>
            <div className="setting-list">
              <div>
                <span>Your role</span>
                <strong>{selected?.userRole}</strong>
              </div>
              <div>
                <span>AI role</span>
                <strong>{selected?.aiRole}</strong>
              </div>
              <div>
                <span>Hint level</span>
                <strong style={{ textTransform: 'capitalize' }}>{level}</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>{selected?.sessionKind === 'document' ? 'Document draft' : sessionMode === 'speak' ? 'Speaking room' : 'Chat typing'}</strong>
              </div>
            </div>

            <div className="segmented" style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <span className="eyebrow">Level</span>
              <div className="mode-tabs" style={{ width: '100%' }}>
                {(['beginner', 'intermediate', 'advanced'] as const).map((lv) => (
                  <button key={lv} type="button" className={level === lv ? 'active' : ''} onClick={() => setLevel(lv)} style={{ flex: 1, border: 0, background: 'transparent', fontWeight: 900 }}>
                    {lv}
                  </button>
                ))}
              </div>
            </div>

            {selected?.sessionKind === 'chat' ? (
              <div className="segmented" style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <span className="eyebrow">Primary start</span>
                <div className="mode-tabs" style={{ width: '100%' }}>
                  <button type="button" className={sessionMode === 'speak' ? 'active' : ''} onClick={() => setSessionMode('speak')} style={{ flex: 1, border: 0, background: 'transparent', fontWeight: 900 }}>
                    Speaking room
                  </button>
                  <button type="button" className={sessionMode === 'write' ? 'active' : ''} onClick={() => setSessionMode('write')} style={{ flex: 1, border: 0, background: 'transparent', fontWeight: 900 }}>
                    Writing chat
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="primary wide"
              style={{ marginTop: 18 }}
              onClick={() => {
                if (!selected) return;
                if (selected.sessionKind === 'document') launchDoc();
                else launchChat(sessionMode === 'speak' ? 'speak' : 'write');
              }}
            >
              {selected?.sessionKind === 'document' ? 'Practice this type' : sessionMode === 'speak' ? 'Enter speaking room' : 'Enter writing chat'}
            </button>

            {selected?.sessionKind === 'chat' ? (
              <button type="button" className="soft wide" style={{ marginTop: 10 }} onClick={launchLiveVoice}>
                Live voice (Realtime)
              </button>
            ) : null}
          </div>
        </aside>
      </section>
    </>
  );
}
