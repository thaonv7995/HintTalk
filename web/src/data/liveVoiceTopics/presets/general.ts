import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_GENERAL = [
  {
    id: 'open',
    label: 'Any topic — decide together',
    subtitle: 'Negotiate scenario + roles verbally after pressing Start.',
    situation: '',
    register: 'free',
    learnerExtras: [
      'Propose concrete places or goals if silence drags (“How about practising a hotel check-in?”).',
    ],
    aiExtras: [
      'Warmly invite the learner to choose; affirm ideas and scaffold missing details collaboratively.',
    ],
    defaultUserRole: 'Learner',
    defaultAiRole: 'Conversation partner',
  },
] satisfies readonly LiveVoiceTopicPreset[];
