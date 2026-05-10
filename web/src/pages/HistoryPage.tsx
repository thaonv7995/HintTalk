import { useEffect, useState } from 'react';
import { deleteSession, exportSessionsBlob, importSessionsFromJson, loadSessions } from '../lib/storage';
import type { HintTalkSession } from '../types';

export function HistoryPage() {
  const [sessions, setSessions] = useState<HintTalkSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => {
    const list = loadSessions();
    setSessions(list);
    setSelectedId((id) => (id && list.some((s) => s.id === id) ? id : list[0]?.id ?? null));
  };

  useEffect(() => {
    refresh();
  }, []);

  const selected = sessions.find((s) => s.id === selectedId);

  const exportJson = () => {
    const blob = exportSessionsBlob(sessions);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hinttalk-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        importSessionsFromJson(text);
        refresh();
      } catch {
        alert('Invalid JSON backup.');
      }
    };
    input.click();
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">History</p>
          <h2>Review transcripts and saved drafts locally.</h2>
        </div>
        <div className="top-actions">
          <button type="button" className="soft" onClick={importJson}>
            Import JSON
          </button>
          <button type="button" className="primary" onClick={exportJson}>
            Export JSON
          </button>
        </div>
      </header>

      <section className="history-layout">
        <div className="history-table">
          {sessions.length === 0 ? (
            <div className="history-item">No sessions yet. Finish a practice to save here.</div>
          ) : (
            sessions.map((s) => {
              const turns = s.turns.length;
              const when = new Date(s.startedAt).toLocaleString();
              const label =
                s.practiceType === 'toeic'
                  ? `TOEIC ${s.toeicSection ?? ''}${s.questionRange ? ` · ${s.questionRange}` : ''}`
                  : 'Conversation';
              return (
                <div key={s.id} className={`history-item${selectedId === s.id ? ' selected' : ''}`} onClick={() => setSelectedId(s.id)} style={{ cursor: 'pointer' }}>
                  <strong>{s.scenarioTitle}</strong>
                  <span>
                    {label} · {turns} turns · {when}
                  </span>
                  <button
                    type="button"
                    className="soft"
                    style={{ marginTop: 10 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                      refresh();
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>

        <aside className="review-card">
          <p className="eyebrow">Selected review</p>
          {selected ? (
            <>
              <h3>{selected.scenarioTitle}</h3>
              <p className="panel-copy">
                Mode: {selected.mode} · Level: {selected.level} · Roles: {selected.roles.user} / {selected.roles.ai}
              </p>
              {selected.prompt ? <p className="panel-copy">{selected.prompt}</p> : null}
              <div className="transcript">
                {selected.turns.map((t) => (
                  <p key={t.id}>
                    <b>{t.role === 'ai' ? 'AI' : 'You'}</b> {t.text}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="panel-copy">Select a session.</p>
          )}
        </aside>
      </section>
    </>
  );
}
