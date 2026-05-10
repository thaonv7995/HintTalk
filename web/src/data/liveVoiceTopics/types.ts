/**
 * Canonical types for curated Live Voice topic presets — see `combinePresets.ts` & `categories.ts`.
 */

export type LiveVoiceRegisterTone = 'free' | 'casual' | 'neutral' | 'formal' | 'clinical' | 'empathetic';

export type LiveVoiceTopicCategoryId =
  | 'general'
  | 'food_hospitality'
  | 'travel_transport'
  | 'errands_services'
  | 'health'
  | 'home_neighbours'
  | 'work_study'
  | 'support_retail'
  | 'leisure'
  | 'social';

export type LiveVoiceTopicPreset = {
  id: string;
  label: string;
  subtitle?: string;
  situation: string;
  defaultUserRole?: string;
  defaultAiRole?: string;
  register?: LiveVoiceRegisterTone;
  learnerExtras?: readonly string[];
  aiExtras?: readonly string[];
};

export type LiveVoiceTopicCategory = {
  id: LiveVoiceTopicCategoryId;
  title: string;
  description?: string;
  registerDefault?: LiveVoiceRegisterTone;
  learnerGuide: readonly string[];
  aiGuide: readonly string[];
  topics: LiveVoiceTopicPreset[];
};
