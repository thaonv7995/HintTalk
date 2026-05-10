import { useNavigate } from 'react-router-dom';
import { mockScenarios } from '../data/mockScenarios';
import type { HintLevel } from '../types';

export function WritingHubPage() {
  const navigate = useNavigate();
  const docs = mockScenarios.filter((s) => s.sessionKind === 'document');

  const startDoc = (scenarioId: string, level: HintLevel) => {
    navigate('/session/document', { state: { scenarioId, level, mode: 'write' } });
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Writing session</p>
          <h2>Draft with structure hints, not full answers.</h2>
        </div>
      </header>

      <section className="catalog-layout">
        <div className="scenario-board" style={{ gridTemplateColumns: '1fr' }}>
          {docs.map((s) => (
            <article key={s.id} className="scenario-large">
              <span>{s.questionRange ?? 'Writing'}</span>
              <h3>{s.title}</h3>
              <p>{s.prompt}</p>
              <div className="top-actions" style={{ marginTop: 12 }}>
                <button type="button" className="primary" onClick={() => startDoc(s.id, 'beginner')}>
                  Open draft sheet
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="session-panel">
          <div className="panel-card selected-plan">
            <p className="eyebrow">Daily conversation</p>
            <h3>Typing practice</h3>
            <p className="panel-copy">Use Practice → Conversation → Writing mode for chat-style drills.</p>
            <button type="button" className="primary wide" onClick={() => navigate('/')}>
              Go to Practice
            </button>
          </div>
        </aside>
      </section>
    </>
  );
}
