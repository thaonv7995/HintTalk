import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScenarioById } from '../data/mockScenarios';
import {
  LIVE_VOICE_TOPIC_PRESETS,
  LIVE_VOICE_TOPIC_PRESETS_GROUPED,
  getLiveVoiceTopicPreset,
  liveVoiceUiScenePreview,
} from '../data/liveVoiceTopicPresets';
import { REALTIME_VOICE_OPTIONS } from '../data/realtimeVoiceOptions';
import { TTS_VOICE_MODELS } from '../data/ttsVoiceModels';
import type { ConversationTurn, HintTalkSession, LiveVoiceSetup, MockScenario, RepairDecision, SessionLaunchState, StoredSettings } from '../types';
import { loadLiveVoiceSetup, loadSettings, saveLiveVoiceSetup, saveSettings, upsertSession } from '../lib/storage';
import { newId } from '../lib/ids';
import { useRealtimeVoice } from '../hooks/useRealtimeVoice';
import { generateHintPayload, hintPanelsAtLevel, type HintPayload } from '../lib/hintAgent';
import { liveVoiceScriptTitleLine } from '../lib/liveVoiceMeta';
import { buildScenarioFromLiveSetup, FREE_VOICE_SCENARIO_ID } from '../lib/liveVoiceFreeScenario';
import { translateLineToVi } from '../lib/translateLineVi';
import { modelsListUrl } from '../lib/endpoints';
import { evaluateRepairOpportunity, shouldShowRepairDecision } from '../lib/repairAgent';

const liveFieldSx: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.25)',
  color: 'inherit',
  font: 'inherit',
};

/** Role line inputs: centered text, no left padding (label sits beside the field). */
const liveAiScriptRoleFieldSx: CSSProperties = {
  ...liveFieldSx,
  display: 'flex',
  flexWrap: 'wrap',
  textAlign: 'center',
  verticalAlign: 'middle',
  padding: '10px 12px 10px 0',
};

const launchForSetup = (level: LiveVoiceSetup['level']): SessionLaunchState => ({
  scenarioId: FREE_VOICE_SCENARIO_ID,
  level,
  mode: 'live_voice',
});

const LIVE_PARTICLE_DOT_COUNT = 560;

/** Never show below the mic (still announced via sr-only when status applies) */
const LIVE_VOICE_NEVER_VISIBLE_CAPTION_LINES = new Set(['Live']);

/** When mic is on, these duplicates glow-only UX → visible caption hidden */
const LIVE_VOICE_MIC_AMBIENT_CAPTION_LINES = new Set(['Speak…', 'Speak...', 'Ready for next turn']);

type Particle3 = { x: number; y: number; z: number };
type ConnectionCheckStatus = 'idle' | 'checking' | 'ok' | 'fail';

const fract01 = (x: number) => x - Math.floor(x);

/** Fibonacci lattice trên mặt cầu đơn vị — không méo, không jitter */
function fibonacciSpherePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
    const rho = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = ga * i;
    pts.push({ x: Math.cos(theta) * rho, y, z: Math.sin(theta) * rho });
  }
  return pts;
}

/** Lưới đều trên 6 mặt khối lập phương [-1,1]³ (toàn bộ là 3D) */
function cubeSurfacePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const builders = [
    (u: number, v: number): Particle3 => ({ x: u, y: v, z: 1 }),
    (u: number, v: number): Particle3 => ({ x: u, y: v, z: -1 }),
    (u: number, v: number): Particle3 => ({ x: u, y: 1, z: v }),
    (u: number, v: number): Particle3 => ({ x: u, y: -1, z: v }),
    (u: number, v: number): Particle3 => ({ x: 1, y: u, z: v }),
    (u: number, v: number): Particle3 => ({ x: -1, y: u, z: v }),
  ];
  const base = Math.floor(n / 6);
  const extra = n % 6;
  builders.forEach((builder, fi) => {
    const m = base + (fi < extra ? 1 : 0);
    if (m <= 0) return;
    const cols = Math.max(1, Math.ceil(Math.sqrt(m)));
    const rows = Math.max(1, Math.ceil(m / cols));
    for (let k = 0; k < m; k++) {
      const i = k % cols;
      const j = Math.floor(k / cols);
      const u = cols <= 1 ? 0 : (i / (cols - 1)) * 2 - 1;
      const v = rows <= 1 ? 0 : (j / (rows - 1)) * 2 - 1;
      pts.push(builder(u, v));
    }
  });
  return pts;
}

/** Hình trụ tròn: mặt cong + hai đáy tròn — không có mặt tam giác / đỉnh chóp */
function cylinderSurfacePoints(n: number): Particle3[] {
  if (n < 6) return fibonacciSpherePoints(n);
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const R = 1;
  const zTop = 1;
  const zBot = -1;

  const cap = Math.max(1, Math.round(n * 0.14));
  const lateral = n - 2 * cap;

  for (let i = 0; i < lateral; i++) {
    const z = zBot + ((i + 0.5) / lateral) * (zTop - zBot);
    const theta = ga * i;
    pts.push({ x: R * Math.cos(theta), y: R * Math.sin(theta), z });
  }
  for (let i = 0; i < cap; i++) {
    const rr = R * Math.sqrt((i + 0.5) / cap);
    const theta = ga * (i + 701);
    pts.push({ x: rr * Math.cos(theta), y: rr * Math.sin(theta), z: zTop });
  }
  for (let i = 0; i < cap; i++) {
    const rr = R * Math.sqrt((i + 0.5) / cap);
    const theta = ga * (i + 1403);
    pts.push({ x: rr * Math.cos(theta), y: rr * Math.sin(theta), z: zBot });
  }

  return pts;
}

/** Ellipsoid nhẹ — biến thể cầu, không góc nhọn */
function ellipsoidSurfacePoints(n: number): Particle3[] {
  const ax = 1.14;
  const ay = 0.86;
  const az = 1.06;
  return fibonacciSpherePoints(n).map((p) => ({
    x: p.x * ax,
    y: p.y * ay,
    z: p.z * az,
  }));
}

/** Torus (xuyến), tham số chọn để nằm gọn trong khung quan sát */
function torusSurfacePoints(n: number): Particle3[] {
  const R = 0.74;
  const r = 0.26;
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const phi = Math.PI * (1 + Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = fract01((ga * i) / (Math.PI * 2)) * Math.PI * 2;
    const v = fract01(i * phi) * Math.PI * 2;
    const ring = R + r * Math.cos(v);
    pts.push({
      x: ring * Math.cos(u),
      y: ring * Math.sin(u),
      z: r * Math.sin(v),
    });
  }
  return pts;
}

/** Capsule: thân trụ + hai nửa cầu đầu — không đỉnh chóp tam giác */
function capsuleSurfacePoints(n: number): Particle3[] {
  if (n < 14) return fibonacciSpherePoints(n);
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const capR = 1;
  const cylHalf = 0.48;

  const body = Math.max(3, Math.round(n * 0.5));
  const rest = n - body;
  const botCap = Math.floor(rest / 2);
  const topCap = rest - botCap;

  for (let i = 0; i < body; i++) {
    const z = -cylHalf + ((i + 0.5) / body) * (2 * cylHalf);
    const theta = ga * i;
    pts.push({ x: capR * Math.cos(theta), y: capR * Math.sin(theta), z });
  }
  for (let i = 0; i < botCap; i++) {
    const phi = (Math.PI / 2) * ((i + 0.5) / botCap);
    const theta = ga * (i + 313);
    const rho = capR * Math.sin(phi);
    const z = -cylHalf - capR * Math.cos(phi);
    pts.push({ x: rho * Math.cos(theta), y: rho * Math.sin(theta), z });
  }
  for (let i = 0; i < topCap; i++) {
    const phi = (Math.PI / 2) * ((i + 0.5) / topCap);
    const theta = ga * (i + 727);
    const rho = capR * Math.sin(phi);
    const z = cylHalf + capR * Math.cos(phi);
    pts.push({ x: rho * Math.cos(theta), y: rho * Math.sin(theta), z });
  }

  return pts;
}

function octahedronSurfacePoints(n: number): Particle3[] {
  return fibonacciSpherePoints(n).map((p) => {
    const l1 = Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z) || 1;
    return { x: p.x / l1, y: p.y / l1, z: p.z / l1 };
  });
}

function doubleConeSurfacePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = -1 + ((i + 0.5) / n) * 2;
    const r = 1 - Math.abs(z);
    const theta = ga * i;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z });
  }
  return pts;
}

function spiralRibbonPoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const turns = 3.4;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const theta = u * Math.PI * 2 * turns;
    const band = ((i % 7) - 3) / 3;
    const r = 0.42 + u * 0.68 + band * 0.025;
    const z = -0.9 + u * 1.8 + band * 0.045;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z });
  }
  return pts;
}

function waveRingPoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    const band = ((i * 13) % 23) / 22 - 0.5;
    const r = 0.78 + band * 0.22;
    const wave = 0.22 * Math.sin(theta * 5 + ga * i);
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z: wave + band * 0.26 });
  }
  return pts;
}

