export type HintLevel = 'beginner' | 'intermediate' | 'advanced';

export type PracticeMode = 'write' | 'speak' | 'live_voice';

export type PracticeType = 'conversation' | 'toeic';

export type ToeicTaskType =
  | 'read_aloud'
  | 'describe_picture'
  | 'respond_to_questions'
  | 'provided_information'
  | 'express_opinion'
  | 'picture_sentence'
  | 'respond_to_request'
  | 'opinion_essay';

export type HintPack = {
  beginner: string[];
  intermediate: string[];
  advanced: string[];
};

export type ScriptedTurn = {
  ai: string;
  hints: HintPack;
};

export type MockScenario = {
  id: string;
  practiceType: PracticeType;
  /** Chat = scripted turns; document = TOEIC-style draft sheet */
  sessionKind: 'chat' | 'document';
  title: string;
  category: string;
  aiRole: string;
  userRole: string;
  goal: string;
  phraseBank: string[];
  toeicSection?: 'speaking' | 'writing';
  toeicTaskType?: ToeicTaskType;
  questionRange?: string;
  prompt?: string;
  /** Optional Vietnamese gloss under English prompt / script */
  promptVi?: string;
  planSteps?: { step: string; title: string; hint: string }[];
  turns: ScriptedTurn[];
  docHints?: string[];
  defaultDraft?: string;
};

export type ConversationTurn = {
  id: string;
  speaker: string;
  role: 'ai' | 'user';
  text: string;
  inputMode?: 'typed' | 'speech' | 'realtime_audio';
  hintShown?: string;
  usefulPhrasesShown?: string[];
  createdAt: string;
};

export type HintTalkSession = {
  id: string;
  practiceType: PracticeType;
  scenarioId: string;
  scenarioTitle: string;
  toeicTaskType?: ToeicTaskType;
  toeicSection?: 'speaking' | 'writing';
  questionRange?: string;
  prompt?: string;
  mode: PracticeMode;
  level: HintLevel;
  roles: { ai: string; user: string };
  startedAt: string;
  endedAt?: string;
  turns: ConversationTurn[];
};

export type StoredSettings = {
  /** OpenAI (or compatible) key for Realtime WebRTC — stored only in this browser for personal use */
  realtimeApiKey: string;
  realtimeModel: string;
  realtimeVoice: string;
  ttsModel: string;
  sttModel: string;
  shadowingLength: 'brief' | 'standard' | 'full';
  shadowingGapMode: 'pause' | 'continuous';
  shadowingGapSeconds: number;
  /** Seconds to wait after each AI reply before unmuting (rate-limit friendly). */
  realtimeCooldownSeconds: number;
  hintBaseUrl: string;
  hintApiKey: string;
  hintModel: string;
  /** Show optional MM:SS timer in practice headers */
  showPracticeTimer: boolean;
  saveTranscripts: boolean;
  saveAudio: boolean;
  /** Live voice: show realtime AI dialogue caption next to the orb */
  showLiveVoiceConversationText: boolean;
  /** Live voice: Vietnamese line under AI realtime captions */
  showLiveVoiceAiCaptionVi: boolean;
  /** Live voice: Vietnamese under sidebar hints */
  showLiveVoiceHintVi: boolean;
  /** Live voice: auto-unmute mic after each AI cooldown (vs tap mic each turn) */
  liveVoiceMicHandsFree: boolean;
  /** Live voice: AI decides whether an intermediate/advanced learner line is worth repairing. */
  repairMySentence: boolean;
  /** Live voice: Casual companion mode with no-stress implicit recasting and code-switching */
  casualCompanionMode: boolean;
};

export type RepairDecision = {
  shouldRepair: boolean;
  priority: 'none' | 'low' | 'medium' | 'high';
  reason:
    | 'good_enough'
    | 'too_short'
    | 'unclear_transcript'
    | 'minor_issue'
    | 'grammar'
    | 'naturalness'
    | 'politeness'
    | 'reusable_pattern';
  interruptionRisk: 'low' | 'medium' | 'high';
  original: string;
  repaired: string;
  explanationVi: string;
};

export type SessionLaunchState = {
  scenarioId: string;
  level: HintLevel;
  mode: PracticeMode;
};

/** Who delivers the first line once the session is live (Realtime instructions follow this). */
export type LiveVoiceSpeaksFirst = 'ai' | 'user';

/** Saved locally for /live-voice — preset topic id + role-play roles + hint level. */
export type LiveVoiceSetup = {
  /** Key into LIVE_VOICE_TOPIC_PRESETS */
  topicPresetId: string;
  aiRole: string;
  userRole: string;
  level: HintLevel;
  speaksFirst: LiveVoiceSpeaksFirst;
};

export type ShadowingGenre = 'announcement' | 'radio' | 'weather' | 'meeting' | 'service' | 'podcast';

export type ShadowingTextMode = 'visible' | 'preview' | 'hidden';

export type ShadowingPaceLabel = 'too_slow' | 'close' | 'too_fast' | 'unknown';
export type ShadowingCaptureStatus = 'captured' | 'no_speech' | 'missing_api_key' | 'mic_unavailable' | 'transcription_failed' | 'capture_unavailable';

export type ShadowingLine = {
  id: string;
  text: string;
  focusPhrase?: string;
};

export type ShadowingLesson = {
  id: string;
  title: string;
  level: Extract<HintLevel, 'intermediate' | 'advanced'>;
  genre: ShadowingGenre;
  voiceHint: string;
  ttsVoice?: string;
  ttsModel?: string;
  promptInstruction?: string;
  targetWpm: number;
  lines: ShadowingLine[];
};

export type ShadowingLineResult = {
  lineId: string;
  target: string;
  transcript: string;
  captureStatus: ShadowingCaptureStatus;
  captureError?: string;
  accuracy: number;
  paceLabel: ShadowingPaceLabel;
  missingWords: string[];
  extraWords: string[];
  changedWords: string[];
  modelDurationMs: number;
  captureDurationMs: number;
};
