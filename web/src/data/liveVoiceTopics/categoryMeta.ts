import type { LiveVoiceTopicCategory, LiveVoiceTopicCategoryId } from './types';

/** Stable accordion / documentation order — must match presetCategoryMap grouping. */
export const CATEGORY_ORDER: readonly LiveVoiceTopicCategoryId[] = [
  'general',
  'food_hospitality',
  'travel_transport',
  'errands_services',
  'health',
  'home_neighbours',
  'work_study',
  'support_retail',
  'leisure',
  'social',
];

export const CATEGORY_META: Record<
  LiveVoiceTopicCategoryId,
  Omit<LiveVoiceTopicCategory, 'id' | 'topics'>
> = {
  general: {
    title: 'General',
    description: 'Open-ended warmup — learner and AI co-create the storyline together.',
    registerDefault: 'free',
    learnerGuide: [
      'Co-create specifics (place, stakes, timeframe) verbally once the session begins.',
      'Signal what you’re practising (“I’d like polite complaints today”).',
      'Recycle useful phrases aloud if something didn’t sound natural.',
    ],
    aiGuide: [
      'Mirror the learner’s chosen topic; suggest gentle forks if imagination stalls.',
      'Keep scaffolding questions short so the learner does most of the speaking.',
      'Stay flexible if they veto an idea.',
    ],
  },
  food_hospitality: {
    title: 'Food & hospitality',
    description: 'Ordering, tweaks, tipping culture, polite complaints.',
    registerDefault: 'neutral',
    learnerGuide: [
      'State orders clearly then confirm details aloud (modifiers, allergens, takeaway).',
      'Use polite escalation when something is wrong: facts → impact → acceptable fix.',
      'Practice natural small talk queues (weather, specials) without dominating.',
    ],
    aiGuide: [
      'Maintain venue-appropriate hustle; confirm orders back to reduce errors.',
      'Offer one unobtrusive upsell when it fits (“Today’s pastries are…” ).',
      'Apologise concretely and propose options during service recovery.',
    ],
  },
  travel_transport: {
    title: 'Travel & transport',
    description: 'Airlines, lodging, rails, taxis, rentals — itineraries under stress.',
    registerDefault: 'neutral',
    learnerGuide: [
      'Provide reservation numbers, itineraries, baggage facts before asking for fixes.',
      'Ask about fees, timelines, and written/email confirmation when stakes are high.',
      'Practice calm tone even when annoyed — firm but factual.',
    ],
    aiGuide: [
      'Enforce plausible policies yet stay helpful (rebooking, vouchers, disclaimers).',
      'Volunteer realistic next-step suggestions (gates, ETA, vouchers).',
      'Acknowledge stress empathetically while staying concise.',
    ],
  },
  errands_services: {
    title: 'Errands & services',
    description: 'Retail counters, civic desks, parcels, everyday civic English.',
    registerDefault: 'neutral',
    learnerGuide: [
      'State your goal plainly and bring needed nouns (“tracking number”, account type).',
      'Ask jargon to be rephrased; repeat tricky spellings aloud.',
      'Practice asking for clarification on forms, timelines, penalties.',
    ],
    aiGuide: [
      'Reference realistic procedures without inventing unlawful shortcuts.',
      'Offer step-by-step guidance when bureaucracy is confusing.',
      'Keep jargon minimal unless the learner probes deeper.',
    ],
  },
  health: {
    title: 'Health & wellbeing',
    description: 'Patients, pharmacies, vets — factual and empathetic English.',
    registerDefault: 'clinical',
    learnerGuide: [
      'Describe timelines, triggers, meds, allergies with chronological clarity.',
      'Ask predictable next steps (labs, dosing, precautions) politely.',
      'Avoid demanding definitive diagnoses beyond what the clinician can say.',
    ],
    aiGuide: [
      'Use plain-language reassurance and focused follow-up questions.',
      'Defer to escalation (“see your GP”) when outside scope.',
      'Never invent prescriptions; cite typical options generically.',
    ],
  },
  home_neighbours: {
    title: 'Home & neighbours',
    description: 'Housing hunts, roommate life, courteous neighbour diplomacy.',
    registerDefault: 'neutral',
    learnerGuide: [
      'Frame requests with shared goals (“quiet hours”) and concrete suggestions.',
      'Negotiate politely: listen, repeat back their stance, propose compromise.',
      'Capture deal points aloud (deposit, chores, timelines).',
    ],
    aiGuide: [
      'Show realistic tenancy constraints plus willingness to troubleshoot.',
      'Mirror balanced empathy for shared-flat friction.',
      'Offer concrete compromises before shutting ideas down.',
    ],
  },
  work_study: {
    title: 'Work & study',
    description: 'Interviews, meetings, academia — professional pacing.',
    registerDefault: 'formal',
    learnerGuide: [
      'Practice STAR-ish answers succinctly yet with memorable detail.',
      'Ask purposeful follow-ups (scope, KPIs, next steps).',
      'Demonstrate diplomacy when pushing back upward.',
    ],
    aiGuide: [
      'Play believable interviewer/manager timelines and constraints.',
      'Ask focused behavioural prompts; avoid courtroom cross-examination.',
      'Celebrate wins while probing growth areas politely.',
    ],
  },
  support_retail: {
    title: 'Support & tech retail',
    description: 'Call-centre diplomacy, escalation scripts, handset counters.',
    registerDefault: 'neutral',
    learnerGuide: [
      'Summarize the issue succinctly plus evidence (dates, screenshots described).',
      'State acceptable outcomes (refund, replacement, SLA).',
      'Stay patient with verification scripts while protecting privacy.',
    ],
    aiGuide: [
      'Follow realistic workflow (verify ticket, place on hold politely).',
      'Offer scripted empathy plus escalation paths.',
      'Keep hardware retail facts plausible for mid-market brands.',
    ],
  },
  leisure: {
    title: 'Leisure & culture',
    description: 'Museums, cinema, salons, gyms, cowork hubs.',
    registerDefault: 'casual',
    learnerGuide: [
      'Ask logistical questions aloud (pricing, combos, blackout rules).',
      'Give gentle feedback loops (“mirror please”, haircut tweaks).',
      'Handle upsell courteously (“Not today thanks”).',
    ],
    aiGuide: [
      'Maintain venue cheer without pressure-cooking the learner.',
      'Explain jargon (membership tiers, blackout windows) succinctly.',
      'Offer plausible alternatives based on learner constraints.',
    ],
  },
  social: {
    title: 'Social English',
    description: 'Light rapport, recovery from awkward gaps, interpersonal boundaries.',
    registerDefault: 'casual',
    learnerGuide: [
      'Recycle open-ended questions (“How was your commute?” ).',
      'Recover awkward pauses gracefully; respect boundaries aloud.',
      'Practice polite disagreement without shutting down rapport.',
    ],
    aiGuide: [
      'Model warm reciprocity plus micro follow-ups referencing their replies.',
      'Keep tone friendly, not scripted stand-up comedy.',
      'Flag gently if humour might land wrongly.',
    ],
  },
};