const PARTICLE_SHAPE_SEQUENCE = [
  'sphere',
  'ellipsoid',
  'cube',
  'octahedron',
  'cylinder',
  'torus',
  'waveRing',
  'capsule',
  'doubleCone',
  'spiralRibbon',
] as const;
type ParticleShapeKind = (typeof PARTICLE_SHAPE_SEQUENCE)[number];

function particlePointsForShape(kind: ParticleShapeKind, n: number): Particle3[] {
  switch (kind) {
    case 'sphere':
      return fibonacciSpherePoints(n);
    case 'ellipsoid':
      return ellipsoidSurfacePoints(n);
    case 'cube':
      return cubeSurfacePoints(n);
    case 'cylinder':
      return cylinderSurfacePoints(n);
    case 'torus':
      return torusSurfacePoints(n);
    case 'capsule':
      return capsuleSurfacePoints(n);
    case 'octahedron':
      return octahedronSurfacePoints(n);
    case 'doubleCone':
      return doubleConeSurfacePoints(n);
    case 'spiralRibbon':
      return spiralRibbonPoints(n);
    case 'waveRing':
      return waveRingPoints(n);
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function particlePaletteForStatus(status: string): { a: [number, number, number]; b: [number, number, number] } {
  if (status === 'ai_speaking') return { a: [0.52, 0.66, 1], b: [0.92, 0.78, 1] };
  if (status === 'listening') return { a: [0.5, 1, 0.78], b: [0.86, 1, 0.94] };
  if (status === 'live') return { a: [0.48, 0.95, 1], b: [0.9, 1, 0.96] };
  if (status === 'cooldown') return { a: [1, 0.78, 0.38], b: [1, 0.96, 0.72] };
  if (status === 'connecting') return { a: [0.42, 0.86, 1], b: [0.86, 0.98, 1] };
  if (status === 'error') return { a: [1, 0.42, 0.36], b: [1, 0.78, 0.68] };
  return { a: [0.64, 0.95, 1], b: [0.96, 1, 0.98] };
}

const PARTICLE_SHAPE_MORPH_MS = 3200;
const PARTICLE_SHAPE_HOLD_MS = 5200;

/** Smoothstep — mép morph mềm, không giật vận tốc */
function easeMorphEdge(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** Luân phiên: giữ hình A → morph A→B → giữ B → morph B→C → giữ C → morph C→A … */
function morphBlend(nowMs: number): {
  ia: number;
  ib: number;
  blendU: number;
  labelShape: ParticleShapeKind;
} {
  const morph = PARTICLE_SHAPE_MORPH_MS;
  const hold = PARTICLE_SHAPE_HOLD_MS;
  const seg = hold + morph;
  const cycle = seg * PARTICLE_SHAPE_SEQUENCE.length;
  let e = nowMs % cycle;
  let idx = 0;
  while (e >= seg) {
    e -= seg;
    idx++;
  }
  const ia = idx % PARTICLE_SHAPE_SEQUENCE.length;
  const ib = (idx + 1) % PARTICLE_SHAPE_SEQUENCE.length;
  if (e < hold) {
    const ls = PARTICLE_SHAPE_SEQUENCE[ia];
    return { ia, ib: ia, blendU: 0, labelShape: ls };
  }
  const raw = (e - hold) / morph;
  const blendU = easeMorphEdge(raw);
  const labelShape = blendU < 0.5 ? PARTICLE_SHAPE_SEQUENCE[ia] : PARTICLE_SHAPE_SEQUENCE[ib];
  return { ia, ib, blendU, labelShape };
}

function lerpParticle(a: Particle3, b: Particle3, u: number): Particle3 {
  const x = a.x + (b.x - a.x) * u;
  const y = a.y + (b.y - a.y) * u;
  const z = a.z + (b.z - a.z) * u;
  return { x, y, z };
}

function settingsFormsEqual(a: StoredSettings, b: StoredSettings) {
  return (
    a.realtimeApiKey === b.realtimeApiKey &&
    a.realtimeModel === b.realtimeModel &&
    a.realtimeVoice === b.realtimeVoice &&
    a.realtimeCooldownSeconds === b.realtimeCooldownSeconds &&
    a.ttsModel === b.ttsModel &&
    a.sttModel === b.sttModel &&
    a.shadowingLength === b.shadowingLength &&
    a.shadowingGapMode === b.shadowingGapMode &&
    a.shadowingGapSeconds === b.shadowingGapSeconds &&
    a.hintBaseUrl === b.hintBaseUrl &&
    a.hintApiKey === b.hintApiKey &&
    a.hintModel === b.hintModel &&
    a.showPracticeTimer === b.showPracticeTimer &&
    a.saveTranscripts === b.saveTranscripts &&
    a.saveAudio === b.saveAudio &&
    a.showLiveVoiceConversationText === b.showLiveVoiceConversationText &&
    a.showLiveVoiceAiCaptionVi === b.showLiveVoiceAiCaptionVi &&
    a.showLiveVoiceHintVi === b.showLiveVoiceHintVi &&
    a.liveVoiceMicHandsFree === b.liveVoiceMicHandsFree &&
    a.repairMySentence === b.repairMySentence &&
    a.casualCompanionMode === b.casualCompanionMode
  );
}

function LiveVoiceInner({
  scenario,
  launch,
  settings,
  setup,
  setSetup,
  commitSettings,
}: {
  scenario: MockScenario;
  launch: SessionLaunchState;
  settings: StoredSettings;
  setup: LiveVoiceSetup;
  setSetup: Dispatch<SetStateAction<LiveVoiceSetup>>;
  commitSettings: (next: StoredSettings) => void;
}) {
  const navigate = useNavigate();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const particleOrbRef = useRef<HTMLDivElement>(null);
  const particleOrbCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleOrbAnimRef = useRef<number | null>(null);

  const [reduceMotionParticles, setReduceMotionParticles] = useState(false);

  const particleShapePresetPts = useMemo(
    () => PARTICLE_SHAPE_SEQUENCE.map((kind) => particlePointsForShape(kind, LIVE_PARTICLE_DOT_COUNT)),
    [],
  );

  const sessionIdRef = useRef(newId());
  const sessionStartedIso = useRef(new Date().toISOString());
  const getTurnsRef = useRef(() => [] as ConversationTurn[]);
  const hintedLiveOnceRef = useRef(false);
  /** Ignore stale hint HTTP responses when multiple refreshes overlap. */
  const hintRefreshGenRef = useRef(0);
  /** Set true when a Hint-model fetch starts (offline fallback only after that completes without AI text). */
  const hintAiAttemptedRef = useRef(false);
  const captionViAiGenRef = useRef(0);
  const hintViGenRef = useRef(0);
  const repairRefreshGenRef = useRef(0);
  const repairHistoryRef = useRef<RepairDecision[]>([]);
  const latestAiLineRef = useRef('');
  const hintAbortControllerRef = useRef<AbortController | null>(null);
  const repairAbortControllerRef = useRef<AbortController | null>(null);

  const [hintPack, setHintPack] = useState<HintPayload | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [aiCaptionVi, setAiCaptionVi] = useState('');
  const [hintViText, setHintViText] = useState('');
  const [hintErrorMessage, setHintErrorMessage] = useState('');
  const [repairDecision, setRepairDecision] = useState<RepairDecision | null>(null);
  const [repairPracticeActive, setRepairPracticeActive] = useState(false);
  const [liveSessionSettingsOpen, setLiveSessionSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<StoredSettings | null>(null);
  const [settingsConnectionCheck, setSettingsConnectionCheck] = useState<{
    realtime: ConnectionCheckStatus;
    hint: ConnectionCheckStatus;
  }>({ realtime: 'idle', hint: 'idle' });
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [topicPickerEntered, setTopicPickerEntered] = useState(false);
  const topicPickerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadIconSpinning, setReloadIconSpinning] = useState(false);

  const openLiveSettings = useCallback(() => {
    setSettingsDraft(settings);
    setSettingsConnectionCheck({ realtime: 'idle', hint: 'idle' });
    setLiveSessionSettingsOpen(true);
  }, [settings]);

  const closeLiveSettingsModal = useCallback(() => {
    setLiveSessionSettingsOpen(false);
    setSettingsDraft(null);
    setSettingsConnectionCheck({ realtime: 'idle', hint: 'idle' });
  }, []);

  const requestCloseTopicPicker = useCallback(() => {
    setTopicPickerEntered(false);
    if (topicPickerCloseTimerRef.current) window.clearTimeout(topicPickerCloseTimerRef.current);
    topicPickerCloseTimerRef.current = window.setTimeout(() => {
      topicPickerCloseTimerRef.current = null;
      setTopicPickerOpen(false);
    }, 300);
  }, []);

  const openTopicPicker = useCallback(() => {
    if (topicPickerCloseTimerRef.current) {
      window.clearTimeout(topicPickerCloseTimerRef.current);
      topicPickerCloseTimerRef.current = null;
    }
    setTopicPickerOpen(true);
    setTopicPickerEntered(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTopicPickerEntered(true));
    });
  }, []);

  const patchSettingsDraft = useCallback((partial: Partial<StoredSettings>) => {
    setSettingsDraft((d) => (d ? { ...d, ...partial } : d));
  }, []);

  const checkRealtimeConnection = useCallback(async () => {
    const apiKey = settingsDraft?.realtimeApiKey.trim();
    if (!apiKey) {
      setSettingsConnectionCheck((s) => ({ ...s, realtime: 'fail' }));
      return;
    }
    setSettingsConnectionCheck((s) => ({ ...s, realtime: 'checking' }));
    try {
      const res = await fetch(modelsListUrl('https://api.openai.com/v1'), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      setSettingsConnectionCheck((s) => ({ ...s, realtime: res.ok ? 'ok' : 'fail' }));
    } catch {
      setSettingsConnectionCheck((s) => ({ ...s, realtime: 'fail' }));
    }
  }, [settingsDraft?.realtimeApiKey]);

  const checkHintConnection = useCallback(async () => {
    const baseUrl = settingsDraft?.hintBaseUrl.trim();
    const apiKey = settingsDraft?.hintApiKey.trim();
    if (!baseUrl || !settingsDraft?.hintModel.trim()) {
      setSettingsConnectionCheck((s) => ({ ...s, hint: 'fail' }));
      return;
    }
    setSettingsConnectionCheck((s) => ({ ...s, hint: 'checking' }));
    try {
      const headers: HeadersInit = {};
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const url = modelsListUrl(baseUrl);
      if (url.startsWith('/api-proxy')) {
        (headers as Record<string, string>)['X-Proxy-Target'] = baseUrl.replace(/\/+$/, '');
      }
      const res = await fetch(url, { headers });
      setSettingsConnectionCheck((s) => ({ ...s, hint: res.ok ? 'ok' : 'fail' }));
    } catch {
      setSettingsConnectionCheck((s) => ({ ...s, hint: 'fail' }));
    }
  }, [settingsDraft?.hintApiKey, settingsDraft?.hintBaseUrl, settingsDraft?.hintModel]);

  const saveLiveSettings = useCallback(() => {
    if (!settingsDraft) return;
    commitSettings(settingsDraft);
    closeLiveSettingsModal();
  }, [settingsDraft, commitSettings, closeLiveSettingsModal]);

  const settingsDirty = settingsDraft ? !settingsFormsEqual(settingsDraft, settings) : false;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotionParticles(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (topicPickerOpen) {
        requestCloseTopicPicker();
        return;
      }
      if (liveSessionSettingsOpen) closeLiveSettingsModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [topicPickerOpen, liveSessionSettingsOpen, requestCloseTopicPicker, closeLiveSettingsModal]);

  useEffect(() => {
    if (!liveSessionSettingsOpen && !topicPickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [liveSessionSettingsOpen, topicPickerOpen]);

  useEffect(() => {
    return () => {
      if (topicPickerCloseTimerRef.current) {
        window.clearTimeout(topicPickerCloseTimerRef.current);
        topicPickerCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!reloadIconSpinning) return;
    const id = window.setTimeout(() => setReloadIconSpinning(false), 720);
    return () => window.clearTimeout(id);
  }, [reloadIconSpinning]);

  const hintEnJoined = useMemo(() => {
    if (!hintPack) return '';
    return hintPanelsAtLevel(hintPack, launch.level)
      .flatMap((p) => p.paragraphs)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n\n');
  }, [hintPack, launch.level]);

  const hintApiConfigured = Boolean(
    settings.hintApiKey?.trim() && settings.hintModel && settings.hintBaseUrl.trim(),
  );

  const repairAvailableForLevel = launch.level === 'intermediate' || launch.level === 'advanced';
  const repairApiConfigured = hintApiConfigured;
  const repairEnabled = settings.repairMySentence && repairAvailableForLevel && repairApiConfigured && !settings.casualCompanionMode;

  const offlineHintRailLine = useMemo(() => {
    const chips = scenario.phraseBank?.filter(Boolean) ?? [];
    const chipLine = chips.length ? chips.join(' · ') : '';
    const turn0 = scenario.turns?.[0];
    const h = turn0?.hints;
    if (!h) return chipLine;
    const arr =
      launch.level === 'beginner' ? h.beginner : launch.level === 'intermediate' ? h.intermediate : h.advanced;
    const scriptedLine = arr?.map((s) => s.trim()).filter(Boolean)[0] ?? '';
    return chipLine || scriptedLine;
  }, [scenario, launch.level]);

  const refreshHintsFromConversation = useCallback(
    async (latestAiLine: string) => {
      if (settings.casualCompanionMode) {
        setHintLoading(false);
        setHintPack(null);
        setHintViText('');
        setHintErrorMessage('');
        return;
      }
      if (!settings.hintApiKey || !settings.hintModel || !settings.hintBaseUrl.trim()) {
        setHintLoading(false);
        setHintPack(null);
        setHintViText('');
        setHintErrorMessage('');
        return;
      }
      hintAiAttemptedRef.current = true;
      const gen = ++hintRefreshGenRef.current;
      setHintViText('');
      setHintErrorMessage('');
      setHintLoading(true);

      if (hintAbortControllerRef.current) {
        hintAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      hintAbortControllerRef.current = controller;

      try {
        const turns = getTurnsRef.current();
        const h = await generateHintPayload(settings, scenario, launch.level, turns, latestAiLine, {
          speaksFirst: setup.speaksFirst,
          signal: controller.signal,
        });
        if (gen !== hintRefreshGenRef.current) return;
        setHintPack(h);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if (gen !== hintRefreshGenRef.current) return;
        setHintPack(null);
        setHintViText('');
        setHintErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        if (gen === hintRefreshGenRef.current) setHintLoading(false);
      }
    },
    [scenario, settings, launch.level, setup.speaksFirst],
  );

  const maybeEvaluateRepair = useCallback(
    async (latestUserLine: string) => {
      const cleanUserLine = latestUserLine.trim();
      if (!repairEnabled || !cleanUserLine) return;
      if (cleanUserLine.split(/\s+/).filter(Boolean).length < 4) return;

      const gen = ++repairRefreshGenRef.current;
      setRepairPracticeActive(false);

      if (repairAbortControllerRef.current) {
        repairAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      repairAbortControllerRef.current = controller;

      try {
        const decision = await evaluateRepairOpportunity(
          settings,
          scenario,
          launch.level,
          getTurnsRef.current(),
          latestAiLineRef.current,
          cleanUserLine,
          repairHistoryRef.current,
          controller.signal,
        );
        if (gen !== repairRefreshGenRef.current) return;
        repairHistoryRef.current = [...repairHistoryRef.current.slice(-7), decision];
        if (!shouldShowRepairDecision(decision, launch.level, cleanUserLine)) return;
        setRepairDecision(decision);
        setHintPack(null);
        setHintViText('');
        setHintLoading(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (gen !== repairRefreshGenRef.current) return;
      }
    },
    [launch.level, repairEnabled, scenario, settings],
  );

  const clearRepairAndReturnToHints = useCallback(() => {
    setRepairDecision(null);
    setRepairPracticeActive(false);
    repairRefreshGenRef.current += 1;
    void refreshHintsFromConversation(latestAiLineRef.current);
  }, [refreshHintsFromConversation]);

  const translateAiCaptionVi = useCallback(
    async (en: string) => {
      if (!settings.showLiveVoiceConversationText || !settings.showLiveVoiceAiCaptionVi) {
        setAiCaptionVi('');
        return;
      }
      const gen = ++captionViAiGenRef.current;
      try {
        const vi = await translateLineToVi(settings, en);
        if (gen !== captionViAiGenRef.current) return;
        setAiCaptionVi(vi);
      } catch {
        if (gen !== captionViAiGenRef.current) return;
        setAiCaptionVi('');
      }
    },
    [settings],
  );

  const voice = useRealtimeVoice({
    scenario,
    level: launch.level,
    speaksFirst: setup.speaksFirst,
    userRoleLabel: scenario.userRole,
    apiKey: settings.realtimeApiKey,
    model: settings.realtimeModel,
    voice: settings.realtimeVoice,
    cooldownSeconds: settings.realtimeCooldownSeconds,
    micHandsFree: settings.liveVoiceMicHandsFree,
    casualCompanionMode: settings.casualCompanionMode,
    remoteAudioRef,
    onAiLineComplete: (t) => {
      latestAiLineRef.current = t;
      void refreshHintsFromConversation(t);
      if (settings.showLiveVoiceConversationText && settings.showLiveVoiceAiCaptionVi) void translateAiCaptionVi(t);
      else setAiCaptionVi('');
    },
    onUserTranscript: (t) => {
      if (repairPracticeActive) {
        setRepairDecision(null);
        setRepairPracticeActive(false);
        void refreshHintsFromConversation(latestAiLineRef.current);
        return;
      }
      void maybeEvaluateRepair(t);
    },
  });

  useEffect(() => {
    if (voice.uiStatus === 'ai_speaking') {
      setAiCaptionVi('');
    }
  }, [voice.uiStatus]);

  useEffect(() => {
    if (voice.uiStatus !== 'connecting') return;
    setAiCaptionVi('');
    captionViAiGenRef.current += 1;
  }, [voice.uiStatus]);

  useEffect(() => {
    const root = particleOrbRef.current;
    const canvas = particleOrbCanvasRef.current;
    if (!root || !canvas) return;

    let disposed = false;
    let cleanupThree: (() => void) | undefined;
    void (async () => {
      const [
        { AdditiveBlending },
        { BufferAttribute },
        { BufferGeometry },
        { PerspectiveCamera },
        { Points },
        { ShaderMaterial },
        { Scene },
        { WebGLRenderer },
        { Color },
      ] = await Promise.all([
        import('three/src/constants.js'),
        import('three/src/core/BufferAttribute.js'),
        import('three/src/core/BufferGeometry.js'),
        import('three/src/cameras/PerspectiveCamera.js'),
        import('three/src/objects/Points.js'),
        import('three/src/materials/ShaderMaterial.js'),
        import('three/src/scenes/Scene.js'),
        import('three/src/renderers/WebGLRenderer.js'),
        import('three/src/math/Color.js'),
      ]);
      if (disposed) return;

    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new Scene();
    const camera = new PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.z = 4.9;

    const positions = new Float32Array(LIVE_PARTICLE_DOT_COUNT * 3);
    const seeds = new Float32Array(LIVE_PARTICLE_DOT_COUNT);
    for (let i = 0; i < LIVE_PARTICLE_DOT_COUNT; i++) {
      seeds[i] = fract01(Math.sin(i * 91.345 + 17.17) * 43758.5453);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0.84 },
        uSize: { value: 3.2 },
        uTime: { value: 0 },
        uColorA: { value: new Color(0.64, 0.95, 1) },
        uColorB: { value: new Color(0.96, 1, 0.98) },
      },
      vertexShader: `
        uniform float uSize;
        uniform float uTime;
        attribute float aSeed;
        varying float vSeed;
        varying float vTwinkle;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vSeed = aSeed;
          vTwinkle = 0.72 + 0.28 * sin(uTime * 1.45 + aSeed * 18.849);
          gl_PointSize = uSize * (0.82 + 0.32 * vTwinkle);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vSeed;
        varying float vTwinkle;
        void main() {
          vec2 p = gl_PointCoord - vec2(0.5);
          float dist = length(p);
          float core = smoothstep(0.24, 0.0, dist);
          float halo = smoothstep(0.5, 0.13, dist);
          float alpha = (halo * 0.76 + core * 0.34) * uOpacity * (0.78 + 0.3 * vTwinkle);
          if (alpha < 0.015) discard;
          vec3 particleColor = mix(uColorA, uColorB, 0.36 + 0.46 * vSeed + 0.12 * vTwinkle);
          gl_FragColor = vec4(particleColor, alpha);
        }
      `,
    });
    const points = new Points(geometry, material);
    scene.add(points);

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    const tick = (now: number) => {
      if (document.hidden) {
        particleOrbAnimRef.current = requestAnimationFrame(tick);
        return;
      }

      const t = now * 0.001;
      const status = voice.uiStatus;
      const micRaw = voice.muted ? 0 : voice.micLevelRef.current;
      const reduceOrb = reduceMotionParticles;

      /** Overall strength of the continuous “brain” idle motion (zoom + rõ/mờ). */
      let brainAmp = 0.48;
      if (status === 'ai_speaking') brainAmp = 1;
      else if (status === 'listening') brainAmp = 0.95;
      else if (status === 'live') brainAmp = 0.88;
      else if (status === 'connecting') brainAmp = 0.72;
      else if (status === 'cooldown') brainAmp = 0.68;

      const neural =
        brainAmp *
        (0.088 * Math.sin(t * 0.76) +
          0.056 * Math.sin(t * 1.63 + 1.18) +
          0.044 * Math.sin(t * 2.71 + 0.52) +
          0.028 * Math.sin(t * 4.35 + 2.05) +
          0.022 * Math.sin(t * 6.1 + 0.9));

      let voiceBoost = 0;
      let chatter = 0;
      if (status === 'ai_speaking') {
        const cadence = 0.5 + 0.5 * Math.sin(t * 11.5);
        chatter = 0.11 * cadence + 0.048 * Math.sin(t * 23);
      } else if (status === 'listening') {
        voiceBoost = micRaw * 0.52;
      } else if (status === 'live') {
        voiceBoost = micRaw * 0.42;
      }

      const scaleRaw = 1 + neural + voiceBoost + chatter;
      const scale = Math.min(1.2, Math.max(0.84, scaleRaw));

      /** Sharp vs soft focus — independent phase from scale so rõ/mờ không khớp cố định với zoom. */
      const blurMix =
        0.5 +
        0.5 *
          Math.sin(t * 0.61 + 1.05) *
          (0.56 + 0.44 * Math.sin(t * 1.88 + 0.33)) *
          (0.72 + 0.28 * Math.sin(t * 3.4 + 0.8));

      const sharpPulse = 1 - blurMix * 0.55;
      let glowBase = 0.22 + sharpPulse * 0.26;
      if (status === 'ai_speaking') {
        glowBase += 0.34 + 0.26 * (0.5 + 0.5 * Math.sin(t * 11.5));
      } else if (status === 'listening') {
        glowBase += micRaw * 0.58;
      } else if (status === 'live') {
        glowBase += micRaw * 0.52;
      } else {
        glowBase += brainAmp * 0.14 * (0.5 + 0.5 * Math.sin(t * 2.2));
      }
      const glow = Math.min(1, Math.max(0.1, glowBase));

      const mb = reduceOrb ? { ia: 0, ib: 0, blendU: 0, labelShape: PARTICLE_SHAPE_SEQUENCE[0] } : morphBlend(now);
      root.dataset.particleShape = mb.labelShape;
      const A = particleShapePresetPts[mb.ia];
      const B = particleShapePresetPts[mb.ib];
      const u = mb.blendU;
      const radius = 1.04 * scale;
      for (let i = 0; i < LIVE_PARTICLE_DOT_COUNT; i++) {
        const p = u <= 0 ? A[i] : lerpParticle(A[i], B[i], u);
        const j = i * 3;
        positions[j] = p.x * radius;
        positions[j + 1] = p.y * radius;
        positions[j + 2] = p.z * radius;
      }
      geometry.attributes.position.needsUpdate = true;

      const spinSpeed =
        status === 'listening'
          ? 0.28
          : status === 'ai_speaking'
            ? 0.2
            : ['live', 'connecting', 'cooldown'].includes(status)
              ? 0.23
              : 0.16;
      points.rotation.y = t * spinSpeed;
      points.rotation.x = 0.22 + Math.sin(t * 0.27) * 0.1;
      points.rotation.z = Math.sin(t * 0.18) * 0.1;
      material.uniforms.uTime.value = t;
      material.uniforms.uOpacity.value = reduceOrb ? 0.78 : 0.68 + glow * 0.28;
      material.uniforms.uSize.value = status === 'ai_speaking' ? 3.4 : status === 'listening' ? 3.25 : 2.9;
      const palette = particlePaletteForStatus(status);
      material.uniforms.uColorA.value.setRGB(...palette.a);
      material.uniforms.uColorB.value.setRGB(...palette.b);
      renderer.render(scene, camera);

      particleOrbAnimRef.current = requestAnimationFrame(tick);
    };

    particleOrbAnimRef.current = requestAnimationFrame(tick);
    cleanupThree = () => {
      if (particleOrbAnimRef.current != null) {
        cancelAnimationFrame(particleOrbAnimRef.current);
        particleOrbAnimRef.current = null;
      }
      resizeObserver.disconnect();
      delete root.dataset.particleShape;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
    })();

    return () => {
      disposed = true;
      cleanupThree?.();
    };
  }, [voice.uiStatus, voice.muted, voice.micLevelRef, particleShapePresetPts, reduceMotionParticles]);

  useEffect(() => {
    if (!settings.showLiveVoiceConversationText || !settings.showLiveVoiceAiCaptionVi) setAiCaptionVi('');
  }, [settings.showLiveVoiceConversationText, settings.showLiveVoiceAiCaptionVi]);

  useEffect(() => {
    if (!settings.showLiveVoiceHintVi) {
      setHintViText('');
      return;
    }
    if (!hintEnJoined.trim()) {
      setHintViText('');
      return;
    }
    const gen = ++hintViGenRef.current;
    void (async () => {
      try {
        const vi = await translateLineToVi(settings, hintEnJoined.trim());
        if (gen !== hintViGenRef.current) return;
        setHintViText(vi);
      } catch {
        if (gen !== hintViGenRef.current) return;
        setHintViText('');
      }
    })();
  }, [hintEnJoined, settings]);

  useEffect(() => {
    getTurnsRef.current = voice.getTurns;
  });

  useEffect(() => {
    if (voice.uiStatus === 'ended' || voice.uiStatus === 'idle') {
      hintedLiveOnceRef.current = false;
      hintAiAttemptedRef.current = false;
      setRepairDecision(null);
      setRepairPracticeActive(false);
    }
  }, [voice.uiStatus]);

  useEffect(() => {
    if (repairEnabled) return;
    setRepairDecision(null);
    setRepairPracticeActive(false);
  }, [repairEnabled]);

  useEffect(() => {
    if (voice.uiStatus !== 'live') return;
    if (hintedLiveOnceRef.current) return;
    hintedLiveOnceRef.current = true;
    void refreshHintsFromConversation('');
  }, [voice.uiStatus, refreshHintsFromConversation]);

  useEffect(() => {
    document.body.classList.add('voice-page');
    return () => {
      document.body.classList.remove('voice-page');
      hintAbortControllerRef.current?.abort();
      repairAbortControllerRef.current?.abort();
    };
  }, []);

  const persistSession = useCallback(
    (ended: boolean) => {
      const session: HintTalkSession = {
        id: sessionIdRef.current,
        practiceType: scenario.practiceType,
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        toeicTaskType: scenario.toeicTaskType,
        toeicSection: scenario.toeicSection,
        questionRange: scenario.questionRange,
        prompt: scenario.prompt,
        mode: 'live_voice',
        level: launch.level,
        roles: { ai: scenario.aiRole, user: scenario.userRole },
        startedAt: sessionStartedIso.current,
        endedAt: ended ? new Date().toISOString() : undefined,
        turns: getTurnsRef.current(),
      };
      upsertSession(session);
    },
    [scenario, launch.level],
  );

  const endLive = () => {
    voice.disconnect();
    persistSession(true);
    sessionIdRef.current = newId();
    sessionStartedIso.current = new Date().toISOString();
    navigate('/live-voice', { replace: true });
  };

  const clearLiveSession = useCallback(() => {
    voice.disconnect();
    voice.clearLogs();
    persistSession(true);
    sessionIdRef.current = newId();
    sessionStartedIso.current = new Date().toISOString();
    setHintPack(null);
    setAiCaptionVi('');
    setHintViText('');
    setHintErrorMessage('');
    hintedLiveOnceRef.current = false;
    hintAiAttemptedRef.current = false;
    setHintLoading(false);
    setRepairDecision(null);
    setRepairPracticeActive(false);
    hintRefreshGenRef.current += 1;
    captionViAiGenRef.current += 1;
    hintViGenRef.current += 1;
    repairRefreshGenRef.current += 1;
    repairHistoryRef.current = [];
    latestAiLineRef.current = '';
    setLiveSessionSettingsOpen(false);
    setSettingsDraft(null);
    if (topicPickerCloseTimerRef.current) {
      window.clearTimeout(topicPickerCloseTimerRef.current);
      topicPickerCloseTimerRef.current = null;
    }
    setTopicPickerEntered(false);
    setTopicPickerOpen(false);
  }, [voice, persistSession]);

  const voiceBusy = ['connecting', 'live', 'listening', 'ai_speaking', 'cooldown'].includes(voice.uiStatus);

  const isConnecting = voice.uiStatus === 'connecting';
  const isLivePhase = ['live', 'listening', 'ai_speaking', 'cooldown'].includes(voice.uiStatus);
  const showEndButton = ['connecting', 'live', 'listening', 'ai_speaking', 'cooldown', 'error'].includes(voice.uiStatus);

  const micShellVisual: 'default' | 'cooldown' | 'processing' | 'user_voice' | 'ai_speaking' =
    voice.uiStatus === 'cooldown'
      ? 'cooldown'
      : voice.uiStatus === 'ai_speaking'
        ? 'ai_speaking'
        : voice.uiStatus === 'listening'
          ? voice.statusLine === 'Processing'
            ? 'processing'
            : 'user_voice'
          : 'default';

  /** Lock mic button only during cooldown while tracks are off; still allow mute while processing. */
  const micInteractionLocked = micShellVisual === 'cooldown';

  const onPrimaryMicClick = () => {
    if (isConnecting || micInteractionLocked) return;
    if (isLivePhase) {
      voice.toggleMute();
      return;
    }
    void voice.connect();
  };

  const practiceRepairLine = () => {
    setRepairPracticeActive(true);
    if (isLivePhase && voice.muted && !micInteractionLocked) {
      voice.toggleMute();
    }
  };

  const muteActionLabel =
    isLivePhase && !isConnecting ? (voice.muted ? 'Unmute microphone' : 'Mute microphone') : '';

  const primaryMicLabel =
    isConnecting ? 'Connecting to voice chat…'
    : micShellVisual === 'cooldown'
      ? `Cooldown — microphone unavailable (${voice.cooldownRemaining ?? '…'}s)`
      : isLivePhase
        ? micShellVisual === 'processing'
          ? `${muteActionLabel}. Your speech is being processed`
          : muteActionLabel || 'Voice chat'
        : 'Start voice chat';

  const trimmedStatus = voice.statusLine.trim();
  const hideMicAmbientCaption =
    LIVE_VOICE_NEVER_VISIBLE_CAPTION_LINES.has(trimmedStatus) ||
    (voice.uiStatus === 'live' && !voice.muted && LIVE_VOICE_MIC_AMBIENT_CAPTION_LINES.has(trimmedStatus));

  const showMicMergedCaption =
    Boolean(trimmedStatus) &&
    !hideMicAmbientCaption &&
    !(
      micShellVisual === 'cooldown' ||
      micShellVisual === 'processing' ||
      micShellVisual === 'user_voice' ||
      micShellVisual === 'ai_speaking'
    );

  const micShellStatusId = 'live-voice-mic-status-line';

  const micCaptionToneClass =
    voice.uiStatus === 'error'
      ? 'live-voice-mic-shell__caption live-voice-mic-shell__caption--error'
      : voice.uiStatus === 'connecting'
        ? 'live-voice-mic-shell__caption live-voice-mic-shell__caption--connecting'
        : 'live-voice-mic-shell__caption';

  const micShellClassNames = [
    'live-voice-mic-shell',
    micShellVisual === 'cooldown' ? 'live-voice-mic-shell--cooldown' : '',
    micShellVisual === 'processing' ? 'live-voice-mic-shell--processing' : '',
    micShellVisual === 'user_voice' ? 'live-voice-mic-shell--user-voice' : '',
    micShellVisual === 'ai_speaking' ? 'live-voice-mic-shell--ai-speaking' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const setupDisabled = voiceBusy;

  const topicSelectValue = LIVE_VOICE_TOPIC_PRESETS.some((p) => p.id === setup.topicPresetId)
    ? setup.topicPresetId
    : 'open';

  const onTopicPresetPick = (id: string) => {
    const preset = getLiveVoiceTopicPreset(id);
    setSetup((s) => ({
      ...s,
      topicPresetId: id,
      userRole: preset?.defaultUserRole ?? s.userRole,
      aiRole: preset?.defaultAiRole ?? s.aiRole,
    }));
  };

  const swapPracticeRoles = useCallback(() => {
    setSetup((s) => ({
      ...s,
      userRole: s.aiRole,
      aiRole: s.userRole,
      speaksFirst: s.speaksFirst === 'user' ? 'ai' : 'user',
    }));
  }, [setSetup]);

  const liveVoiceSceneParagraph = useMemo(
    () => liveVoiceUiScenePreview(getLiveVoiceTopicPreset(setup.topicPresetId)),
    [setup.topicPresetId],
  );

  const currentTopicLabel = getLiveVoiceTopicPreset(topicSelectValue)?.label ?? 'Choose topic';

  const pickTopicAndClose = (id: string) => {
    onTopicPresetPick(id);
    requestCloseTopicPicker();
  };

  return (
    <main className="voice-app talking-room live-session-focus">
      <audio ref={remoteAudioRef} autoPlay playsInline hidden />

      <header className="voice-header voice-header--compact">
        <button type="button" className="voice-header-back" onClick={endLive} aria-label="Exit session">
          <img className="voice-header-mark" src="/favicon.svg" width={24} height={24} alt="" decoding="async" />
          HintTalk
        </button>
        <div className="voice-header-meta">
          <div className="voice-header-select-wrap voice-header-topic-wrap">
            <button
              type="button"
              id="hinttalk-live-topic-trigger"
              className="voice-header-topic-trigger"
              disabled={setupDisabled}
              aria-haspopup="dialog"
              aria-expanded={topicPickerOpen}
              aria-label={`${currentTopicLabel}. Open topic chooser.`}
              onClick={() => (topicPickerOpen ? requestCloseTopicPicker() : openTopicPicker())}
            >
              <span className="voice-header-topic-trigger-text">{currentTopicLabel}</span>
            </button>
          </div>
          <div className="voice-header-select-wrap voice-header-level-wrap">
            <select
              id="hinttalk-live-level"
              className="voice-header-select"
              disabled={setupDisabled}
              value={setup.level}
              onChange={(e) => setSetup((s) => ({ ...s, level: e.target.value as LiveVoiceSetup['level'] }))}
              aria-label="Difficulty for hints"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
        <div className="voice-header-trailing">
          <button
            type="button"
            className="voice-header-icon-btn voice-header-icon-btn--reload"
            aria-label="Clear session and start fresh"
            title="Clear session"
            onClick={() => {
              setReloadIconSpinning(true);
              clearLiveSession();
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className={`voice-header-reload-icon${reloadIconSpinning ? ' voice-header-reload-icon--spin' : ''}`}
              onAnimationEnd={(e) => {
                if (e.target !== e.currentTarget) return;
                setReloadIconSpinning(false);
              }}
            >
              <path
                d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M3 21v-5h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="voice-header-icon-btn"
            aria-label="Settings"
            title="Settings"
            onClick={openLiveSettings}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {topicPickerOpen ? (
        <div
          className={`live-topic-picker-overlay${topicPickerEntered ? ' live-topic-picker-overlay--active' : ''}`}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) requestCloseTopicPicker();
          }}
        >
          <div
            className="live-topic-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-topic-picker-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="live-topic-picker-head">
              <h2 id="live-topic-picker-title" className="live-topic-picker-title">
                Choose topic
              </h2>
              <button type="button" className="live-topic-picker-close" aria-label="Close" onClick={requestCloseTopicPicker}>
                ×
              </button>
            </div>
            <div className="live-topic-picker-body">
              {LIVE_VOICE_TOPIC_PRESETS_GROUPED.map(({ group, presets }) => (
                <section key={group} className="live-topic-picker-group" aria-label={group}>
                  <h3 className="live-topic-picker-group-title">{group}</h3>
                  <div className="live-topic-picker-grid">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`live-topic-picker-option${p.id === topicSelectValue ? ' live-topic-picker-option--selected' : ''}`}
                        onClick={() => pickTopicAndClose(p.id)}
                      >
                        <span className="live-topic-picker-option-label">{p.label}</span>
                        {p.subtitle ? (
                          <span className="live-topic-picker-option-subtitle">{p.subtitle}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {liveSessionSettingsOpen ? (
        <div
          className="live-session-settings-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLiveSettingsModal();
          }}
        >
          <div
            className="live-session-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hinttalk-app-settings-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="live-session-settings-dialog-head">
              <h2 id="hinttalk-app-settings-title" className="live-session-settings-dialog-title">
                Settings
              </h2>
              <button
                type="button"
                className="live-session-settings-close"
                aria-label="Close"
                onClick={closeLiveSettingsModal}
              >
                ×
              </button>
            </div>
            <div className="live-session-settings-body">
              <p className="live-session-settings-intro">
                Stored on this device for the whole app. Edit below, then tap Save.
              </p>
              {settingsDraft ? (
                <>
                <div className="live-session-settings-grid">
                  <div className="live-session-settings-section">
                    <div className="live-session-settings-section-head">
                      <p className="live-session-settings-section-title">Realtime (OpenAI)</p>
                      <a
                        className="live-session-settings-link-btn"
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open OpenAI API keys page"
                      >
                        Get key
                      </a>
                    </div>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">API key</span>
                      <input
                        type="password"
                        autoComplete="off"
                        style={liveFieldSx}
                        value={settingsDraft.realtimeApiKey}
                        onChange={(e) => {
                          patchSettingsDraft({ realtimeApiKey: e.target.value });
                          setSettingsConnectionCheck((s) => ({ ...s, realtime: 'idle' }));
                        }}
                        placeholder="sk-…"
                        aria-label="OpenAI API key"
                      />
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Model</span>
                      <input
                        style={liveFieldSx}
                        value={settingsDraft.realtimeModel}
                        onChange={(e) => patchSettingsDraft({ realtimeModel: e.target.value })}
                        autoComplete="off"
                        aria-label="Realtime model"
                      />
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Voice</span>
                      <select
                        style={liveFieldSx}
                        value={settingsDraft.realtimeVoice}
                        onChange={(e) => patchSettingsDraft({ realtimeVoice: e.target.value })}
                        aria-label="AI voice"
                      >
                        {REALTIME_VOICE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                        {!REALTIME_VOICE_OPTIONS.some((v) => v.id === settingsDraft.realtimeVoice) ? (
                          <option value={settingsDraft.realtimeVoice}>{`${settingsDraft.realtimeVoice} (saved)`}</option>
                        ) : null}
                      </select>
                      <span className="live-session-settings-hint">Realtime picks this up on your next connection.</span>
                    </label>
                    <div className="live-session-settings-check-row">
                      <button
                        type="button"
                        className="live-session-settings-btn live-session-settings-btn--ghost live-session-settings-btn--compact"
                        disabled={settingsConnectionCheck.realtime === 'checking'}
                        onClick={checkRealtimeConnection}
                        aria-label="Check Realtime API key"
                      >
                        Check
                      </button>
                      {settingsConnectionCheck.realtime !== 'idle' ? (
                        <span
                          className={`live-session-settings-check-status live-session-settings-check-status--${settingsConnectionCheck.realtime}`}
                          role="status"
                          aria-label={
                            settingsConnectionCheck.realtime === 'checking'
                              ? 'Checking Realtime connection'
                              : settingsConnectionCheck.realtime === 'ok'
                                ? 'Realtime connection reachable'
                                : 'Realtime connection failed'
                          }
                          title={
                            settingsConnectionCheck.realtime === 'checking'
                              ? 'Checking...'
                              : settingsConnectionCheck.realtime === 'ok'
                                ? 'Reachable'
                                : 'Cannot reach API'
                          }
                        >
                          {settingsConnectionCheck.realtime === 'checking' ? '...' : settingsConnectionCheck.realtime === 'ok' ? '✓' : '!'}
                        </span>
                      ) : null}
                    </div>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Cooldown (sec)</span>
                      <input
                        type="number"
                        min={0}
                        style={liveFieldSx}
                        value={settingsDraft.realtimeCooldownSeconds}
                        onChange={(e) => patchSettingsDraft({ realtimeCooldownSeconds: Number(e.target.value) || 0 })}
                        aria-label="Cooldown seconds"
                      />
                    </label>
                  </div>

                  <div className="live-session-settings-section">
                    <p className="live-session-settings-section-title">Hint suggestions (sidebar)</p>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Hint API key</span>
                      <input
                        type="password"
                        autoComplete="off"
                        style={liveFieldSx}
                        value={settingsDraft.hintApiKey}
                        onChange={(e) => {
                          patchSettingsDraft({ hintApiKey: e.target.value });
                          setSettingsConnectionCheck((s) => ({ ...s, hint: 'idle' }));
                        }}
                        aria-label="Hint API key"
                      />
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Hint base URL</span>
                      <input
                        style={liveFieldSx}
                        value={settingsDraft.hintBaseUrl}
                        onChange={(e) => {
                          patchSettingsDraft({ hintBaseUrl: e.target.value });
                          setSettingsConnectionCheck((s) => ({ ...s, hint: 'idle' }));
                        }}
                        placeholder="https://api.openai.com/v1"
                        aria-label="Hint base URL"
                      />
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Hint model</span>
                      <input
                        style={liveFieldSx}
                        value={settingsDraft.hintModel}
                        onChange={(e) => {
                          patchSettingsDraft({ hintModel: e.target.value });
                          setSettingsConnectionCheck((s) => ({ ...s, hint: 'idle' }));
                        }}
                        aria-label="Hint model"
                      />
                    </label>
                    <div className="live-session-settings-check-row">
                      <button
                        type="button"
                        className="live-session-settings-btn live-session-settings-btn--ghost live-session-settings-btn--compact"
                        disabled={settingsConnectionCheck.hint === 'checking'}
                        onClick={checkHintConnection}
                        aria-label="Check hint API connection"
                      >
                        Check
                      </button>
                      {settingsConnectionCheck.hint !== 'idle' ? (
                        <span
                          className={`live-session-settings-check-status live-session-settings-check-status--${settingsConnectionCheck.hint}`}
                          role="status"
                          aria-label={
                            settingsConnectionCheck.hint === 'checking'
                              ? 'Checking hint connection'
                              : settingsConnectionCheck.hint === 'ok'
                                ? 'Hint connection reachable'
                                : 'Hint connection failed'
                          }
                          title={
                            settingsConnectionCheck.hint === 'checking'
                              ? 'Checking...'
                              : settingsConnectionCheck.hint === 'ok'
                                ? 'Reachable'
                                : 'Cannot reach API'
                          }
                        >
                          {settingsConnectionCheck.hint === 'checking' ? '...' : settingsConnectionCheck.hint === 'ok' ? '✓' : '!'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="live-session-settings-section">
                    <p className="live-session-settings-section-title">Shadowing setup</p>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Passage length</span>
                      <select
                        style={liveFieldSx}
                        value={settingsDraft.shadowingLength}
                        onChange={(e) => patchSettingsDraft({ shadowingLength: e.target.value as StoredSettings['shadowingLength'] })}
                        aria-label="Shadowing passage length"
                      >
                        <option value="brief">Brief</option>
                        <option value="standard">Standard</option>
                        <option value="full">Full announcement</option>
                      </select>
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Gap between lines</span>
                      <select
                        style={liveFieldSx}
                        value={settingsDraft.shadowingGapMode === 'continuous' ? 'continuous' : String(settingsDraft.shadowingGapSeconds)}
                        onChange={(e) => {
                          if (e.target.value === 'continuous') {
                            patchSettingsDraft({ shadowingGapMode: 'continuous' });
                          } else {
                            patchSettingsDraft({ shadowingGapMode: 'pause', shadowingGapSeconds: Number(e.target.value) });
                          }
                        }}
                        aria-label="Shadowing gap between lines"
                      >
                        <option value="continuous">No gap</option>
                        <option value="1">1s gap</option>
                        <option value="2">2s gap</option>
                        <option value="3">3s gap</option>
                        <option value="5">5s gap</option>
                      </select>
                      <span className="live-session-settings-hint">No gap turns the passage into a longer continuous announcement.</span>
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">Fallback voice model</span>
                      <select
                        style={liveFieldSx}
                        value={settingsDraft.ttsModel}
                        onChange={(e) => patchSettingsDraft({ ttsModel: e.target.value })}
                        aria-label="TTS model"
                      >
                        {TTS_VOICE_MODELS.map((voiceModel) => (
                          <option key={voiceModel.id} value={voiceModel.id}>
                            {voiceModel.label}
                          </option>
                        ))}
                        {!TTS_VOICE_MODELS.some((voiceModel) => voiceModel.id === settingsDraft.ttsModel) ? (
                          <option value={settingsDraft.ttsModel}>{settingsDraft.ttsModel}</option>
                        ) : null}
                      </select>
                    </label>
                    <label className="live-session-settings-field">
                      <span className="live-session-settings-label">STT model</span>
                      <input
                        style={liveFieldSx}
                        value={settingsDraft.sttModel}
                        onChange={(e) => patchSettingsDraft({ sttModel: e.target.value })}
                        placeholder="gpt-4o-mini-transcribe"
                        aria-label="STT model"
                      />
                    </label>
                  </div>
                </div>
                <div className="live-session-settings-display-section">
                  <p className="live-session-settings-section-title">Live voice — what to show</p>
                  <label className="live-session-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settingsDraft.showLiveVoiceConversationText}
                      onChange={(e) => patchSettingsDraft({ showLiveVoiceConversationText: e.target.checked })}
                    />
                    <span className="live-session-settings-toggle-body">
                      <span className="live-session-settings-toggle-title">Conversation text (AI lines)</span>
                      <span className="live-session-settings-toggle-desc">
                        Realtime subtitle from the live dialogue next to the orb — not the scenario panel above.
                      </span>
                    </span>
                  </label>
                  <label className="live-session-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settingsDraft.showLiveVoiceAiCaptionVi}
                      onChange={(e) => patchSettingsDraft({ showLiveVoiceAiCaptionVi: e.target.checked })}
                    />
                    <span className="live-session-settings-toggle-body">
                      <span className="live-session-settings-toggle-title">Vietnamese under AI captions</span>
                      <span className="live-session-settings-toggle-desc">Translation of the realtime caption line.</span>
                    </span>
                  </label>
                  <label className="live-session-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settingsDraft.showLiveVoiceHintVi}
                      onChange={(e) => patchSettingsDraft({ showLiveVoiceHintVi: e.target.checked })}
                    />
                    <span className="live-session-settings-toggle-body">
                      <span className="live-session-settings-toggle-title">Vietnamese hint text</span>
                      <span className="live-session-settings-toggle-desc">Translation below sidebar hints.</span>
                    </span>
                  </label>
                  <label className="live-session-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settingsDraft.liveVoiceMicHandsFree}
                      onChange={(e) => patchSettingsDraft({ liveVoiceMicHandsFree: e.target.checked })}
                    />
                    <span className="live-session-settings-toggle-body">
                      <span className="live-session-settings-toggle-title">Hands-free mic</span>
                      <span className="live-session-settings-toggle-desc">
                        After each cooldown, mic opens automatically. Still mutes while the AI speaks.
                      </span>
                    </span>
                  </label>
                  <label className="live-session-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settingsDraft.casualCompanionMode}
                      onChange={(e) => patchSettingsDraft({ casualCompanionMode: e.target.checked })}
                    />
                    <span className="live-session-settings-toggle-body">
                      <span className="live-session-settings-toggle-title">Casual companion mode (Trò chuyện tự nhiên)</span>
                      <span className="live-session-settings-toggle-desc">
                        No hints/repairs shown. AI recasts mistakes and supports English-Vietnamese code-switching.
                      </span>
                    </span>
                  </label>
                  <label className="live-session-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settingsDraft.repairMySentence}
                      onChange={(e) => patchSettingsDraft({ repairMySentence: e.target.checked })}
                    />
                    <span className="live-session-settings-toggle-body">
                      <span className="live-session-settings-toggle-title">Repair my sentence</span>
                      <span className="live-session-settings-toggle-desc">
                        For Intermediate and Advanced: AI decides when a spoken line is worth repairing after your turn.
                      </span>
                    </span>
                  </label>
                </div>
                </>
              ) : null}
              {voice.logLines.length > 0 ? (
                <div className="live-session-settings-section" style={{ marginTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16 }}>
                  <p className="live-session-settings-section-title">WebRTC Connection Logs</p>
                  <div
                    style={{
                      maxHeight: 120,
                      overflowY: 'auto',
                      background: 'rgba(0,0,0,0.3)',
                      padding: 8,
                      borderRadius: 8,
                      fontFamily: 'monospace',
                      fontSize: '0.74rem',
                      color: 'rgba(239, 248, 243, 0.7)',
                      textAlign: 'left',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {voice.logLines.join('\n')}
                  </div>
                  <button
                    type="button"
                    className="live-session-settings-btn live-session-settings-btn--ghost live-session-settings-btn--compact"
                    style={{ alignSelf: 'flex-start', marginTop: 6 }}
                    onClick={voice.clearLogs}
                  >
                    Clear logs
                  </button>
                </div>
              ) : null}
            </div>
            <div className="live-session-settings-footer">
              <button type="button" className="live-session-settings-btn live-session-settings-btn--ghost" onClick={closeLiveSettingsModal}>
                Close
              </button>
              <div className="live-session-settings-footer-actions">
                <button
                  type="button"
                  className="live-session-settings-btn live-session-settings-btn--primary"
                  disabled={!settingsDraft || !settingsDirty}
                  onClick={saveLiveSettings}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="talk-stage talk-stage--focus talk-stage--tri">
        <aside
          className="live-ai-script live-ai-script--top live-ai-script--compact"
          aria-label="AI script — situation you and the AI are acting out"
        >
          <div className="live-ai-script-head">
            <span className="live-ai-script-tag">Context</span>
            <span className="live-ai-script-title-inline">{liveVoiceScriptTitleLine(scenario)}</span>
          </div>
          <div className="live-ai-script-role-row">
            <label className="live-ai-script-role-inline" title="Your speaking part in this scene">
              <span className="live-ai-script-role-label">You</span>
              <input
                type="text"
                className="live-ai-script-role-input"
                disabled={setupDisabled}
                value={setup.userRole}
                onChange={(e) => setSetup((s) => ({ ...s, userRole: e.target.value }))}
                autoComplete="off"
                aria-label="Who you speak as in this scene (e.g. customer, salesperson)"
                style={liveAiScriptRoleFieldSx}
              />
            </label>
            <button
              type="button"
              className="live-ai-script-swap-btn"
              disabled={setupDisabled}
              title="Swap your part and the assistant’s part (who speaks first flips too). Restart voice if already connected."
              aria-label="Swap your role with the assistant role"
              onClick={swapPracticeRoles}
            >
              ⇄
            </button>
            <label className="live-ai-script-role-inline" title="Role the realtime assistant plays">
              <span className="live-ai-script-role-label"> Agent</span>
              <input
                type="text"
                className="live-ai-script-role-input"
                disabled={setupDisabled}
                value={setup.aiRole}
                onChange={(e) => setSetup((s) => ({ ...s, aiRole: e.target.value }))}
                autoComplete="off"
                aria-label="Who the assistant speaks as (e.g. shop clerk, interviewer)"
                style={liveAiScriptRoleFieldSx}
              />
            </label>
          </div>
          {voiceBusy ? (
            <p className="live-ai-script-role-hint">Restart voice chat after swapping or editing roles so the assistant picks up new instructions.</p>
          ) : null}
          {liveVoiceSceneParagraph ? (
            <p className="live-ai-script-prompt" style={{ whiteSpace: 'pre-wrap' }}>
              {liveVoiceSceneParagraph}
            </p>
          ) : null}
        </aside>

        <div
          className={`live-stage-columns${settings.showLiveVoiceConversationText ? '' : ' live-stage-columns--no-conversation-text'}${settings.casualCompanionMode ? ' live-stage-columns--casual' : ''}`}
        >
          {settings.showLiveVoiceConversationText ? (
            <div className="live-caption-col" aria-live="polite">
              {voice.aiCaption.trim() ? (
                <div className="live-voice-caption-block live-voice-caption-block--script">
                  <span className="live-voice-caption-tag live-voice-caption-tag--paired">
                    <span className="live-voice-caption-tag-key">Assistant speaks as</span>
                    <span className="live-voice-caption-tag-value">{scenario.aiRole}</span>
                  </span>
                  <p className="live-ai-line">{voice.aiCaption}</p>
                  {settings.showLiveVoiceAiCaptionVi && aiCaptionVi ? (
                    <p className="live-voice-line-vi">{aiCaptionVi}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="talk-main talk-core">
            <footer className="live-session-footer">
              <div className="live-orb-stack">
                <div className="conversation-pulse conversation-pulse--compact">
                  <div
                    ref={particleOrbRef}
                    className={`live-particle-orb${['live', 'listening', 'ai_speaking', 'connecting', 'cooldown'].includes(voice.uiStatus) ? ' live-particle-orb--active' : ''}${reduceMotionParticles ? ' live-particle-orb--reduce-motion' : ''}`}
                    data-state={
                      voice.uiStatus === 'ai_speaking' ? 'ai' : voice.uiStatus === 'listening' ? 'listening' : 'idle'
                    }
                  >
                    <canvas ref={particleOrbCanvasRef} className="live-particle-orb__canvas" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div
                className={`voice-controls voice-controls--compact voice-controls--minimal live-voice-controls-row${showEndButton ? '' : ' live-voice-controls-row--solo-mic'}`}
              >
                {showEndButton ? (
                  <button
                    type="button"
                    className="live-voice-round-btn live-voice-round-btn--end"
                    title="Exit session"
                    aria-label="Exit session"
                    onClick={endLive}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M7 7l10 10M17 7L7 17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ) : null}
                <div className={micShellClassNames}>
                  <div className="live-voice-mic-shell__frame">
                    {micShellVisual === 'cooldown' ? (
                      <span key={voice.cooldownRemaining ?? 'cd'} className="live-voice-mic-shell__countdown" aria-hidden>
                        {voice.cooldownRemaining != null ? voice.cooldownRemaining : '·'}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`live-voice-round-btn live-voice-round-btn--mic${
                        isLivePhase && !voice.muted && micShellVisual !== 'cooldown'
                          ? micShellVisual === 'processing'
                            ? ' live-voice-round-btn--mic-processing-warm'
                            : ' live-voice-round-btn--mic-hot'
                          : ''
                      }${isLivePhase && voice.muted ? ' live-voice-round-btn--mic-muted' : ''}${!isLivePhase && !isConnecting ? ' live-voice-round-btn--mic-start' : ''}`}
                      disabled={isConnecting || micInteractionLocked}
                      title={primaryMicLabel}
                      aria-label={primaryMicLabel}
                      aria-busy={micShellVisual === 'processing' ? true : undefined}
                      aria-describedby={trimmedStatus ? micShellStatusId : undefined}
                      onClick={onPrimaryMicClick}
                    >
                      {isConnecting ? (
                        <span className="live-voice-round-btn__spinner" aria-hidden />
                      ) : !isLivePhase ? (
                        <svg
                          className="live-voice-start-icon"
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <defs>
                            <linearGradient
                              id="hinttalk-live-voice-start-grad"
                              x1="12"
                              y1="5"
                              x2="12"
                              y2="19"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop offset="0%" stopColor="#7ee8f4" />
                              <stop offset="42%" stopColor="#3fb7c8" />
                              <stop offset="100%" stopColor="#dff4e8" />
                            </linearGradient>
                          </defs>
                          <g
                            stroke="url(#hinttalk-live-voice-start-grad)"
                            strokeWidth="2.15"
                            strokeLinecap="round"
                          >
                            <line x1="6" y1="9" x2="6" y2="15" />
                            <line x1="9" y1="7" x2="9" y2="17" />
                            <line x1="12" y1="5.5" x2="12" y2="18.5" />
                            <line x1="15" y1="7" x2="15" y2="17" />
                            <line x1="18" y1="9" x2="18" y2="15" />
                          </g>
                        </svg>
                      ) : (
                        <svg
                          className={`live-voice-mic-svg${voice.muted ? ' live-voice-mic-svg--muted' : ''}`}
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M19 10v1a7 7 0 01-14 0v-1M12 19v3M9 22h6"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                          />
                          {voice.muted ? (
                            <path
                              d="M6 6L18 18"
                              stroke="currentColor"
                              strokeWidth="2.25"
                              strokeLinecap="round"
                            />
                          ) : null}
                        </svg>
                      )}
                    </button>
                  </div>
                  {trimmedStatus ? (
                    <p
                      id={micShellStatusId}
                      className={showMicMergedCaption ? micCaptionToneClass : 'live-voice-sr-only'}
                      role="status"
                      aria-live="polite"
                    >
                      {voice.statusLine}
                    </p>
                  ) : null}
                </div>
              </div>
            </footer>
          </div>

          {!settings.casualCompanionMode ? (
            <aside className="live-hint-rail" aria-label="Hints">
              {(() => {
                if (repairDecision?.shouldRepair) {
                  return (
                    <div className="live-hint-stack">
                      <div className="live-hint-card live-repair-card">
                        <span className="live-voice-caption-tag live-hint-rail-tag">
                          {repairPracticeActive ? 'Practice repair' : 'Repair'}
                        </span>
                        {repairDecision.original ? (
                          <p className="live-repair-original" lang="en">
                            {repairDecision.original}
                          </p>
                        ) : null}
                        <p className="live-repair-better" lang="en">
                          {repairDecision.repaired}
                        </p>
                        {repairDecision.explanationVi ? (
                          <p className="live-repair-note" lang="vi">
                            {repairDecision.explanationVi}
                          </p>
                        ) : null}
                        <div className="live-repair-actions">
                          <button
                            type="button"
                            className="live-repair-action live-repair-action--primary"
                            onClick={practiceRepairLine}
                          >
                            Practice this
                          </button>
                          <button type="button" className="live-repair-action" onClick={clearRepairAndReturnToHints}>
                            Continue
                          </button>
                          <button type="button" className="live-repair-action" onClick={clearRepairAndReturnToHints}>
                            Skip
                          </button>
                        </div>
                        {repairPracticeActive ? (
                          <p className="live-repair-repeat" role="status">
                            Say the repaired sentence once, then the conversation continues.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                }

                const showAiHint = Boolean(hintPack && hintEnJoined.trim());
                const showHintLoading = hintApiConfigured && hintLoading && !showAiHint;
                const offlineLine = offlineHintRailLine.trim();
                const showOfflineFallback = Boolean(offlineLine) && !hintApiConfigured;
                const showHintUnavailable = hintApiConfigured && hintAiAttemptedRef.current && !hintLoading && !showAiHint;

                if (!showAiHint && !showHintLoading && !showOfflineFallback && !showHintUnavailable) return null;

                return (
                  <div className="live-hint-stack">
                    {showAiHint ? (
                      <div className="live-hint-card">
                        <span className="live-voice-caption-tag live-hint-rail-tag">Hint</span>
                        <p className="live-hint-card-p live-hint-card-p--primary" lang="en" style={{ whiteSpace: 'pre-wrap' }}>
                          {hintEnJoined}
                        </p>
                        {settings.showLiveVoiceHintVi && hintViText ? (
                          <p className="live-hint-card-vi" lang="vi">
                            {hintViText}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {showHintLoading ? (
                      <div className="live-hint-card">
                        <span className="live-voice-caption-tag live-hint-rail-tag">Hint</span>
                        <p className="live-hint-card-p live-hint-card-p--primary" role="status" aria-live="polite">
                          Loading AI suggestion…
                        </p>
                      </div>
                    ) : null}
                    {showOfflineFallback ? (
                      <div className="live-hint-card">
                        <span className="live-voice-caption-tag live-hint-rail-tag">Phrases</span>
                        <p className="live-hint-card-p live-hint-card-p--primary" lang="en">
                          {offlineLine}
                        </p>
                      </div>
                    ) : null}
                    {showHintUnavailable ? (
                      <div className="live-hint-card">
                        <span className="live-voice-caption-tag live-hint-rail-tag">Hint unavailable</span>
                        <p className="live-hint-card-p live-hint-card-p--primary" role="status" aria-live="polite">
                          Check the Hint API key or model in settings.
                        </p>
                        {hintErrorMessage && (
                          <p style={{ marginTop: 8, fontSize: '0.82em', color: '#ff6b6b', opacity: 0.95, lineHeight: 1.4 }}>
                            {hintErrorMessage}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </aside>
          ) : null}
        </div>
      </section>

    </main>
  );
}

export function LiveVoiceSessionPage() {
  const [setup, setSetup] = useState<LiveVoiceSetup>(() => loadLiveVoiceSetup());
  const [settings, setSettings] = useState<StoredSettings>(() => loadSettings());

  useEffect(() => {
    saveLiveVoiceSetup(setup);
  }, [setup]);

  const commitSettings = useCallback((next: StoredSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const template = useMemo(() => getScenarioById(FREE_VOICE_SCENARIO_ID), []);
  const scenario = useMemo(() => (template ? buildScenarioFromLiveSetup(setup, template) : undefined), [setup, template]);
  const launch = useMemo(() => launchForSetup(setup.level), [setup.level]);

  if (!template || !scenario) {
    return (
      <main className="voice-app talking-room" style={{ padding: 24 }}>
        <p>Missing free voice scenario. Check mock data.</p>
      </main>
    );
  }

  return (
    <LiveVoiceInner
      scenario={scenario}
      launch={launch}
      settings={settings}
      setup={setup}
      setSetup={setSetup}
      commitSettings={commitSettings}
    />
  );
}
