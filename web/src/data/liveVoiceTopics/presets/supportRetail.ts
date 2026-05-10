import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_SUPPORT_RETAIL = [
  {
    id: 'support_call',
    label: 'Support hotline',
    situation:
      'Billing dispute outage refund loyalty retention scripted empathy escalation ticket number patience spelling email recap threaten cancel politely.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Support agent',
  },
  {
    id: 'telco_store',
    label: 'Phone shop — plan & handset',
    situation:
      'Upgrade contract roaming family plan trade-in cracked screen insurance installment compare cameras realistic upsell resist politely.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Retail associate',
  },
] satisfies readonly LiveVoiceTopicPreset[];
