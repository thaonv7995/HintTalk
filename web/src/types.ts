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
