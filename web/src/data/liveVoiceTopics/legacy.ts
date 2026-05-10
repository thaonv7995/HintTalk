import { LIVE_VOICE_TOPIC_PRESETS } from './combinePresets';

/** Older app builds stored English blurbs; map fragments so saved presets still resolve. */
const LEGACY_TOPIC_FRAGMENTS: readonly { fragment: string; id: string }[] = [
  { fragment: 'Ordering drinks and maybe food at a café', id: 'cafe' },
  { fragment: 'At a sit-down restaurant', id: 'restaurant' },
  { fragment: 'At an airport', id: 'airport' },
  { fragment: 'Hotel front desk', id: 'hotel' },
  { fragment: 'A job interview', id: 'interview' },
  { fragment: 'A short work meeting', id: 'meeting' },
  { fragment: 'Light casual conversation', id: 'small_talk' },
  { fragment: 'At a clinic', id: 'clinic' },
  { fragment: 'In a retail store', id: 'shopping' },
  { fragment: 'In a city or building', id: 'directions' },
  { fragment: 'Calling customer support', id: 'support_call' },
];

/** Map legacy saved `topic` string to a preset id when possible. */
export function legacyTopicStringToPresetId(topicBlob: string): string {
  const t = topicBlob.trim();
  if (!t) return 'open';
  const exact = LIVE_VOICE_TOPIC_PRESETS.find((p) => p.situation.trim() === t);
  if (exact) return exact.id;
  for (const { fragment, id } of LEGACY_TOPIC_FRAGMENTS) {
    if (t.includes(fragment)) return id;
  }
  return 'open';
}
