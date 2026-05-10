import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getScenarioById } from '../data/mockScenarios';
import type { HintLevel, HintTalkSession, SessionLaunchState } from '../types';
import { newId } from '../lib/ids';
import { upsertSession } from '../lib/storage';

export function DocSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const launch = location.state as SessionLaunchState | undefined;
  const scenario = useMemo(() => (launch?.scenarioId ? getScenarioById(launch.scenarioId) : undefined), [launch]);
  const level = launch?.level ?? 'beginner';

  const [draft, setDraft] = useState('');
  const sessionIdRef = useRef(newId());
  const startedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (scenario?.sessionKind === 'document') setDraft(scenario.defaultDraft ?? '');
  }, [scenario?.id, scenario?.sessionKind, scenario?.defaultDraft]);

  if (!scenario || scenario.sessionKind !== 'document' || !launch) {
    return (
      <p>
        Choose a writing task from <Link to="/writing">Writing</Link>.
      </p>
    );
  }

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  const saveAttempt = () => {
    const session: HintTalkSession = {
      id: sessionIdRef.current,
      practiceType: scenario.practiceType,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      toeicTaskType: scenario.toeicTaskType,
      toeicSection: scenario.toeicSection,
      questionRange: scenario.questionRange,
      prompt: scenario.prompt,
      mode: 'write',
      level: level as HintLevel,
      roles: { ai: scenario.aiRole, user: scenario.userRole },
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      turns: [
        {
          id: newId(),
          speaker: scenario.userRole,
          role: 'user',
          text: draft,
          inputMode: 'typed',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    upsertSession(session);
    navigate('/history');
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            TOEIC Writing {scenario.questionRange ? `· ${scenario.questionRange}` : ''}
          </p>
          <h2>{scenario.title}</h2>
        </div>
        <div className="top-actions">
          <button type="button" className="soft" onClick={() => navigate('/writing')}>
            Back
          </button>
          <button type="button" className="primary" onClick={saveAttempt}>
            Save attempt
          </button>
        </div>
      </header>

      <section className="editor-layout">
        <aside className="prompt-sheet">
          <p className="eyebrow">Task</p>
          <h3>{scenario.title}</h3>
          <p>{scenario.prompt}</p>
          {scenario.promptVi ? <p className="scenario-prompt-vi">{scenario.promptVi}</p> : null}
          {scenario.planSteps?.length ? (
            <div className="plan-steps" style={{ marginTop: 16 }}>
              {scenario.planSteps.map((s) => (
                <div key={s.step}>
                  <span>{s.step}</span>
                  <strong>{s.title}</strong>
                  <small>{s.hint}</small>
                </div>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="document-editor">
          <div className="doc-toolbar">
            <span>Draft</span>
            <span>{words} words</span>
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write your response…" />
        </section>

        <aside className="writing-hints">
          <p className="eyebrow">Hint</p>
          <h3>Use structure, not a full model answer.</h3>
          <ul>
            {(scenario.docHints ?? []).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="eyebrow" style={{ marginTop: 18 }}>
            Phrase bank
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {scenario.phraseBank.map((p) => (
              <button key={p} type="button" className="soft" style={{ borderRadius: 999 }} onClick={() => setDraft((d) => (d ? `${d}\n${p}` : p))}>
                {p}
              </button>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}
