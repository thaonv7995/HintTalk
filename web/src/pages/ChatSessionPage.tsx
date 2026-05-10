import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getScenarioById } from '../data/mockScenarios';
import type { ConversationTurn, HintLevel, HintTalkSession, SessionLaunchState } from '../types';
import { useScriptedChat } from '../hooks/useScriptedChat';
import { speakEnglish } from '../lib/speech';
import { getSpeechRecognitionCtor, transcribeResults, type SpeechRecognitionInstance } from '../lib/webSpeech';
import { newId } from '../lib/ids';
import { upsertSession, loadSettings } from '../lib/storage';
import { fetchNextAiLine } from '../lib/dialogueAgent';
import { generateHintPayload, hintAtLevel, type HintPayload } from '../lib/hintAgent';
import { TechnicalLog, PracticeTimerBar } from '../components/TechnicalLog';

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export function ChatSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const launch = location.state as SessionLaunchState | undefined;

  const scenario = useMemo(() => (launch?.scenarioId ? getScenarioById(launch.scenarioId) : undefined), [launch]);
  const level: HintLevel = launch?.level ?? 'beginner';
  const settings = useMemo(() => loadSettings(), []);

  const llmOk = Boolean(settings.hintApiKey?.trim() && settings.hintBaseUrl?.trim() && settings.hintModel?.trim());

  const scripted = useScriptedChat(scenario, level);

  const [llmMessages, setLlmMessages] = useState<ConversationTurn[]>([]);
  const [apiHints, setApiHints] = useState<HintPayload | null>(null);
  const [hintIx, setHintIx] = useState(0);
  const [techLog, setTechLog] = useState<string[]>([]);
  const [hintLoading, setHintLoading] = useState(false);

  const pushLog = useCallback((line: string) => {
    setTechLog((prev) => [...prev.slice(-200), `${ts()} ${line}`]);
  }, []);

  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionIdRef = useRef(newId());
  const startedAtRef = useRef(new Date().toISOString());
  const [practiceStartMs, setPracticeStartMs] = useState<number | null>(null);

  const messages = llmOk ? llmMessages : scripted.messages;

  /** Prefer Hint-model output; scripted scenario hints only after AI fails or is unavailable. */
  const hintDisplay = llmOk
    ? hintLoading
      ? 'Loading hint…'
      : apiHints
        ? hintAtLevel(apiHints, level, hintIx)
        : scripted.currentHintText || 'AI hint unavailable — check Hint Model in Settings.'
    : scripted.currentHintText;

  useEffect(() => {
    if (!scenario || scenario.sessionKind !== 'chat') {
      navigate('/');
    }
  }, [scenario, navigate]);

  useEffect(() => {
    if (!scenario?.turns.length || scenario.sessionKind !== 'chat') return;

    setPracticeStartMs(Date.now());
    if (!llmOk) {
      scripted.reset();
      setApiHints(null);
      pushLog('Engine: scripted (add Hint Model + OpenAI base URL for AI dialogue)');
      return;
    }

    const first = scenario.turns[0]?.ai;
    if (!first) return;
    const open: ConversationTurn = {
      id: newId(),
      speaker: scenario.aiRole,
      role: 'ai',
      text: first,
      createdAt: new Date().toISOString(),
    };
    setLlmMessages([open]);
    setHintIx(0);
    pushLog('Engine: LLM orchestration');
    void (async () => {
      setHintLoading(true);
      try {
        const h = await generateHintPayload(settings, scenario, level, [open], first);
        setApiHints(h);
        pushLog('Hints loaded');
      } catch (e) {
        setApiHints(null);
        pushLog(`Hint init error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setHintLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional init when scenario id or llm toggles
  }, [scenario?.id, scenario?.sessionKind, llmOk]);

  useEffect(() => {
    if (!scenario?.turns.length) return;
    const lastAi = [...messages].reverse().find((m) => m.role === 'ai');
    if (lastAi) speakEnglish(lastAi.text);
  }, [messages, scenario]);

  const persistPartial = () => {
    if (!scenario || !launch) return;
    const session: HintTalkSession = {
      id: sessionIdRef.current,
      practiceType: scenario.practiceType,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      toeicTaskType: scenario.toeicTaskType,
      toeicSection: scenario.toeicSection,
      questionRange: scenario.questionRange,
      prompt: scenario.prompt,
      mode: launch.mode,
      level,
      roles: { ai: scenario.aiRole, user: scenario.userRole },
      startedAt: startedAtRef.current,
      turns: messages,
    };
    upsertSession(session);
  };

  const endSession = () => {
    if (!scenario || !launch) return;
    const session: HintTalkSession = {
      id: sessionIdRef.current,
      practiceType: scenario.practiceType,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      toeicTaskType: scenario.toeicTaskType,
      toeicSection: scenario.toeicSection,
      questionRange: scenario.questionRange,
      prompt: scenario.prompt,
      mode: launch.mode,
      level,
      roles: { ai: scenario.aiRole, user: scenario.userRole },
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      turns: messages,
    };
    upsertSession(session);
    navigate('/');
  };

  const toggleMic = () => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setStatus('Voice input is not available in this browser. Type your reply.');
      return;
    }
    if (recording && recRef.current) {
      recRef.current.stop();
      return;
    }
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recRef.current = recognition;
    setRecording(true);
    setStatus('Listening...');

    recognition.addEventListener('result', (event) => {
      setInput(transcribeResults(event));
    });
    recognition.addEventListener('end', () => {
      setRecording(false);
      setStatus(input.trim() ? 'Transcript ready. Edit or send.' : 'No speech captured.');
    });
    recognition.addEventListener('error', () => {
      setRecording(false);
      setStatus('Could not capture speech. Try again or type.');
    });
    recognition.start();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !scenario || !launch) return;

    if (!llmOk) {
      const added = scripted.sendUser(text, 'typed', scripted.currentHintText || undefined);
      if (added) {
        persistPartial();
        setInput('');
        setStatus('');
      }
      return;
    }

    const hintShown = hintDisplay || undefined;
    const userTurn: ConversationTurn = {
      id: newId(),
      speaker: scenario.userRole,
      role: 'user',
      text,
      inputMode: 'typed',
      hintShown,
      createdAt: new Date().toISOString(),
    };
    const base = [...llmMessages, userTurn];
    setLlmMessages(base);
    setInput('');
    pushLog(`send: user (${text.slice(0, 80)})`);

    try {
      const aiText = await fetchNextAiLine(settings, scenario, base);
      const aiTurn: ConversationTurn = {
        id: newId(),
        speaker: scenario.aiRole,
        role: 'ai',
        text: aiText,
        createdAt: new Date().toISOString(),
      };
      const next = [...base, aiTurn];
      setLlmMessages(next);
      persistPartial();
      setHintLoading(true);
      try {
        const h = await generateHintPayload(settings, scenario, level, next, aiText);
        setApiHints(h);
        setHintIx(0);
      } catch (err) {
        pushLog(`hint after AI: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setHintLoading(false);
      }
    } catch (err) {
      pushLog(`dialogue error: ${err instanceof Error ? err.message : String(err)}`);
      const aiTurn: ConversationTurn = {
        id: newId(),
        speaker: scenario.aiRole,
        role: 'ai',
        text: "I'm having a connection issue. Try sending again, or check Settings → Hint Model and use `npm run dev` proxy for OpenAI.",
        createdAt: new Date().toISOString(),
      };
      setLlmMessages([...base, aiTurn]);
      persistPartial();
    }
  };

  const repeatAi = () => {
    const lastAi = [...messages].reverse().find((m) => m.role === 'ai');
    if (lastAi) speakEnglish(lastAi.text);
  };

  const phraseBank = useMemo(() => {
    const fromAi = llmOk && apiHints?.usefulPhrases?.length ? apiHints.usefulPhrases : [];
    if (!scenario) return fromAi;
    const rest = scenario.phraseBank.filter((p) => !fromAi.includes(p));
    return [...fromAi, ...rest];
  }, [scenario, llmOk, apiHints]);

  if (!scenario || scenario.sessionKind !== 'chat') {
    return (
      <p>
        Missing scenario. <Link to="/">Return home</Link>
      </p>
    );
  }

  const hintLabel =
    level === 'beginner' ? 'Full sentence' : level === 'intermediate' ? 'Phrase hints' : 'Keywords';

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{scenario.practiceType === 'toeic' ? 'TOEIC practice' : 'Daily conversation'}</p>
          <h2>{scenario.title}</h2>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            {llmOk ? 'AI dialogue + hints via Hint Model settings' : 'Scripted dialogue · add API key + OpenAI base URL for live AI'}
          </p>
        </div>
        <div className="top-actions">
          {settings.showPracticeTimer ? <PracticeTimerBar active={practiceStartMs !== null} startedAt={practiceStartMs} /> : null}
          <button type="button" className="soft" onClick={() => navigate(-1)}>
            Back
          </button>
          <button type="button" className="primary" onClick={endSession}>
            End session
          </button>
        </div>
      </header>

      <section className="editor-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
        <section className="document-editor" style={{ minHeight: 440 }}>
          <div className="doc-toolbar">
            <span>Chat practice · {llmOk ? 'LLM' : 'Script'}</span>
            <span>{messages.length} turns</span>
          </div>
          <div
            className="chat-log"
            style={{
              border: '1px solid var(--line)',
              borderRadius: 14,
              minHeight: 400,
              background: '#fff',
              padding: 18,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {messages.map((m) => (
              <article
                key={m.id}
                className={`message ${m.role}`}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                }}
              >
                <span>{m.speaker}</span>
                <p
                  style={{
                    margin: 0,
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: m.role === 'ai' ? '#eef4ef' : 'var(--teal)',
                    color: m.role === 'ai' ? 'inherit' : '#062125',
                  }}
                >
                  {m.text}
                </p>
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10 }}>
            <button type="button" className="primary" onClick={toggleMic} style={{ display: launch?.mode === 'speak' ? 'grid' : 'none' }}>
              {recording ? 'Stop' : 'Mic'}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={launch?.mode === 'speak' ? 'Speak or type your response…' : 'Type your response…'}
              rows={2}
              style={{ resize: 'vertical', minHeight: 48 }}
            />
            <button type="submit" className="primary">
              Send
            </button>
          </form>
          {status ? (
            <p className="status-line" style={{ marginTop: 8 }}>
              {status}
            </p>
          ) : null}

          <TechnicalLog lines={techLog} />
        </section>

        <aside className="writing-hints">
          <p className="eyebrow">Hint</p>
          <h3 style={{ marginTop: 8 }}>{hintLabel}</h3>
          <p style={{ fontWeight: 850, lineHeight: 1.45 }}>{hintDisplay}</p>
          <div className="hint-actions top-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="soft" onClick={() => (llmOk ? setHintIx((i) => i + 1) : scripted.cycleHint())}>
              Another hint
            </button>
            <button
              type="button"
              className="soft"
              onClick={() => {
                if (llmOk && apiHints) {
                  const line = hintAtLevel(apiHints, level, hintIx);
                  if (line) setInput(line);
                  return;
                }
                setInput(scripted.applyBeginnerHintToComposer());
              }}
            >
              Paste hint
            </button>
            <button type="button" className="soft" onClick={repeatAi}>
              Replay AI
            </button>
          </div>
          <div className="phrase-bank" style={{ marginTop: 14 }}>
            <p className="eyebrow">Phrase bank</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {phraseBank.map((p) => (
                <button key={p} type="button" className="soft" style={{ borderRadius: 999, fontSize: '0.88rem' }} onClick={() => setInput((v) => (v ? `${v} ${p}` : p))}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {scenario.prompt ? (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <p className="eyebrow">Prompt</p>
              <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{scenario.prompt}</p>
              {scenario.promptVi ? <p className="scenario-prompt-vi">{scenario.promptVi}</p> : null}
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}
