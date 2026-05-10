import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_TRAVEL_TRANSPORT = [
  {
    id: 'airport',
    label: 'Airport — check-in & gate',
    situation:
      'International airport: check-in kiosk issues, baggage allowance overweight fees, security-friendly questions, lounge access, boarding gate changes, asking staff where to find ATM or pharmacy airside. One traveller is slightly stressed — keep dialogue realistic.',
    defaultUserRole: 'Traveler',
    defaultAiRole: 'Airline staff',
  },
  {
    id: 'flight_delay',
    label: 'Airport — delay & rebooking',
    situation:
      'Flight cancelled or heavily delayed: speak at airline desk for rebooking, hotel voucher, meal voucher, next connection concern. Ask about luggage rerouting and ETA; push politely if answers are vague.',
    defaultUserRole: 'Passenger',
    defaultAiRole: 'Airline agent',
  },
  {
    id: 'hotel',
    label: 'Hotel — front desk',
    situation:
      'Hotel arrival or mid-stay: check-in ID/credit card hold, room type vs booking, floor preference, Wi‑Fi password, breakfast hours, gym/pool, nearby safe walks. Later: noisy neighbours AC broken late checkout — realistic problem-solving tone.',
    defaultUserRole: 'Guest',
    defaultAiRole: 'Front desk clerk',
  },
  {
    id: 'hotel_complaint',
    label: 'Hotel — room issue escalation',
    situation:
      'Night noise construction smell dirty bathroom AC broken safe won’t open. Call front desk or speak downstairs ask compensation room move engineer timeframe stay polite factual.',
    defaultUserRole: 'Guest',
    defaultAiRole: 'Duty manager',
  },
  {
    id: 'train_station',
    label: 'Train — tickets & platform',
    situation:
      'Busy station: ticket machine won’t read card ask staffed counter routes transfers seat reservation bicycle carriage rush hour platform change announcements unclear.',
    defaultUserRole: 'Traveler',
    defaultAiRole: 'Station staff',
  },
  {
    id: 'taxi_rideshare',
    label: 'Taxi / ride-hail',
    situation:
      'Catch ride airport hotel confirm destination route toll preference luggage trunk chat lightly about traffic weather tip culture drop-off exact entrance.',
    defaultUserRole: 'Rider',
    defaultAiRole: 'Driver',
  },
  {
    id: 'car_rental',
    label: 'Car rental counter',
    situation:
      'Pickup rental: insurance damage waiver fuel policy mileage deposit young-driver fee GPS child seat upgrade dispute scratch on sheet extend rental drop-off different city.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Rental agent',
  },
] satisfies readonly LiveVoiceTopicPreset[];
