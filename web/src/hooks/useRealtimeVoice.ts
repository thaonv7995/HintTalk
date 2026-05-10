import { useCallback, useRef, useState, type RefObject } from 'react';
import type { ConversationTurn, HintLevel, LiveVoiceSpeaksFirst, MockScenario } from '../types';
import { buildRealtimeSessionJson, exchangeRealtimeSdp } from '../lib/openaiRealtime';
import { newId } from '../lib/ids';

export type LiveUiStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'listening'
  | 'ai_speaking'
  | 'cooldown'
  | 'ended'
  | 'error';

/** Minimal typing for OpenAI Realtime data-channel JSON lines */
type RealtimeJsonEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  session?: { model?: string };
  rate_limits?: { name?: string; remaining?: number; limit?: number }[];
  response?: {
    status?: string;
    status_details?: { error?: { code?: string; message?: string } };
  };
  item?: { role?: string; content?: { transcript?: string }[] };
};

type RealtimeOpts = {
  scenario: MockScenario;
  level: HintLevel;
  speaksFirst: LiveVoiceSpeaksFirst;
  userRoleLabel: string;
  apiKey: string;
  model: string;
  voice: string;
  cooldownSeconds: number;
  /** Auto-open mic after each AI cooldown (vs tap mic each turn). */
  micHandsFree?: boolean;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  onAiLineComplete?: (text: string) => void;
  onUserTranscript?: (text: string) => void;
};

