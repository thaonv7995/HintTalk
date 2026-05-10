import type { LiveVoiceTopicPreset } from './types';
import { TOPIC_PRESETS_GENERAL } from './presets/general';
import { TOPIC_PRESETS_FOOD_HOSPITALITY } from './presets/foodHospitality';
import { TOPIC_PRESETS_TRAVEL_TRANSPORT } from './presets/travelTransport';
import { TOPIC_PRESETS_ERRANDS_SERVICES } from './presets/errandsServices';
import { TOPIC_PRESETS_HEALTH } from './presets/health';
import { TOPIC_PRESETS_HOME_NEIGHBOURS } from './presets/homeNeighbours';
import { TOPIC_PRESETS_WORK_STUDY } from './presets/workStudy';
import { TOPIC_PRESETS_SUPPORT_RETAIL } from './presets/supportRetail';
import { TOPIC_PRESETS_LEISURE } from './presets/leisure';
import { TOPIC_PRESETS_SOCIAL } from './presets/social';
import { TOPIC_PRESETS_EXTENDED } from './presets/extended';

/** Full ordered list consumed by IDs, storage, hints, realtime builders. */
export const LIVE_VOICE_TOPIC_PRESETS: readonly LiveVoiceTopicPreset[] = [
  ...TOPIC_PRESETS_GENERAL,
  ...TOPIC_PRESETS_FOOD_HOSPITALITY,
  ...TOPIC_PRESETS_TRAVEL_TRANSPORT,
  ...TOPIC_PRESETS_ERRANDS_SERVICES,
  ...TOPIC_PRESETS_HEALTH,
  ...TOPIC_PRESETS_HOME_NEIGHBOURS,
  ...TOPIC_PRESETS_WORK_STUDY,
  ...TOPIC_PRESETS_SUPPORT_RETAIL,
  ...TOPIC_PRESETS_LEISURE,
  ...TOPIC_PRESETS_SOCIAL,
  ...TOPIC_PRESETS_EXTENDED,
];
