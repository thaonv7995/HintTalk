import type { LiveVoiceTopicPreset } from '../types';

/** Extra presets — keep `presetCategoryMap.ts` in sync when adding IDs. */
export const TOPIC_PRESETS_EXTENDED = [
  {
    id: 'coffee_drive_thru',
    label: 'Drive-thru lane',
    subtitle: 'Order through the speaker, confirm total, fix mistakes at the window.',
    situation:
      'Busy drive-through: noisy intercom, staff read back drink modifiers; learner handles mishears; pickup window handles payment and hand-off politely.',
    defaultUserRole: 'Driver',
    defaultAiRole: 'Crew member',
    learnerExtras: [
      'Pause after each modifier so read-back is easy.',
      'Echo the total and ask before paying if something sounds off.',
    ],
    aiExtras: [
      'Read the order back once clearly; keep lines short over the speaker.',
    ],
    register: 'casual',
  },
  {
    id: 'bakery_counter',
    label: 'Bakery — bread & pastries',
    subtitle: 'Freshness, allergens, slicing, preorder pickup.',
    situation:
      'Artisan bakery queue: ask what is freshest, nut-free options, preorder name, half-loaf and slice thickness, bag preference, peak-hour politeness.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Baker / counter',
    learnerExtras: [
      'Name allergens calmly; correct mistakes without sounding rude.',
      'Confirm price when something is weighed.',
    ],
    aiExtras: [
      'Offer one soft upsell with a short tasting note.',
    ],
  },
  {
    id: 'farmers_market_stall',
    label: 'Farmers’ market stall',
    subtitle: 'Samples policy, weighing, small talk with vendors.',
    situation:
      'Outdoor market: tastings policy, weighed pricing, carrying multiple small buys, short friendly chat about what is in season.',
    defaultUserRole: 'Shopper',
    defaultAiRole: 'Vendor',
    learnerExtras: [
      'Ask “Could you add one more small bunch after you weigh this?”.',
      'Switch between price questions and light small talk.',
    ],
    aiExtras: [
      'Sound like a real stallholder; give plausible harvest detail.',
    ],
    register: 'casual',
  },
  {
    id: 'hostel_checkin_budget',
    label: 'Hostel check-in',
    subtitle: 'Bunks, lockers, quiet hours, kitchen etiquette.',
    situation:
      'Budget hostel: bunk assignment, locker deposit, house rules, chore sheet, shared kitchen etiquette, respect for quiet hours.',
    defaultUserRole: 'Backpacker',
    defaultAiRole: 'Hostel reception',
    learnerExtras: [
      'Ask check-out time, adaptor sales, and luggage storage in order.',
      'React positively when many rules are listed at once.',
    ],
    aiExtras: [
      'Be welcoming but brief; warn about late-night noise windows.',
    ],
  },
  {
    id: 'hotel_concierge',
    label: 'Hotel concierge',
    subtitle: 'Restaurants, routes, taxis, family-friendly tips.',
    situation:
      'Hotel lobby concierge: dinner suggestions with constraints, stroller-friendly routes, rainy-day options, realistic expectations on tables and tips.',
    defaultUserRole: 'Guest',
    defaultAiRole: 'Concierge',
    learnerExtras: [
      'State budget and dietary needs up front.',
      'Ask for two options and a backup if the first is full.',
    ],
    aiExtras: [
      'Offer tiered suggestions; avoid impossible promises.',
    ],
    register: 'formal',
  },
  {
    id: 'rental_car_return_airport',
    label: 'Rental car — airport return',
    subtitle: 'Quick inspection, damage notes, shuttle to terminal.',
    situation:
      'Airport-area return under time pressure: fuel receipt, small scratch dispute, need for shuttle to terminal; stay factual and calm.',
    defaultUserRole: 'Renter',
    defaultAiRole: 'Return clerk',
    learnerExtras: [
      'Refer to photos or pick-up sheet if a scratch is disputed.',
      'Ask for a supervisor calmly if the clock is tight.',
    ],
    aiExtras: [
      'Follow plausible company policy; offer a clear escalation path.',
    ],
  },
  {
    id: 'border_declaration_desk',
    label: 'Arrival — customs declaration',
    subtitle: 'Truthful lists, simple answers, calm cooperation.',
    situation:
      'Airport customs lane: declare souvenirs and small cash gifts truthfully; answer short questions; officer is firm and procedural, not personal.',
    defaultUserRole: 'Traveller',
    defaultAiRole: 'Border officer',
    learnerExtras: [
      'Answer in short clear sentences; do not ramble when nervous.',
      'If unsure, say you are unsure rather than guessing.',
    ],
    aiExtras: [
      'Stay professional; do not invent laws; keep tone neutral.',
    ],
    register: 'formal',
  },
  {
    id: 'optician_glasses_shop',
    label: 'Optician — lenses & frames',
    subtitle: 'Prescription checks, coatings, lead time.',
    situation:
      'Optical shop: lens index, coatings, anti-glare trade-offs, PD measure, realistic order lead time, polite pushback on upsell.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Optician / sales',
    learnerExtras: [
      'Ask for jargon in plain English.',
      'State a budget early to guide options.',
    ],
    aiExtras: [
      'Explain trade-offs with simple analogies; give honest timelines.',
    ],
  },
  {
    id: 'tailor_alterations_quick',
    label: 'Tailor — quick alterations',
    subtitle: 'Hems, taper, turnaround, express fee.',
    situation:
      'Small tailor shop: fitting on a box, hem and taper discussion, wedding deadline, possible express surcharge, pin etiquette.',
    defaultUserRole: 'Client',
    defaultAiRole: 'Tailor',
    learnerExtras: [
      'Confirm pickup date and written quote.',
      'Give measurements in both metric/imperial if asked.',
    ],
    aiExtras: [
      'Set fair limits on rush jobs; stay kind about body-shape anxiety.',
    ],
  },
  {
    id: 'phone_repair_counter',
    label: 'Phone repair counter',
    subtitle: 'Data risk, parts, warranty, turnaround.',
    situation:
      'Repair counter: data backup warning, screen quality options, realistic repair time, loaner or trade-in mention, patience with queue.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Tech lead',
    learnerExtras: [
      'Ask what voids warranty before agreeing.',
      'Repeat the SLA date aloud to confirm.',
    ],
    aiExtras: [
      'No magic fixes; explain delays honestly.',
    ],
  },
  {
    id: 'city_lost_property',
    label: 'City lost & found',
    subtitle: 'Reference numbers, vague descriptions, next steps.',
    situation:
      'Transit or municipal lost-property desk: describe an item clearly, fill a form with help, learn wait time or reference number politely.',
    defaultUserRole: 'Visitor',
    defaultAiRole: 'Desk attendant',
    learnerExtras: [
      'Give one distinctive detail (sticker colour, notch) without contradicting yourself.',
      'Ask for a reference number before leaving.',
    ],
    aiExtras: [
      'Follow privacy rules; set realistic expectations on wait time.',
    ],
  },
  {
    id: 'small_move_quote',
    label: 'Small move — van quote',
    subtitle: 'Stairs, parking, blankets, surcharges.',
    situation:
      'Calling for a small move: list bulky items, stairs vs lift, parking permit who pays, time window, congestion or toll surcharges.',
    defaultUserRole: 'Renter',
    defaultAiRole: 'Mover / dispatch',
    learnerExtras: [
      'Summarise the inventory succinctly.',
      'Ask what is included in the quote.',
    ],
    aiExtras: [
      'Give a plausible price band and buffer for traffic.',
    ],
  },
  {
    id: 'parent_teacher_lite',
    label: 'Parent–teacher chat',
    subtitle: 'Progress, worries, respectful time box.',
    situation:
      "Short teacher meeting: child's progress dips, multilingual home context, maths confidence, extracurricular overload; respectful of the teacher's time.",
    defaultUserRole: 'Parent / guardian',
    defaultAiRole: 'Teacher',
    learnerExtras: [
      'Ask one focused follow-up at a time.',
      'Acknowledge home constraints calmly.',
    ],
    aiExtras: [
      'Answer with brief evidence-based suggestions.',
    ],
    register: 'neutral',
  },
  {
    id: 'esl_tutor_session',
    label: '1:1 ESL tutoring',
    subtitle: 'Pronunciation, chunks, corrective feedback loops.',
    situation:
      'Private ESL session: minimal pairs, chunked correction, repetition, gentle motivation; learner drives some of the drill choice.',
    defaultUserRole: 'Learner student',
    defaultAiRole: 'Tutor',
    learnerExtras: [
      'Request a targeted sound or grammar point.',
      "Paraphrase the tutor's correction to show you heard it.",
    ],
    aiExtras: [
      'Model then invite imitation; avoid long grammar lectures.',
    ],
  },
  {
    id: 'remote_sales_demo',
    label: 'Client discovery call',
    subtitle: 'Needs, objections, next steps aloud.',
    situation:
      'Short B2B-style discovery plus mini-demo: clarify customer needs, handle a compliance objection, summarise next steps in one verbal recap.',
    defaultUserRole: 'Account executive',
    defaultAiRole: 'Prospective client',
    learnerExtras: [
      'Label assumptions explicitly before pitching.',
      'Close with three bullet recap aloud.',
    ],
    aiExtras: [
      'Be skeptical but fair; cite realistic procurement friction.',
    ],
    register: 'formal',
  },
  {
    id: 'roadside_dispatch_call',
    label: 'Roadside assistance call',
    subtitle: 'Location, tyre, ETA, membership details.',
    situation:
      'Stranded driver on phone: dispatch checks cover, verifies exact location and tyre situation, gives ETA updates, stays calm.',
    defaultUserRole: 'Driver',
    defaultAiRole: 'Dispatch agent',
    learnerExtras: [
      'Give direction and landmark clues clearly.',
      'Repeat confirmations back.',
    ],
    aiExtras: [
      'Stay procedural and reassuring; escalate tow timing once.',
    ],
  },
  {
    id: 'climbing_gym_intro',
    label: 'Climbing gym — first visit',
    subtitle: 'Waiver, shoes, belay rules, autobelay.',
    situation:
      'First indoor climbing visit: waiver, shoe rental snugness humour, belay test policy honest if not certified, autobelay safety orientation.',
    defaultUserRole: 'New climber',
    defaultAiRole: 'Desk / setter',
    learnerExtras: [
      'Admit honestly if you cannot belay.',
      'Ask where beginner routes start.',
    ],
    aiExtras: [
      'Be friendly but strict on safety non-negotiables.',
    ],
    register: 'casual',
  },
  {
    id: 'cooking_workshop_station',
    label: 'Cooking class — bench talk',
    subtitle: 'Subs for allergies, knife safety, plating feedback.',
    situation:
      'Hands-on class: substitutions for allergens, chef demos knife grip briefly, plating feedback with humour, respect hierarchy in the kitchen.',
    defaultUserRole: 'Participant',
    defaultAiRole: 'Chef instructor',
    learnerExtras: [
      'Ask for a slower demo politely.',
      'Clarify cross-contamination aloud.',
    ],
    aiExtras: [
      'Praise specifics; correct unsafe moves firmly once.',
    ],
  },
  {
    id: 'karaoke_room_booking',
    label: 'Karaoke booth booking',
    subtitle: 'Room tier, corkage, time extensions.',
    situation:
      'Karaoke venue: booth size tiers, corkage fees, blackout happy-hour rules, extend time politely, neighbour noise etiquette.',
    defaultUserRole: 'Organiser',
    defaultAiRole: 'Front attendant',
    learnerExtras: [
      'Confirm tax-included price before deposit.',
      'Negotiate extension without arguing.',
    ],
    aiExtras: [
      'Explain house rules calmly when discounts fail.',
    ],
  },
  {
    id: 'pet_groom_salon',
    label: 'Pet grooming drop-off',
    subtitle: 'Matting, behaviour, sedation policy, pickup.',
    situation:
      'Grooming salon: anxious owner describes coat matting and behaviour quirks; sedation policy; realistic timeframe and price.',
    defaultUserRole: 'Pet owner',
    defaultAiRole: 'Groomer',
    learnerExtras: [
      'List triggers briefly (dryers, scissors near paws).',
      'Confirm pickup window and estimate.',
    ],
    aiExtras: [
      'Soothe calmly; defer to vet if skin issue spotted.',
    ],
    register: 'empathetic',
  },
  {
    id: 'phone_friend_catch_up',
    label: 'Phone — catch-up',
    subtitle: 'Overlap, reschedule, gist recap.',
    situation:
      'Voice call between friends: flaky connection, recap news, reschedule if busy, humour, avoid uncomfortable gossip politely.',
    defaultUserRole: 'Caller',
    defaultAiRole: 'Friend',
    learnerExtras: [
      'Echo their detail before changing topic.',
      'Exit gracefully when time runs out.',
    ],
    aiExtras: [
      'Share airtime naturally; recover from interruptions.',
    ],
    register: 'casual',
  },
  {
    id: 'disagree_politely_topic',
    label: 'Disagree politely',
    subtitle: 'Hedges, bridges, softer tone.',
    situation:
      'Low-stakes opinion chat (film ending, commute habit, caffeine): disagree with hedges and partial agreement; no insults.',
    defaultUserRole: 'Friend',
    defaultAiRole: 'Friend (other)',
    learnerExtras: [
      'Try “I see that, though I would add…”.',
      'Pause instead of interrupting.',
    ],
    aiExtras: [
      'Push back fairly without straw-man arguments.',
    ],
    register: 'neutral',
  },
] satisfies readonly LiveVoiceTopicPreset[];
