import type { MockScenario } from '../types';

/** Short line for header chip — uses scenario.category (Cafe, Interview, TOEIC Speaking, …). */
export function liveVoiceTrackLabel(scenario: MockScenario): string {
  return scenario.category;
}

/** Primary header title: conversation = scenario title only; TOEIC = title + optional question range. */
export function liveVoiceHeaderTitle(scenario: MockScenario): string {
  if (scenario.practiceType === 'conversation') {
    return scenario.title;
  }
  return scenario.questionRange ? `${scenario.title} · ${scenario.questionRange}` : scenario.title;
}

/** Secondary chip: live mode + track/category + level. */
export function liveVoiceHeaderSub(level: string, scenario: MockScenario): string {
  return `Live voice · ${liveVoiceTrackLabel(scenario)} · ${level}`;
}

/** Title row next to “AI script” — free voice uses short preset label only (no category prefix). */
export function liveVoiceScriptTitleLine(scenario: MockScenario): string {
  if (scenario.id === 'free_voice') {
    return scenario.title;
  }
  if (scenario.practiceType === 'conversation') {
    return `${scenario.category} · ${scenario.title}`;
  }
  return liveVoiceHeaderTitle(scenario);
}
