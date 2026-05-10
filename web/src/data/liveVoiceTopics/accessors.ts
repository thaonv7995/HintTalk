import { LIVE_VOICE_TOPIC_PRESETS } from './combinePresets';
import type { LiveVoiceTopicPreset } from './types';

const PRESET_IDS = new Set(LIVE_VOICE_TOPIC_PRESETS.map((p) => p.id));

export function isLiveVoiceTopicPresetId(id: string): boolean {
  return PRESET_IDS.has(id);
}

export function getLiveVoiceTopicPreset(id: string): LiveVoiceTopicPreset | undefined {
  return LIVE_VOICE_TOPIC_PRESETS.find((p) => p.id === id);
}

export function presetPrimarySceneText(preset?: LiveVoiceTopicPreset): string {
  return preset?.situation?.trim() ?? '';
}

export function topicTextFromPresetId(topicPresetId: string): string {
  return presetPrimarySceneText(getLiveVoiceTopicPreset(topicPresetId));
}
