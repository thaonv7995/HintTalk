import type { LiveVoiceRegisterTone, LiveVoiceTopicPreset } from './types';
import { getLiveVoiceTopicCategoryForPreset } from './categories';
import { presetPrimarySceneText } from './accessors';
import { liveVoiceAssistantSpeakingLine, liveVoiceUserSpeakingLine } from './roleSpeakingLines';

const REGISTER_NOTE: Record<LiveVoiceRegisterTone, string> = {
  free: 'flexible tone — mirror the learner after they pick direction',
  casual: 'relaxed contractions friendly small talk pacing',
  neutral: 'clear everyday polite English understandable in service encounters',
  formal: 'courteous complete sentences respectful address',
  clinical: 'calm healthcare English empathy without exceeding professional scope',
  empathetic: 'warm validating language while solving the issue constructively',
};

function scenePlaceholderFallback(openPreset: boolean): string {
  if (openPreset) {
    return 'Pick or invent a cooperative scene after you tap Start.';
  }
  return 'Describe the specifics together verbally while staying in-character.';
}

/** Paragraph shown above the orb — Scene only; full scripted instructions remain in `scenario.prompt` for realtime/hints. */
export function liveVoiceUiScenePreview(preset: LiveVoiceTopicPreset | undefined): string {
  const open = preset?.id === 'open';
  const scene = presetPrimarySceneText(preset);
  const paragraph =
    open && !scene
      ? 'Once you start speaking, jointly pick concrete roles and a backdrop (café queue, taxi line, coworking tour, airport desk, …). Invent details verbally as you talk.'
      : scene || scenePlaceholderFallback(open);
  return `Scene\n${paragraph}`;
}

export function buildLiveVoiceSituationScript(
  preset: LiveVoiceTopicPreset | undefined,
  roles: { userRole: string; aiRole: string },
): string {
  const scene = presetPrimarySceneText(preset);
  const open = preset?.id === 'open';
  const category = preset ? getLiveVoiceTopicCategoryForPreset(preset.id) : undefined;

  const lines: string[] = [];
  lines.push('Scene');
  lines.push(
    open && !scene
      ? 'Once you start speaking, jointly pick concrete roles and a backdrop (café queue, taxi line, coworking tour, airport desk, …). Invent details verbally as you talk.'
      : scene || scenePlaceholderFallback(open),
  );
  lines.push('');
  lines.push(liveVoiceUserSpeakingLine(roles.userRole));
  lines.push('');
  lines.push(liveVoiceAssistantSpeakingLine(roles.aiRole));

  if (!open && category && preset) {
    const registerTone = preset.register ?? category.registerDefault ?? 'neutral';
    lines.push('');
    lines.push(`Register (${registerTone})`);
    lines.push(REGISTER_NOTE[registerTone]);

    lines.push('');
    lines.push('Learner guide — practice aims');
    for (const bullet of [...category.learnerGuide, ...(preset.learnerExtras ?? [])]) {
      lines.push(`• ${bullet}`);
    }

    lines.push('');
    lines.push('AI guide — embody the role realistically');
    for (const bullet of [...category.aiGuide, ...(preset.aiExtras ?? [])]) {
      lines.push(`• ${bullet}`);
    }

    lines.push('');
    lines.push('Preset label');
    lines.push(preset.label);
  }

  return lines.join('\n');
}
