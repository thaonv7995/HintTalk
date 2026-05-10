import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_WORK_STUDY = [
  {
    id: 'interview',
    label: 'Job interview',
    situation:
      'Structured hiring conversation walk through CV gaps behavioural STAR salary expectation remote hybrid notice period questions for them closing handshake tone.',
    defaultUserRole: 'Candidate',
    defaultAiRole: 'Interviewer',
  },
  {
    id: 'meeting',
    label: 'Work — stand-up & blocker',
    situation:
      'Daily sync slipped timeline dependency escalate stakeholder polite push alternatives recap action items realistic jargon moderate pace.',
    defaultUserRole: 'Team member',
    defaultAiRole: 'Team lead',
  },
  {
    id: 'performance_chat',
    label: 'Work — review / feedback',
    situation:
      'Mid-year chat strengths growth areas metrics promotion timeline training request emotional intelligence manager listens employee pushes back lightly agrees SMART goals.',
    defaultUserRole: 'Employee',
    defaultAiRole: 'Manager',
  },
  {
    id: 'networking',
    label: 'Networking event mingle',
    situation:
      'Conference mixer elevator pitch swap LinkedIns industry trend ask thoughtful question exit conversation gracefully follow-up coffee vague job hunt subtle.',
    defaultUserRole: 'Attendee',
    defaultAiRole: 'Other attendee',
  },
  {
    id: 'office_hours',
    label: 'Uni — professor office hours',
    situation:
      'Essay thesis extension grading rubric clarification citation confusion respectful persuasive realistic academic boundaries.',
    defaultUserRole: 'Student',
    defaultAiRole: 'Professor',
  },
] satisfies readonly LiveVoiceTopicPreset[];
