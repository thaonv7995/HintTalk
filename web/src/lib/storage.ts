import type { HintTalkSession, LiveVoiceSetup, StoredSettings } from '../types';
import { isLiveVoiceTopicPresetId, legacyTopicStringToPresetId } from '../data/liveVoiceTopicPresets';
import { newId } from './ids';

const storageKeys = {
  settings: 'hinttalk.settings.v1',
  sessions: 'hinttalk.sessions.v1',
  liveVoiceSetup: 'hinttalk.liveVoiceSetup.v1',
} as const;

const defaultLiveVoiceSetup: LiveVoiceSetup = {
  topicPresetId: 'open',
  aiRole: 'Conversation partner',
  userRole: 'Learner',
  level: 'intermediate',
  speaksFirst: 'ai',
};

export function loadLiveVoiceSetup(): LiveVoiceSetup {
  try {
    const raw = localStorage.getItem(storageKeys.liveVoiceSetup);
    if (!raw) return { ...defaultLiveVoiceSetup };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let topicPresetId =
      typeof parsed.topicPresetId === 'string' && isLiveVoiceTopicPresetId(parsed.topicPresetId)
        ? parsed.topicPresetId
        : null;
    if (!topicPresetId && typeof parsed.topic === 'string') {
      topicPresetId = legacyTopicStringToPresetId(parsed.topic);
    }
    if (!topicPresetId) topicPresetId = defaultLiveVoiceSetup.topicPresetId;

    const level =
      parsed.level === 'beginner' || parsed.level === 'intermediate' || parsed.level === 'advanced'
        ? parsed.level
        : defaultLiveVoiceSetup.level;
    const speaksFirst = parsed.speaksFirst === 'user' ? 'user' : defaultLiveVoiceSetup.speaksFirst;

    const rawUser =
      typeof parsed.userRole === 'string' ? parsed.userRole.trim() || defaultLiveVoiceSetup.userRole : defaultLiveVoiceSetup.userRole;
    const userRole =
      rawUser.toLowerCase() === 'you' ? defaultLiveVoiceSetup.userRole : rawUser;

    return {
      topicPresetId,
      userRole,
      aiRole: typeof parsed.aiRole === 'string' ? parsed.aiRole : defaultLiveVoiceSetup.aiRole,
      level,
      speaksFirst,
    };
  } catch {
    return { ...defaultLiveVoiceSetup };
  }
}

export function saveLiveVoiceSetup(setup: LiveVoiceSetup): void {
  const clean: LiveVoiceSetup = {
    topicPresetId: setup.topicPresetId,
    aiRole: setup.aiRole,
    userRole: setup.userRole,
    level: setup.level,
    speaksFirst: setup.speaksFirst,
  };
  localStorage.setItem(storageKeys.liveVoiceSetup, JSON.stringify(clean));
}

const MAX_SESSIONS = 100;

const defaultSettings: StoredSettings = {
  realtimeApiKey: '',
  realtimeModel: 'gpt-realtime-mini',
  realtimeVoice: 'marin',
  ttsModel: 'edge-tts/en-GB-ThomasNeural',
  sttModel: 'gpt-4o-mini-transcribe',
  shadowingLength: 'standard',
  shadowingGapMode: 'pause',
  shadowingGapSeconds: 3,
  realtimeCooldownSeconds: 5,
  hintBaseUrl: 'https://api.openai.com/v1',
  hintApiKey: '',
  hintModel: 'gpt-4o-mini',
  showPracticeTimer: false,
  saveTranscripts: true,
  saveAudio: false,
  showLiveVoiceConversationText: true,
  showLiveVoiceAiCaptionVi: true,
  showLiveVoiceHintVi: true,
  liveVoiceMicHandsFree: true,
  repairMySentence: true,
  casualCompanionMode: false,
};

export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(storageKeys.settings);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged: StoredSettings = { ...defaultSettings, ...(parsed as Partial<StoredSettings>) };
    if (
      !Object.prototype.hasOwnProperty.call(parsed, 'showLiveVoiceConversationText') &&
      typeof parsed.showLiveVoiceAiScript === 'boolean'
    ) {
      merged.showLiveVoiceConversationText = parsed.showLiveVoiceAiScript;
    }
    return merged;
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: StoredSettings): void {
  localStorage.setItem(storageKeys.settings, JSON.stringify(settings));
}

export function loadSessions(): HintTalkSession[] {
  try {
    const raw = localStorage.getItem(storageKeys.sessions);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HintTalkSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertSession(session: HintTalkSession): void {
  const list = loadSessions().filter((s) => s.id !== session.id);
  list.unshift(session);
  localStorage.setItem(storageKeys.sessions, JSON.stringify(list.slice(0, MAX_SESSIONS)));
}

export function deleteSession(id: string): void {
  const list = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(storageKeys.sessions, JSON.stringify(list));
}

export function exportSessionsBlob(sessions: HintTalkSession[]): Blob {
  return new Blob([JSON.stringify({ version: 1, sessions }, null, 2)], {
    type: 'application/json',
  });
}

export function importSessionsFromJson(text: string): number {
  const data = JSON.parse(text) as { sessions?: HintTalkSession[] };
  if (!data.sessions?.length) return 0;
  const existing = loadSessions();
  const merged = [...data.sessions.map((s) => ({ ...s, id: s.id || newId() })), ...existing];
  const seen = new Set<string>();
  const deduped = merged.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  localStorage.setItem(storageKeys.sessions, JSON.stringify(deduped.slice(0, MAX_SESSIONS)));
  return data.sessions.length;
}
