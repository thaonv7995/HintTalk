import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_SOCIAL = [
  {
    id: 'small_talk',
    label: 'Small talk — mix',
    situation:
      'Light chat after class commute coffee kitchen weather weekend plans hobby Netflix polite disagree humour boundaries.',
    defaultUserRole: 'Friend',
    defaultAiRole: 'Friend (other)',
  },
  {
    id: 'first_date_cafe',
    label: 'Casual first meet-up',
    situation:
      'Low-pressure café meet stories travel books music awkward silence recovery polite boundaries bill split humour realistic modern tone.',
    defaultUserRole: 'Dater',
    defaultAiRole: 'Date',
  },
] satisfies readonly LiveVoiceTopicPreset[];
