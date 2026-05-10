export type {
  LiveVoiceRegisterTone,
  LiveVoiceTopicCategory,
  LiveVoiceTopicCategoryId,
  LiveVoiceTopicPreset,
} from './types';

export { CATEGORY_ORDER, CATEGORY_META } from './categoryMeta';

export { PRESET_CATEGORY_ID } from './presetCategoryMap';

export { LIVE_VOICE_TOPIC_PRESETS } from './combinePresets';

export { LIVE_VOICE_TOPIC_CATEGORIES, getLiveVoiceTopicCategoryForPreset } from './categories';

export {
  isLiveVoiceTopicPresetId,
  getLiveVoiceTopicPreset,
  presetPrimarySceneText,
  topicTextFromPresetId,
} from './accessors';

export { buildLiveVoiceSituationScript, liveVoiceUiScenePreview } from './situationScript';

export { legacyTopicStringToPresetId } from './legacy';

import { LIVE_VOICE_TOPIC_CATEGORIES } from './categories';

/** Compatibility: flat sections keyed by translated group title — same ordering as accordion categories. */
export const LIVE_VOICE_TOPIC_PRESETS_GROUPED = LIVE_VOICE_TOPIC_CATEGORIES.map((c) => ({
  group: c.title,
  presets: [...c.topics],
}));
