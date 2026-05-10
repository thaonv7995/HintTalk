import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getScenarioById } from '../data/mockScenarios';
import type { HintLevel, HintTalkSession, SessionLaunchState } from '../types';
import { useScriptedChat } from '../hooks/useScriptedChat';
import { speakEnglish } from '../lib/speech';
import { newId } from '../lib/ids';
import { upsertSession } from '../lib/storage';
import { getSpeechRecognitionCtor, transcribeResults, type SpeechRecognitionInstance } from '../lib/webSpeech';

export function SpeakSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const launch = location.state as SessionLaunchState | undefined;

  const scenario = useMemo(() => (launch?.scenarioId ? getScenarioById(launch.scenarioId) : undefined), [launch]);
  const level: HintLevel = launch?.level ?? 'beginner';

  const scripted = useScriptedChat(scenario, level);
  const messages = scripted.messages;

  useEffect(() => {
    if (!launch) {
      navigate('/');
    }
  }, [launch, navigate]);

  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Browser TTS + scripted turns · use Live voice for OpenAI Realtime.');
  const [recording, setRecording] = useState(false);
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'ai'>('idle');
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionIdRef = useRef(newId());
  const startedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    document.body.classList.add('voice-page');
    return () => document.body.classList.remove('voice-page');
  }, []);

  useEffect(() => {
    if (!scenario || scenario.sessionKind !== 'chat') {
      navigate('/');
      return;
    }
    scripted.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scripted.reset identity varies; only re-init when scenario changes
  }, [scenario?.id, navigate]);

  useEffect(() => {
    if (!scenario?.turns.length) return;
    const lastAi = [...scripted.messages].reverse().find((m) => m.role === 'ai');
    if (lastAi) {
      setOrbState('ai');
      speakEnglish(lastAi.text);
      const t = window.setTimeout(() => setOrbState('idle'), Math.min(8000, lastAi.text.length * 60));
      return () => window.clearTimeout(t);
    }
  }, [scripted.messages, scenario]);

  const buildSession = (ended?: string): HintTalkSession | null => {
    if (!scenario || !launch) return null;
    return {
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
      endedAt: ended,
      turns: messages,
    };
  };

  const persistPartial = () => {
    const s = buildSession();
    if (s) upsertSession(s);
  };

  const endSession = () => {
    const s = buildSession(new Date().toISOString());
    if (s) upsertSession(s);
    navigate('/');
  };

  const toggleMic = () => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setStatus('Voice input not available. Type below instead.');
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
    setOrbState('listening');
    setStatus('Listening…');

    recognition.addEventListener('result', (event) => {
      setInput(transcribeResults(event));
    });
    recognition.addEventListener('end', () => {
      setRecording(false);
      setOrbState('idle');
      setStatus(input.trim() ? 'Edit transcript or send.' : 'No speech captured.');
    });
    recognition.addEventListener('error', () => {
      setRecording(false);
      setOrbState('idle');
      setStatus('Speech error. Type instead.');
    });
    recognition.start();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const added = scripted.sendUser(input, 'typed', scripted.currentHintText || undefined);
    if (added) {
      persistPartial();
      setInput('');
      setStatus('');
    }
  };

  const recent = messages.slice(-4);

  if (!launch || !scenario || scenario.sessionKind !== 'chat') {
    return (
      <p>
        Missing scenario. <Link to="/">Home</Link>
      </p>
    );
  }

  const lastAi = [...messages].reverse().find((m) => m.role === 'ai');

  const hintLabel =
    level === 'beginner'
      ? 'Beginner: full sentence'
      : level === 'intermediate'
        ? 'Intermediate: phrase hints'
        : 'Advanced: keywords';

  return (
    <main className="voice-app talking-room">
      <header className="voice-header">
        <Link to="/">HintTalk</Link>
        <div>
          <span>
            {scenario.title}
            {scenario.questionRange ? ` · ${scenario.questionRange}` : ''}
          </span>
          <span>
            User turns {messages.filter((m) => m.role === 'user').length} · {scenario.userRole} / {scenario.aiRole}
          </span>
          <span>{level}</span>
        </div>
      </header>

      <section className="talk-stage">
        <aside className="talk-left">
          {scenario.prompt ? (
            <section className="prompt-card compact">
              <p className="eyebrow">Prompt</p>
              <strong>{scenario.prompt}</strong>
              {scenario.promptVi ? <p className="scenario-prompt-vi">{scenario.promptVi}</p> : null}
            </section>
          ) : null}

          <section className="turn-stack">
            <p className="eyebrow">Recent turns</p>
            {recent.map((m) => (
              <div key={m.id} className={`turn-line ${m.role}`}>
                <span>{m.role === 'ai' ? 'AI' : 'You'}</span>
                <p>{m.text}</p>
              </div>
            ))}
          </section>

          <section className="status-card">
            <div>
              <strong>Speak mode</strong>
              <span>Scripted dialogue · Sidebar → Live voice for realtime AI</span>
            </div>
          </section>
        </aside>

        <section className="talk-center">
          <div className="speaker-row">
            <div className="avatar user-avatar">You</div>
            <div className="conversation-pulse">
              <div className={`voice-orb${orbState !== 'idle' ? ' active' : ''}`} data-state={orbState}>
                <i />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="wave-bars" aria-hidden style={{ opacity: orbState === 'ai' ? 1 : 0.35 }}>
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
              </div>
            </div>
            <div className="avatar ai-avatar">AI</div>
          </div>

          <div className="live-caption">
            <p className="eyebrow">{orbState === 'ai' ? 'AI script' : orbState === 'listening' ? 'Your turn' : 'Practice room'}</p>
            <h1>{lastAi?.text ?? '…'}</h1>
          </div>

          <div className="talk-status">
            <div>
              <span className="status-dot" />
              {status || (orbState === 'listening' ? 'Listening' : orbState === 'ai' ? 'AI speaking (browser TTS)' : 'Ready')}
            </div>
            <div>Hint ready</div>
          </div>

          <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 10 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your line, or use the mic…"
              rows={2}
              style={{
                width: '100%',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,.18)',
                background: 'rgba(255,255,255,.06)',
                color: '#eff8f3',
                padding: 12,
              }}
            />
            <div className="voice-controls">
              <button type="button" className="round danger" onClick={endSession}>
                ×
              </button>
              <button type="button" className="round mic live" onClick={toggleMic}>
                🎙
              </button>
              <button type="submit" className="round">
                ▶
              </button>
            </div>
          </form>
        </section>

        <aside className="talk-right">
          <section className="hint-card-live focus">
            <p>Hint</p>
            <strong>{scripted.currentHintText}</strong>
            <small>{hintLabel}</small>
          </section>

          {scenario.planSteps?.length ? (
            <section className="answer-plan">
              <p className="eyebrow">Answer structure</p>
              {scenario.planSteps.map((step) => (
                <div key={step.step}>
                  <span>{step.step}</span>
                  <strong>{step.title}</strong>
                  <small>{step.hint}</small>
                </div>
              ))}
            </section>
          ) : null}

          <section className="hint-card-live">
            <p className="eyebrow" style={{ letterSpacing: '0.12em' }}>
              Quick actions
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" className="round" style={{ width: '100%', borderRadius: 14 }} onClick={() => scripted.cycleHint()}>
                Another hint
              </button>
              <button
                type="button"
                className="round"
                style={{ width: '100%', borderRadius: 14 }}
                onClick={() => setInput(scripted.applyBeginnerHintToComposer())}
              >
                Fill beginner line
              </button>
              <button type="button" className="round" style={{ width: '100%', borderRadius: 14 }} onClick={() => lastAi && speakEnglish(lastAi.text)}>
                Replay AI
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
