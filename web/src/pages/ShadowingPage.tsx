import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SHADOWING_LESSONS, getShadowingLesson } from '../data/shadowingLessons';
import { generateShadowingLesson } from '../lib/shadowingLessonAgent';
import { createShadowingTtsReader, type ShadowingTtsReader } from '../lib/shadowingTtsReader';
import { formatAccuracy, scoreShadowingLine } from '../lib/shadowingScoring';
import { estimateLineDurationMs, speakShadowingLine, startShadowingCapture, type ShadowingCaptureController } from '../lib/shadowingSpeech';
import type { ShadowingGenre, ShadowingLesson, ShadowingLine, ShadowingLineResult, ShadowingTextMode } from '../types';
import { LiveParticleOrb } from '../components/LiveParticleOrb';
import { loadSettings, saveSettings } from '../lib/storage';

type ShadowingStatus = 'ready' | 'countdown' | 'speaking_along' | 'capturing_tail' | 'feedback';

const COUNTDOWN_STEPS = [3, 2, 1];
const CAPTURE_TAIL_MS = 1500;

type ShadowingGapMode = 'pause' | 'continuous';
type ShadowingLength = 'brief' | 'standard' | 'full';

type ShadowingTopicPreset = {
  id: string;
  title: string;
  genre: ShadowingGenre;
  level: ShadowingLesson['level'];
  description: string;
};

const SHADOWING_TOPICS: ShadowingTopicPreset[] = [
  {
    id: 'travel-public-announcements',
    title: 'Travel announcements',
    genre: 'announcement',
    level: 'intermediate',
    description: 'Airport, train, hotel, transit, gate changes, boarding, delays, and public travel messages.',
  },
  {
    id: 'weather-and-daily-briefings',
    title: 'Weather briefings',
    genre: 'weather',
    level: 'intermediate',
    description: 'Morning weather, commute updates, weekend forecasts, safety notices, and local conditions.',
  },
  {
    id: 'radio-news-and-podcasts',
    title: 'Radio news',
    genre: 'radio',
    level: 'advanced',
    description: 'Short radio news, podcast intros, public affairs, business headlines, and community updates.',
  },
  {
    id: 'workplace-updates',
    title: 'Workplace updates',
    genre: 'meeting',
    level: 'advanced',
    description: 'Meeting summaries, project updates, operational notices, product launches, and team announcements.',
  },
  {
    id: 'customer-service-messages',
    title: 'Service messages',
    genre: 'service',
    level: 'intermediate',
    description: 'Customer support calls, store announcements, appointment reminders, policy updates, and help desk messages.',
  },
];

function paceText(label: ShadowingLineResult['paceLabel']): string {
  if (label === 'too_slow') return 'behind the model';
  if (label === 'too_fast') return 'ahead of the model';
  if (label === 'close') return 'close to model';
  return 'unknown pace';
}

function weakLine(result: ShadowingLineResult): boolean {
  return result.captureStatus !== 'captured' || result.accuracy < 0.82 || result.paceLabel !== 'close' || result.missingWords.length > 0;
}

function resultLabel(result: ShadowingLineResult): string {
  if (result.captureStatus === 'no_speech') return 'Not scored · no speech captured';
  if (result.captureStatus === 'missing_api_key') return 'Not scored · add OpenAI key';
  if (result.captureStatus === 'mic_unavailable') return 'Not scored · microphone blocked';
  if (result.captureStatus === 'transcription_failed') return `Not scored · transcription failed${result.captureError ? `: ${result.captureError}` : ''}`;
  if (result.captureStatus === 'capture_unavailable') return 'Not scored · capture unavailable';
  return `${formatAccuracy(result.accuracy)} · ${paceText(result.paceLabel)}`;
}

function captureStatusText(status: ShadowingLineResult['captureStatus']): string {
  if (status === 'captured') return 'Captured';
  if (status === 'no_speech') return 'No speech captured';
  if (status === 'missing_api_key') return 'Add OpenAI key for transcription';
  if (status === 'mic_unavailable') return 'Microphone blocked';
  if (status === 'transcription_failed') return 'Transcription failed';
  return 'Capture unavailable';
}