export function useRealtimeVoice({
  scenario,
  level,
  speaksFirst,
  userRoleLabel,
  apiKey,
  model,
  voice,
  cooldownSeconds,
  micHandsFree = false,
  remoteAudioRef,
  onAiLineComplete,
  onUserTranscript,
}: RealtimeOpts) {
  const [uiStatus, setUiStatus] = useState<LiveUiStatus>('idle');
  const [statusLine, setStatusLine] = useState('');
  const [aiCaption, setAiCaption] = useState('');
  const [muted, setMuted] = useState(true);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);
  const [rateLimitSummary, setRateLimitSummary] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const recentTurnsRef = useRef<ConversationTurn[]>([]);
  const activeAiTranscriptRef = useRef('');
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownUntilRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micMeterFrameRef = useRef<number | null>(null);
  /** Smoothed RMS mic level 0–1 for orb reactivity (updated every animation frame while meter runs). */
  const micLevelRef = useRef(0);
  const micHandsFreeRef = useRef(micHandsFree);
  micHandsFreeRef.current = micHandsFree;

  const pushLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-200), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  }, []);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    cooldownUntilRef.current = 0;
    setCooldownRemaining(null);
  }, []);

  const startCooldown = useCallback(() => {
    clearCooldownTimer();
    cooldownUntilRef.current = Date.now() + cooldownSeconds * 1000;
    setUiStatus('cooldown');
    setMuted(true);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });

    cooldownTimerRef.current = setInterval(() => {
      const left = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
      if (left > 0) {
        setCooldownRemaining(left);
        setStatusLine(`Wait ${left}s`);
        return;
      }
      clearCooldownTimer();
      setUiStatus('live');
      setStatusLine('Ready for next turn');
      pushLog('Cooldown ended.');
      const streamAfterCd = localStreamRef.current;
      if (micHandsFreeRef.current && streamAfterCd?.getAudioTracks().length) {
        setMuted(false);
        streamAfterCd.getAudioTracks().forEach((tr) => {
          tr.enabled = true;
        });
        setStatusLine('Speak…');
      }
    }, 250);
    setCooldownRemaining(cooldownSeconds);
    setStatusLine(`Wait ${cooldownSeconds}s`);
    pushLog(`Cooldown ${cooldownSeconds}s`);
  }, [clearCooldownTimer, cooldownSeconds, pushLog]);

  const teardownMicLevelMeter = useCallback(() => {
    if (micMeterFrameRef.current != null) {
      cancelAnimationFrame(micMeterFrameRef.current);
      micMeterFrameRef.current = null;
    }
    try {
      micAnalyserRef.current?.disconnect();
    } catch {
      /* noop */
    }
    micAnalyserRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    micLevelRef.current = 0;
  }, []);

  const cleanupConnectionResources = useCallback(
    (pc?: RTCPeerConnection | null) => {
      clearCooldownTimer();
      teardownMicLevelMeter();
      try {
        dcRef.current?.close();
      } catch {
        /* noop */
      }
      dcRef.current = null;

      const activePc = pc ?? pcRef.current;
      try {
        activePc?.getSenders().forEach((s) => s.track?.stop());
        activePc?.close();
      } catch {
        /* noop */
      }
      if (!pc || pcRef.current === pc) pcRef.current = null;

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      const a = remoteAudioRef.current;
      if (a) {
        a.pause();
        a.srcObject = null;
      }
    },
    [clearCooldownTimer, remoteAudioRef, teardownMicLevelMeter],
  );

  const setupMicLevelMeter = useCallback(
    async (stream: MediaStream) => {
      teardownMicLevelMeter();
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        micAnalyserRef.current = analyser;
        const data = new Uint8Array(analyser.fftSize);
        let smoothed = 0;
        const loop = () => {
          const a = micAnalyserRef.current;
          if (!a) return;
          a.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const instant = Math.min(1, rms * 5.8);
          smoothed = smoothed * 0.74 + instant * 0.26;
          micLevelRef.current = smoothed;
          micMeterFrameRef.current = requestAnimationFrame(loop);
        };
        micMeterFrameRef.current = requestAnimationFrame(loop);
      } catch {
        micLevelRef.current = 0;
      }
    },
    [teardownMicLevelMeter],
  );

  const handleEvent = useCallback(
    (raw: string) => {
      let event: RealtimeJsonEvent;
      try {
        event = JSON.parse(raw) as RealtimeJsonEvent;
      } catch {
        return;
      }
      const t = event.type;
      if (t === 'session.created') {
        pushLog(`Session created model=${event.session?.model ?? '?'}`);
        return;
      }
      if (t === 'input_audio_buffer.speech_started') {
        setUiStatus('listening');
        setStatusLine('Listening');
        pushLog('Speech started');
        return;
      }
      if (t === 'input_audio_buffer.speech_stopped') {
        setStatusLine('Processing');
        pushLog('Speech stopped');
        return;
      }
      if (t === 'conversation.item.input_audio_transcription.completed') {
        const transcript = event.transcript || '';
        pushLog(`You: ${transcript}`);
        const turn: ConversationTurn = {
          id: newId(),
          speaker: userRoleLabel,
          role: 'user',
          text: transcript,
          inputMode: 'realtime_audio',
          createdAt: new Date().toISOString(),
        };
        recentTurnsRef.current.push(turn);
        onUserTranscript?.(transcript);
        return;
      }
      if (t === 'response.output_audio_transcript.delta') {
        const piece = event.delta || '';
        if (!activeAiTranscriptRef.current && piece) {
          setMuted(true);
          localStreamRef.current?.getAudioTracks().forEach((tr) => {
            tr.enabled = false;
          });
        }
        setUiStatus('ai_speaking');
        setStatusLine('AI speaking');
        activeAiTranscriptRef.current += piece;
        const acc = activeAiTranscriptRef.current.trim();
        if (acc) setAiCaption(acc);
        return;
      }
      if (t === 'response.output_audio_transcript.done') {
        const transcript = event.transcript || activeAiTranscriptRef.current;
        activeAiTranscriptRef.current = '';
        pushLog(`AI: ${transcript}`);
        setAiCaption(transcript || '…');
        const turn: ConversationTurn = {
          id: newId(),
          speaker: scenario.aiRole,
          role: 'ai',
          text: transcript,
          createdAt: new Date().toISOString(),
        };
        recentTurnsRef.current.push(turn);
        onAiLineComplete?.(transcript);
        return;
      }
      if (t === 'conversation.item.done' && event.item?.role === 'assistant') {
        const transcript = event.item?.content?.find((p) => p.transcript)?.transcript;
        if (transcript) setAiCaption(transcript);
        return;
      }
      if (t === 'response.done' && event.response?.status === 'failed') {
        const err = event.response?.status_details?.error;
        pushLog(`FAILED ${err?.code ?? ''} ${err?.message ?? ''}`);
        setUiStatus('error');
        setStatusLine(err?.message || 'Error');
        if (err?.code === 'rate_limit_exceeded') startCooldown();
        return;
      }
      if (t === 'response.done' && event.response?.status === 'completed') {
        pushLog('AI response completed');
        setUiStatus('live');
        startCooldown();
        return;
      }
      if (t === 'rate_limits.updated') {
        const lim = event.rate_limits?.[0];
        if (lim?.name != null && lim.remaining != null && lim.limit != null) {
          const s = `${lim.name}: ${lim.remaining}/${lim.limit}`;
          setRateLimitSummary(s);
          pushLog(`Rate limit ${s}`);
        }
      }
    },
    [onAiLineComplete, onUserTranscript, pushLog, scenario.aiRole, startCooldown, userRoleLabel],
  );

  const disconnect = useCallback(() => {
    cleanupConnectionResources();
    setMuted(true);
    setUiStatus('ended');
    setStatusLine('');
    activeAiTranscriptRef.current = '';
    setAiCaption('');
    pushLog('Disconnected');
  }, [cleanupConnectionResources, pushLog]);

  const connect = useCallback(async () => {
    if (!apiKey.trim()) {
      setUiStatus('error');
      setStatusLine('Add OpenAI API key in Settings');
      return;
    }
    recentTurnsRef.current = [];
    pushLog('Connecting…');
    setUiStatus('connecting');
    setStatusLine('Connecting…');
    setAiCaption('Connecting…');

    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        pushLog(`connectionState=${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          setUiStatus('live');
          setAiCaption('');
          const stream = localStreamRef.current;
          if (speaksFirst === 'user' && micHandsFreeRef.current && stream?.getAudioTracks().length) {
            setMuted(false);
            stream.getAudioTracks().forEach((tr) => {
              tr.enabled = true;
            });
            setStatusLine('Speak…');
          } else if (speaksFirst === 'user') {
            setStatusLine('Your turn — tap mic to speak');
          } else {
            setStatusLine('Live');
          }
        }
        if (['failed', 'closed'].includes(pc.connectionState)) {
          setUiStatus((u) => (u === 'ended' ? 'ended' : 'error'));
        }
      };

      pc.ontrack = (ev) => {
        const audio = remoteAudioRef.current;
        if (audio && ev.streams[0]) {
          audio.srcObject = ev.streams[0];
          void audio.play().catch(() => {});
        }
        pushLog('Remote audio track');
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => {
        track.enabled = false;
        pc?.addTrack(track, stream);
      });
      setMuted(true);
      void setupMicLevelMeter(stream);
      pushLog('Mic attached (muted)');
    } catch (error) {
      try {
        pc?.addTransceiver('audio', { direction: 'recvonly' });
        pushLog('Mic unavailable; recvonly');
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError || error);
        pushLog(`Connection error: ${message}`);
        cleanupConnectionResources(pc);
        setUiStatus('error');
        setStatusLine('Connection failed');
        return;
      }
    }

    try {
      if (!pc) throw new Error('Could not create peer connection');
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onopen = () => pushLog('Data channel open');
      dc.onmessage = (ev) => handleEvent(String(ev.data || ''));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sessionJson = buildRealtimeSessionJson(scenario, level, model, voice, speaksFirst);
      const ex = await exchangeRealtimeSdp(apiKey.trim(), offer.sdp || '', sessionJson);

      if (!ex.ok || !ex.answerSdp) {
        throw new Error(`SDP error: ${ex.errorText ?? 'unknown'}`);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: ex.answerSdp });
      pushLog('WebRTC answer applied');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog(`Connection error: ${message}`);
      cleanupConnectionResources(pc);
      setUiStatus('error');
      setStatusLine('Connection failed');
    }
  }, [
    apiKey,
    cleanupConnectionResources,
    handleEvent,
    level,
    model,
    pushLog,
    remoteAudioRef,
    scenario,
    setupMicLevelMeter,
    speaksFirst,
    voice,
  ]);

  const toggleMute = useCallback(() => {
    if (Date.now() < cooldownUntilRef.current && cooldownUntilRef.current > 0) {
      const s = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
      setStatusLine(`Wait ${s}s`);
      return;
    }
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (!next) {
      void audioCtxRef.current?.resume().catch(() => {});
    }
    setStatusLine(next ? 'Mic muted' : 'Speak…');
    pushLog(next ? 'Muted' : 'Unmuted');
  }, [muted, pushLog]);

  const getTurns = useCallback(() => [...recentTurnsRef.current], []);

  return {
    uiStatus,
    statusLine,
    aiCaption,
    muted,
    logLines,
    cooldownRemaining,
    rateLimitSummary,
    connect,
    disconnect,
    toggleMute,
    pushLog,
    getTurns,
    micLevelRef,
    clearLogs: () => setLogLines([]),
  };
}
