import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_LEISURE = [
  {
    id: 'museum',
    label: 'Museum / gallery desk',
    situation:
      'Tickets student discount audio guide map cloakroom photography rules temporary exhibit directions café wheelchair route.',
    defaultUserRole: 'Visitor',
    defaultAiRole: 'Staff',
  },
  {
    id: 'cinema',
    label: 'Cinema box office',
    situation: 'Seat selection refunds subtitles IMAX vs standard snacks combo membership peak pricing.',
    defaultUserRole: 'Moviegoer',
    defaultAiRole: 'Box office staff',
  },
  {
    id: 'gym',
    label: 'Gym — membership desk',
    situation:
      'Trial class personal trainer contract freeze fee cancellation guest pass locker etiquette peak hours.',
    defaultUserRole: 'New member',
    defaultAiRole: 'Front desk',
  },
  {
    id: 'hair_salon',
    label: 'Hair / barber appointment',
    situation:
      'Describe cut colour reference photo maintenance schedule price patch test small talk mirror feedback tip.',
    defaultUserRole: 'Client',
    defaultAiRole: 'Stylist',
  },
  {
    id: 'coworking',
    label: 'Coworking — day pass',
    situation:
      'Tour pricing quiet booth phone booth printer guest wifi meeting room booking coffee etiquette network event poster.',
    defaultUserRole: 'Visitor',
    defaultAiRole: 'Community manager',
  },
] satisfies readonly LiveVoiceTopicPreset[];
