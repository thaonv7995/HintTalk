import type { LiveVoiceSetup, MockScenario } from '../types';
import {
  buildLiveVoiceSituationScript,
  getLiveVoiceTopicPreset,
  topicTextFromPresetId,
} from '../data/liveVoiceTopicPresets';
import { liveVoiceAssistantSpeakingLine, liveVoiceUserSpeakingLine } from '../data/liveVoiceTopics/roleSpeakingLines';

export const FREE_VOICE_SCENARIO_ID = 'free_voice';

function buildFallbackSituationScript(topic: string, aiRole: string, userRole: string): string {
  const topicTrim = topic.trim();
  const scene = topicTrim
    ? topicTrim
    : 'Pick a topic together after you start — travel, work, small talk, an interview, daily life, etc.';

  return [`Scene`, scene, '', liveVoiceUserSpeakingLine(userRole), '', liveVoiceAssistantSpeakingLine(aiRole)].join('\n');
}

/** Builds an effective scenario for Realtime + hints from saved setup + template row. */
export function buildScenarioFromLiveSetup(setup: LiveVoiceSetup, template: MockScenario): MockScenario {
  const preset = getLiveVoiceTopicPreset(setup.topicPresetId);
  const topic = topicTextFromPresetId(setup.topicPresetId).trim();
  const aiRole = setup.aiRole.trim() || template.aiRole;
  const userRole = setup.userRole.trim() || template.userRole;

  const topicLine = topic || 'Any topic — decide together in English.';
  const shortTitle = topicLine.length > 72 ? `${topicLine.slice(0, 69)}…` : topicLine;

  const situationScript = preset
    ? buildLiveVoiceSituationScript(preset, { userRole, aiRole })
    : buildFallbackSituationScript(topic, aiRole, userRole);

  const uiTitle = preset?.label ?? (topic ? shortTitle : 'Conversation');

  return {
    ...template,
    title: uiTitle,
    aiRole,
    userRole,
    goal: `Speak in English in a natural back-and-forth (not one rigid Q&A line each turn). ${topic ? `Scene: ${topic}. ` : ''}Roles: AI “${aiRole}”, learner “${userRole}”. Stay in character; react and build on what they say; adapt if they change topic or ask for a new role-play.`,
    prompt: situationScript,
  };
}
