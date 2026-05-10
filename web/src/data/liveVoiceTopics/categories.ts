import type { LiveVoiceTopicCategory, LiveVoiceTopicCategoryId } from './types';
import { CATEGORY_ORDER, CATEGORY_META } from './categoryMeta';
import { PRESET_CATEGORY_ID } from './presetCategoryMap';
import { LIVE_VOICE_TOPIC_PRESETS } from './combinePresets';

export const LIVE_VOICE_TOPIC_CATEGORIES: LiveVoiceTopicCategory[] = CATEGORY_ORDER.map((cid) => ({
  id: cid,
  ...CATEGORY_META[cid],
  topics: LIVE_VOICE_TOPIC_PRESETS.filter(
    (p) => PRESET_CATEGORY_ID[p.id as keyof typeof PRESET_CATEGORY_ID] === cid,
  ),
}));

const CATEGORY_LOOKUP = Object.fromEntries(
  LIVE_VOICE_TOPIC_CATEGORIES.map((c) => [c.id, c]),
) as Record<LiveVoiceTopicCategoryId, LiveVoiceTopicCategory>;

export function getLiveVoiceTopicCategoryForPreset(presetId: string): LiveVoiceTopicCategory | undefined {
  const cid = PRESET_CATEGORY_ID[presetId];
  return cid ? CATEGORY_LOOKUP[cid] : undefined;
}
