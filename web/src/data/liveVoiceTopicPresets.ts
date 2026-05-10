/**
 * Curated Live Voice topic model + presets.
 * Implementation is split across `liveVoiceTopics/` for easier edits per domain.
 */

export type {
  LiveVoiceRegisterTone,
  LiveVoiceTopicCategory,
  LiveVoiceTopicCategoryId,
  LiveVoiceTopicPreset,
} from './liveVoiceTopics/types';

export {
  CATEGORY_META,
  CATEGORY_ORDER,
  PRESET_CATEGORY_ID,
  LIVE_VOICE_TOPIC_PRESETS,
  LIVE_VOICE_TOPIC_CATEGORIES,
  LIVE_VOICE_TOPIC_PRESETS_GROUPED,
  getLiveVoiceTopicCategoryForPreset,
  isLiveVoiceTopicPresetId,
  getLiveVoiceTopicPreset,
  presetPrimarySceneText,
  topicTextFromPresetId,
  buildLiveVoiceSituationScript,
  liveVoiceUiScenePreview,
  legacyTopicStringToPresetId,
} from './liveVoiceTopics';
