import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_ERRANDS_SERVICES = [
  {
    id: 'shopping',
    label: 'Retail — browse & buy',
    situation:
      'Clothing or electronics store: size colour stock compare models warranty return window gift receipt student discount try fitting room ask recommendation upsell politely decline.',
    defaultUserRole: 'Shopper',
    defaultAiRole: 'Sales associate',
  },
  {
    id: 'directions',
    label: 'Street — directions',
    situation:
      'Lost visitor asks local walking subway landmarks ETA pronunciation repeat slower thank you offer alternate route if first unclear.',
    defaultUserRole: 'Visitor',
    defaultAiRole: 'Local person',
  },
  {
    id: 'bank',
    label: 'Bank branch visit',
    situation:
      'Counter appointment wire transfer fee misunderstanding debit card block appointment mortgage teaser question safe deposit hours English forms clarify jargon patiently.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Bank teller',
  },
  {
    id: 'post_office',
    label: 'Post / parcel desk',
    situation:
      'Send international package customs form insurance tracking lost parcel claim pick-up slip queue forms weigh stamps restricted items.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Postal clerk',
  },
  {
    id: 'library',
    label: 'Library — membership & study',
    situation:
      'Sign-up card borrowing limits printer quiet zone group study room reservation overdue fines digital resources thesis chapter small talk librarian.',
    defaultUserRole: 'Patron',
    defaultAiRole: 'Librarian',
  },
] satisfies readonly LiveVoiceTopicPreset[];