function lessonLinesForRun(lesson: ShadowingLesson, retryQueue: string[]): ShadowingLine[] {
  if (!retryQueue.length) return lesson.lines;
  const retrySet = new Set(retryQueue);
  return lesson.lines.filter((line) => retrySet.has(line.id));
}

function lineWithFocus(line: ShadowingLine): { before: string; focus: string; after: string } {
  const focus = line.focusPhrase?.trim();
  if (!focus) return { before: line.text, focus: '', after: '' };
  const idx = line.text.toLowerCase().indexOf(focus.toLowerCase());
  if (idx < 0) return { before: line.text, focus: '', after: '' };
  return {
    before: line.text.slice(0, idx),
    focus: line.text.slice(idx, idx + focus.length),
    after: line.text.slice(idx + focus.length),
  };
}

function playCountdownTone(step: number): void {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const existingCtx = (window as typeof window & { __hinttalkCountdownAudio?: AudioContext }).__hinttalkCountdownAudio;
  const ctx = existingCtx && existingCtx.state !== 'closed' ? existingCtx : new AudioContextCtor();
  (window as typeof window & { __hinttalkCountdownAudio?: AudioContext }).__hinttalkCountdownAudio = ctx;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const now = ctx.currentTime + 0.02;
  const root = step === 1 ? 740 : 520;
  osc.type = 'triangle';
  osc2.type = 'sine';
  osc.frequency.value = root;
  osc2.frequency.value = root * 1.5;
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(step === 1 ? 0.16 : 0.11, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc2.start(now + 0.025);
  osc.stop(now + 0.36);
  osc2.stop(now + 0.32);
}

export function ShadowingPage() {
  const [lessonId, setLessonId] = useState(SHADOWING_LESSONS[0]?.id ?? '');
  const [topicId, setTopicId] = useState(SHADOWING_TOPICS[0].id);
  const [speed, setSpeed] = useState(1);
  const [textMode, setTextMode] = useState<ShadowingTextMode>('visible');
  const [gapMode, setGapMode] = useState<ShadowingGapMode>(() => loadSettings().shadowingGapMode);
  const [gapSeconds, setGapSeconds] = useState(() => loadSettings().shadowingGapSeconds);
  const [passageLength, setPassageLength] = useState<ShadowingLength>(() => loadSettings().shadowingLength);
  const [status, setStatus] = useState<ShadowingStatus>('ready');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [results, setResults] = useState<ShadowingLineResult[]>([]);
  const [latestTranscript, setLatestTranscript] = useState('');
  const [retryQueue, setRetryQueue] = useState<string[]>([]);
  const [captureMessage, setCaptureMessage] = useState('');
  const [generatedLessons, setGeneratedLessons] = useState<ShadowingLesson[]>([]);
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [currentRunLine, setCurrentRunLine] = useState<ShadowingLine | null>(null);
  const [runTotal, setRunTotal] = useState(0);

  const cancelledRef = useRef(false);
  const captureRef = useRef<ShadowingCaptureController | null>(null);
  const readerRef = useRef<ShadowingTtsReader | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timersRef = useRef<number[]>([]);
  const runIdRef = useRef(0);

  const lessons = useMemo(() => (generatedLessons.length ? generatedLessons : SHADOWING_LESSONS), [generatedLessons]);
  const lesson = useMemo(() => lessons.find((item) => item.id === lessonId) ?? getShadowingLesson(lessonId) ?? lessons[0], [lessonId, lessons]);
  const topic = useMemo(() => SHADOWING_TOPICS.find((item) => item.id === topicId) ?? SHADOWING_TOPICS[0], [topicId]);
  const activeLines = useMemo(() => (lesson ? lessonLinesForRun(lesson, retryQueue) : []), [lesson, retryQueue]);
  const currentLine = currentRunLine ?? activeLines[lineIndex] ?? activeLines[0];
  const currentResult = currentLine ? results.find((r) => r.lineId === currentLine.id) : undefined;
  const effectiveTotal = runTotal || activeLines.length;
  const progress = effectiveTotal ? Math.min(1, lineIndex / effectiveTotal) : 0;
  const focusParts = currentLine ? lineWithFocus(currentLine) : { before: '', focus: '', after: '' };
  const isRunning = status === 'countdown' || status === 'speaking_along' || status === 'capturing_tail';
  const showActiveControls = isRunning || generatingLesson;
  const visibleText = textMode !== 'hidden' || status === 'ready' || status === 'countdown';
  const orbStatus = status === 'speaking_along' ? 'ai_speaking' : status === 'capturing_tail' ? 'listening' : status === 'countdown' ? 'connecting' : 'live';
  const micVisualActive = status === 'speaking_along' || status === 'capturing_tail';

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const updateShadowingPrefs = useCallback((partial: { shadowingLength?: ShadowingLength; shadowingGapMode?: ShadowingGapMode; shadowingGapSeconds?: number }) => {
    const current = loadSettings();
    saveSettings({ ...current, ...partial });
  }, []);

  const resetRun = useCallback(
    (nextLesson?: string) => {
      cancelledRef.current = true;
      runIdRef.current += 1;
      clearTimers();
      window.speechSynthesis?.cancel();
      void captureRef.current?.stop();
      captureRef.current = null;
      readerRef.current?.close();
      readerRef.current = null;
      setStatus('ready');
      setCountdown(null);
      setLineIndex(0);
      setResults([]);
      setLatestTranscript('');
      setRetryQueue([]);
      setCaptureMessage('');
      setGeneratingLesson(false);
      setGenerateError('');
      setCurrentRunLine(null);
      setRunTotal(0);
      if (nextLesson) setLessonId(nextLesson);
    },
    [clearTimers],
  );

  const runCountdown = useCallback(async (runId: number) => {
    setStatus('countdown');
    for (const step of COUNTDOWN_STEPS) {
      if (runId !== runIdRef.current || cancelledRef.current) return false;
      setCountdown(step);
      playCountdownTone(step);
      await new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, 650);
        timersRef.current.push(id);
      });
    }
    if (runId !== runIdRef.current || cancelledRef.current) return false;
    setCountdown(null);
    return true;
  }, []);

  const runLine = useCallback(
    async (line: ShadowingLine, index: number, runId: number, reader: ShadowingTtsReader | null, lessonForRun?: ShadowingLesson, shouldCountdown = true) => {
      if (runId !== runIdRef.current || cancelledRef.current) return false;
      setLineIndex(index);
      setCurrentRunLine(line);
      setLatestTranscript('');
      setCaptureMessage('');
      if (shouldCountdown) {
        const counted = await runCountdown(runId);
        if (!counted) return false;
      }
      setStatus('speaking_along');
      const settings = loadSettings();
      const transcriptionKey = settings.hintApiKey.trim() || settings.realtimeApiKey.trim();
      setCaptureMessage('Mic is listening...');
      captureRef.current = await startShadowingCapture({
        apiKey: transcriptionKey,
        baseUrl: settings.hintBaseUrl,
        model: settings.sttModel,
      });
      if (runId !== runIdRef.current || cancelledRef.current) return false;
      if (!captureRef.current) setCaptureMessage('Capture unavailable');
      let modelTiming: { startedAt: number; endedAt: number; durationMs: number };
      try {
        modelTiming = reader
          ? await reader.speakLine(line.text, { rate: speed, instructions: lessonForRun?.promptInstruction, model: lessonForRun?.ttsModel })
          : await speakShadowingLine(line.text, { rate: speed });
      } catch (error) {
        setGenerateError(error instanceof Error ? error.message : 'Speech playback failed');
        modelTiming = await speakShadowingLine(line.text, { rate: speed });
      }
      const modelDurationMs = modelTiming.durationMs || estimateLineDurationMs(line.text, speed);
      if (runId !== runIdRef.current || cancelledRef.current) return false;
      setStatus('capturing_tail');
      const tailMs = gapMode === 'continuous' ? 350 : Math.max(CAPTURE_TAIL_MS, gapSeconds * 1000);
      if (tailMs > 0) {
        await new Promise<void>((resolve) => {
          const id = window.setTimeout(resolve, tailMs);
          timersRef.current.push(id);
        });
      }
      if (runId !== runIdRef.current || cancelledRef.current) return false;
      const hadCapture = Boolean(captureRef.current);
      const capture = await captureRef.current?.stop();
      if (runId !== runIdRef.current || cancelledRef.current) return false;
      captureRef.current = null;
      const transcript = capture?.transcript ?? '';
      const captureError = capture?.errorMessage;
      const captureDurationMs = capture?.durationMs ?? modelDurationMs + CAPTURE_TAIL_MS;
      const captureStatus = capture?.status ?? (!hadCapture ? 'capture_unavailable' : transcript.trim() ? 'captured' : 'no_speech');
      setLatestTranscript(transcript);
      setCaptureMessage(captureStatusText(captureStatus));
      const result = scoreShadowingLine(line.id, line.text, transcript, {
        modelDurationMs,
        captureDurationMs,
      }, captureStatus, captureError);
      setResults((prev) => [...prev.filter((r) => r.lineId !== line.id), result]);
      return true;
    },
    [gapMode, gapSeconds, runCountdown, speed],
  );

  const startFullRun = useCallback(async () => {
    if (!activeLines.length || isRunning) return;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      const existingCtx = (window as typeof window & { __hinttalkCountdownAudio?: AudioContext }).__hinttalkCountdownAudio;
      const ctx = existingCtx && existingCtx.state !== 'closed' ? existingCtx : new AudioContextCtor();
      (window as typeof window & { __hinttalkCountdownAudio?: AudioContext }).__hinttalkCountdownAudio = ctx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    }
    cancelledRef.current = false;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    clearTimers();
    setResults([]);
    setRetryQueue([]);
    setLatestTranscript('');
    setCaptureMessage('Creating shadowing passage...');
    setGenerateError('');

    let runLines = activeLines;
    let runLesson = lesson;
    const settings = loadSettings();
    let reader: ShadowingTtsReader | null = null;

    if (settings.hintApiKey.trim() || settings.realtimeApiKey.trim()) {
      setGeneratingLesson(true);
      try {
        const next = await generateShadowingLesson(settings, {
          genre: topic.genre,
          level: topic.level,
          topicHint: topic.title,
          topicDescription: topic.description,
          lengthMode: passageLength,
          gapSeconds: gapMode === 'continuous' ? 0 : gapSeconds,
          continuous: gapMode === 'continuous',
        });
        if (runId !== runIdRef.current || cancelledRef.current) return;
        setGeneratedLessons((prev) => [next, ...prev].slice(0, 5));
        setLessonId(next.id);
        runLines = next.lines;
        runLesson = next;
        reader = createShadowingTtsReader(settings, remoteAudioRef.current);
        readerRef.current = reader;
        setCaptureMessage(reader ? 'Speech ready. Starting shadowing...' : 'Using browser voice.');
      } catch (error) {
        reader?.close();
        readerRef.current = null;
        setGenerateError(error instanceof Error ? error.message : 'Could not create shadowing lesson');
        setCaptureMessage('Lesson creation failed.');
        setStatus('ready');
        return;
      } finally {
        if (runId === runIdRef.current) setGeneratingLesson(false);
      }
    }
    setRunTotal(runLines.length);

    if (gapMode === 'continuous') {
      const counted = await runCountdown(runId);
      if (!counted) return;
    }

    for (let idx = 0; idx < runLines.length; idx += 1) {
      const completed = await runLine(runLines[idx], idx, runId, reader, runLesson, gapMode !== 'continuous');
      if (!completed || cancelledRef.current) return;
    }
    reader?.close();
    readerRef.current = null;
    setCurrentRunLine(null);
    if (runId !== runIdRef.current || cancelledRef.current) return;
    setStatus('feedback');
  }, [activeLines, clearTimers, gapMode, gapSeconds, isRunning, lesson, passageLength, runCountdown, runLine, topic]);

  const stopLine = useCallback(() => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    clearTimers();
    window.speechSynthesis?.cancel();
    void captureRef.current?.stop();
    captureRef.current = null;
    readerRef.current?.close();
    readerRef.current = null;
    setGeneratingLesson(false);
    setStatus('ready');
    setCountdown(null);
    setCaptureMessage('Cancelled');
    setCurrentRunLine(null);
    setRunTotal(0);
  }, [clearTimers]);

  const retryWeakLines = useCallback(() => {
    const queue = results.filter(weakLine).map((r) => r.lineId);
    if (!queue.length) return;
    setRetryQueue(queue);
    setLineIndex(0);
    setStatus('ready');
    setLatestTranscript('');
    setCaptureMessage('');
    setSpeed((value) => Math.min(value, 0.9));
  }, [results]);

  useEffect(() => {
    document.body.classList.add('voice-page');
    return () => {
      document.body.classList.remove('voice-page');
      cancelledRef.current = true;
      clearTimers();
      window.speechSynthesis?.cancel();
      void captureRef.current?.stop();
      readerRef.current?.close();
    };
  }, [clearTimers]);

  if (!lesson || !currentLine) {
    return (
      <main className="voice-app talking-room shadowing-page" style={{ padding: 24 }}>
        <p>No shadowing lessons found.</p>
      </main>
    );
  }

  const scoredResults = results.filter((result) => result.captureStatus === 'captured');
  const unscoredResults = results.filter((result) => result.captureStatus !== 'captured');
  const averageAccuracy = scoredResults.length
    ? scoredResults.reduce((sum, result) => sum + result.accuracy, 0) / scoredResults.length
    : 0;
  const weakResults = results.filter(weakLine);
  const totalResults = Math.max(results.length, activeLines.length);
  const paceMatchCount = results.filter((r) => r.paceLabel === 'close').length;

  if (status === 'feedback') {
    return (
      <main className="voice-app talking-room live-session-focus shadowing-page">
        <header className="voice-header voice-header--compact">
          <Link to="/live-voice" className="voice-header-back" aria-label="Back to Live Voice">
            <img className="voice-header-mark" src="/favicon.svg" width={24} height={24} alt="" decoding="async" />
            HintTalk
          </Link>
          <div className="voice-header-meta">
            <span className="voice-header-title">Shadowing feedback</span>
          </div>
          <div className="voice-header-trailing">
            <button type="button" className="voice-header-icon-btn" aria-label="Restart lesson" onClick={() => resetRun()}>
              ↻
            </button>
          </div>
        </header>

        <section className="shadowing-feedback-screen">
          <div className="shadowing-feedback-panel">
            <p className="live-voice-caption-tag">Session complete</p>
            <h1>{lesson.title}</h1>
            <div className="shadowing-feedback-metrics">
              <div>
                <strong>{scoredResults.length ? formatAccuracy(averageAccuracy) : '--'}</strong>
                <span>Estimated accuracy</span>
              </div>
              <div>
                <strong>{unscoredResults.length} / {totalResults}</strong>
                <span>Lines not scored</span>
              </div>
              <div>
                <strong>{paceMatchCount} / {totalResults}</strong>
                <span>Lines on pace</span>
              </div>
            </div>
            {unscoredResults.length ? (
              <p className="shadowing-feedback-note">
                Some lines were not scored because capture or transcription did not complete. API keys are stored per browser origin, so localhost and 127.0.0.1 do not share the same saved key.
              </p>
            ) : null}
            <div className="shadowing-feedback-list">
              {weakResults.length ? (
                weakResults.map((result) => (
                  <article key={result.lineId}>
                    <span>{resultLabel(result)}</span>
                    <div className="shadowing-feedback-lines">
                      <p>
                        <b>Target</b>
                        {result.target}
                      </p>
                      <p className={result.transcript ? '' : 'is-empty'}>
                        <b>You said</b>
                        {result.transcript || 'No transcript captured'}
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <article>
                  <span>Clean pass</span>
                  <p>No weak lines detected in this pass.</p>
                </article>
              )}
            </div>
            <div className="shadowing-feedback-actions">
              <button type="button" className="shadowing-control shadowing-control--primary" disabled={!weakResults.length} onClick={retryWeakLines}>
                Retry weak lines
              </button>
              <button type="button" className="shadowing-control" onClick={() => resetRun()}>
                Try again
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="voice-app talking-room live-session-focus shadowing-page">
      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      <header className="voice-header voice-header--compact">
        <Link to="/live-voice" className="voice-header-back" aria-label="Back to Live Voice">
          <img className="voice-header-mark" src="/favicon.svg" width={24} height={24} alt="" decoding="async" />
          HintTalk
        </Link>

        <div className="voice-header-meta">
          <div className="shadowing-mode-toggle" aria-label="Speaking mode">
            <Link to="/live-voice">Role-play</Link>
            <span className="is-active">Shadowing</span>
          </div>
          <div className="voice-header-select-wrap voice-header-topic-wrap">
            <select
              className="voice-header-select shadowing-lesson-select"
              value={topicId}
              disabled={isRunning}
              onChange={(event) => {
                setTopicId(event.target.value);
                setGeneratedLessons([]);
                resetRun(SHADOWING_LESSONS[0]?.id);
              }}
              aria-label="Choose shadowing topic"
            >
              {SHADOWING_TOPICS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
          <div className="voice-header-select-wrap shadowing-header-setting">
            <select className="voice-header-select" value={speed} disabled={isRunning} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Playback speed">
              <option value={0.8}>0.8x</option>
              <option value={0.9}>0.9x</option>
              <option value={1}>1.0x</option>
              <option value={1.1}>1.1x</option>
            </select>
          </div>
          <div className="voice-header-select-wrap shadowing-header-setting">
            <select className="voice-header-select" value={textMode} disabled={isRunning} onChange={(event) => setTextMode(event.target.value as ShadowingTextMode)} aria-label="Text mode">
              <option value="visible">Text visible</option>
              <option value="preview">Preview</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div className="voice-header-select-wrap shadowing-header-setting">
            <select className="voice-header-select" value={passageLength} disabled={isRunning} onChange={(event) => {
              const next = event.target.value as ShadowingLength;
              setPassageLength(next);
              updateShadowingPrefs({ shadowingLength: next });
            }} aria-label="Passage length">
              <option value="brief">Brief</option>
              <option value="standard">Standard</option>
              <option value="full">Full announcement</option>
            </select>
          </div>
          <div className="voice-header-select-wrap shadowing-header-setting">
            <select className="voice-header-select" value={gapMode === 'continuous' ? 'continuous' : String(gapSeconds)} disabled={isRunning} onChange={(event) => {
              if (event.target.value === 'continuous') {
                setGapMode('continuous');
                updateShadowingPrefs({ shadowingGapMode: 'continuous' });
              } else {
                setGapMode('pause');
                setGapSeconds(Number(event.target.value));
                updateShadowingPrefs({ shadowingGapMode: 'pause', shadowingGapSeconds: Number(event.target.value) });
              }
            }} aria-label="Gap between lines">
              <option value="continuous">No gap</option>
              <option value="1">1s gap</option>
              <option value="2">2s gap</option>
              <option value="3">3s gap</option>
              <option value="5">5s gap</option>
            </select>
          </div>
        </div>

        <div className="voice-header-trailing">
          <button type="button" className="voice-header-icon-btn" aria-label="Stop line" title="Stop line" onClick={stopLine}>
            ×
          </button>
        </div>
      </header>

      <section className="talk-stage talk-stage--focus talk-stage--tri shadowing-stage">
        <aside className="live-ai-script live-ai-script--top live-ai-script--compact shadowing-context" aria-label="Shadowing lesson context">
          <div className="live-ai-script-head">
            <span className="live-ai-script-tag">Shadowing</span>
            <span className="live-ai-script-title-inline">Speak along with the model voice</span>
          </div>
          <h1 className="shadowing-title">{lesson.title}</h1>
          <p className="shadowing-sub">
            Line {lineIndex + 1} of {effectiveTotal || activeLines.length} · {gapMode === 'continuous' ? 'no gap' : `${gapSeconds}s gap`} · headphones recommended
          </p>
        </aside>

        <div className="live-stage-columns shadowing-columns">
          <div className="live-caption-col" aria-live="polite">
            <div className="live-voice-caption-block live-voice-caption-block--script shadowing-line">
              <span className="live-voice-caption-tag live-voice-caption-tag--paired">
                <span className="live-voice-caption-tag-key">Now shadowing</span>
                <span className="live-voice-caption-tag-value">
                  <span className="shadowing-line-count">{lineIndex + 1}</span> / {effectiveTotal || activeLines.length}
                </span>
              </span>
              <p className="shadowing-text">
                {visibleText ? (
                  <>
                    {focusParts.before}
                    {focusParts.focus ? <span className="is-current">{focusParts.focus}</span> : null}
                    {focusParts.after}
                  </>
                ) : (
                  'Listen and follow the voice.'
                )}
              </p>
              {currentLine.focusPhrase && visibleText ? <span className="shadowing-phrase">{currentLine.focusPhrase}</span> : null}
            </div>
          </div>

          <div className="talk-main talk-core">
            <footer className="live-session-footer">
              <div className="live-orb-stack">
                <div className="conversation-pulse conversation-pulse--compact">
                  <LiveParticleOrb status={orbStatus}>
                    {countdown != null ? (
                      <div className="shadowing-countdown" aria-hidden="true">
                        <span>{countdown}</span>
                      </div>
                    ) : null}
                  </LiveParticleOrb>
                </div>
              </div>

              <div className={`voice-controls voice-controls--compact voice-controls--minimal live-voice-controls-row${showActiveControls ? '' : ' live-voice-controls-row--solo-mic'}`}>
                {showActiveControls ? (
                  <button type="button" className="live-voice-round-btn live-voice-round-btn--end" title="Stop" aria-label="Stop" onClick={stopLine}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
                <div className={`live-voice-mic-shell${micVisualActive ? ' live-voice-mic-shell--user-voice shadowing-mic-shell--active' : ''}`}>
                  <div className="live-voice-mic-shell__frame">
                    <button
                      type="button"
                      className={`live-voice-round-btn live-voice-round-btn--mic${micVisualActive ? ' live-voice-round-btn--mic-hot shadowing-mic-btn--active' : showActiveControls ? ' live-voice-round-btn--mic-processing-warm' : ' live-voice-round-btn--mic-start'}`}
                      title={showActiveControls ? 'Mic active' : 'Start shadowing'}
                      aria-label={showActiveControls ? 'Mic active' : 'Start shadowing'}
                      onClick={() => void startFullRun()}
                      disabled={showActiveControls}
                    >
                      {generatingLesson ? (
                        <span className="live-voice-round-btn__spinner" aria-hidden />
                      ) : showActiveControls ? (
                        <svg className="live-voice-mic-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                          <path d="M19 10v1a7 7 0 01-14 0v-1M12 19v3M9 22h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg className="live-voice-start-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <defs>
                            <linearGradient id="hinttalk-shadowing-start-grad" x1="12" y1="5" x2="12" y2="19" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#7ee8f4" />
                              <stop offset="42%" stopColor="#3fb7c8" />
                              <stop offset="100%" stopColor="#dff4e8" />
                            </linearGradient>
                          </defs>
                          <g stroke="url(#hinttalk-shadowing-start-grad)" strokeWidth="2.15" strokeLinecap="round">
                            <line x1="6" y1="9" x2="6" y2="15" />
                            <line x1="9" y1="7" x2="9" y2="17" />
                            <line x1="12" y1="5.5" x2="12" y2="18.5" />
                            <line x1="15" y1="7" x2="15" y2="17" />
                            <line x1="18" y1="9" x2="18" y2="15" />
                          </g>
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="live-voice-sr-only" role="status">
                    {status === 'ready' ? 'Ready to shadow full passage' : status.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="shadowing-status" aria-hidden="true">
                <span className="shadowing-dot" />
                <span>{status === 'ready' ? 'Ready' : status === 'countdown' ? 'Get ready' : 'Model voice + mic'}</span>
              </div>
            </footer>
          </div>

          <aside className="live-hint-rail" aria-label="Shadowing controls">
            <div className="live-hint-stack shadowing-rail">
              <div className="live-hint-card">
                <span className="live-voice-caption-tag live-hint-rail-tag">Progress</span>
                <div className="shadowing-mini-progress" aria-hidden="true">
                  <div className="shadowing-progress-track">
                    <span style={{ width: `${Math.max(6, progress * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="live-hint-card">
                <span className="live-voice-caption-tag live-hint-rail-tag">Captured</span>
                <p className="shadowing-capture-mini">
                  {generateError || latestTranscript || currentResult?.transcript || captureMessage || (isRunning || generatingLesson ? 'Mic is listening...' : 'Tap the mic to start.')}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
