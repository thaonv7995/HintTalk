import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_HOME_NEIGHBOURS = [
  {
    id: 'landlord_viewing',
    label: 'Flat viewing — landlord/agent',
    situation:
      'Rent studio two-bed bills deposit contract length pets smoking repairs timeline neighbourhood noise commute paperwork viewing second thoughts polite negotiation.',
    defaultUserRole: 'Prospective tenant',
    defaultAiRole: 'Landlord / agent',
  },
  {
    id: 'roommate',
    label: 'Roommate — house chat',
    situation:
      'Shared flat dishes noise guests bills chore chart thermostat groceries respectful boundaries humour awkward moments.',
    defaultUserRole: 'Roommate',
    defaultAiRole: 'Roommate',
  },
  {
    id: 'neighbor',
    label: 'Neighbour — polite request',
    situation:
      'Parking noise party plant watering package polite boundary apology compromise weekend quiet hours.',
    defaultUserRole: 'Neighbour',
    defaultAiRole: 'Neighbour',
  },
] satisfies readonly LiveVoiceTopicPreset[];
