import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_HEALTH = [
  {
    id: 'clinic',
    label: 'Clinic — describe symptoms',
    situation:
      'Primary care: explain onset duration pain scale allergies meds pregnancy relevant briefly answer clarifying questions agree plan referral labs follow-up empathetic professional tone.',
    defaultUserRole: 'Patient',
    defaultAiRole: 'Clinician',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy — OTC & pickup',
    situation:
      'Drugstore: ask pharmacist cough allergy mild pain children dosing interactions generic vs brand prescription pickup insurance copay pronunciation spelling.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Pharmacist',
  },
  {
    id: 'dentist',
    label: 'Dental — check-up chair-side',
    situation:
      'Routine cleaning anxiety mild floss lecture consent X-ray schedule next appointment billing insurance estimate sensitivity.',
    defaultUserRole: 'Patient',
    defaultAiRole: 'Dentist',
  },
  {
    id: 'vet',
    label: 'Vet — pet visit',
    situation:
      'Dog/cat symptoms eating vomiting vaccines travel certificate groom referral cost estimate emotional owner realistic.',
    defaultUserRole: 'Pet owner',
    defaultAiRole: 'Veterinarian',
  },
] satisfies readonly LiveVoiceTopicPreset[];
