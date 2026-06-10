import { fetchChatCompletion, type ChatMsg } from './chatCompletion';
import type { ConversationTurn, HintLevel, MockScenario, RepairDecision, StoredSettings } from '../types';

const MAX_RECENT_TURNS = 18;
const MAX_REPAIR_HISTORY = 8;

const NO_REPAIR: RepairDecision = {
  shouldRepair: false,
  priority: 'none',
  reason: 'good_enough',
  interruptionRisk: 'high',
  original: '',
  repaired: '',
  explanationVi: '',
};

const REPAIR_AGENT_SYSTEM_PROMPT = [
  '# Role',
  'You are HintTalk Repair Gate Agent, a speaking coach inside a live English voice conversation.',
  '',
  '# Core decision',
  'You are NOT a grammar checker. Your main job is to decide whether interrupting the live conversation is worth it.',
  'Most user turns should NOT be repaired.',
  'Repair only when the corrected sentence is clearly useful, reusable, easy to repeat, and improves spoken communication.',
  '',
  '# Do NOT repair',
  '- Short valid replies such as yes, okay, sure, thank you, sounds good, no problem.',
  '- Minor imperfections that do not hurt communication.',
  '- Lines where transcript quality is uncertain.',
  '- Lines that are already natural enough for the learner level.',
  '- Over-polishing or making the learner sound too formal/stiff.',
  '',
  '# Repair when worthwhile',
  '- The learner line is hard to understand.',
  '- Clear grammar blocks natural speech.',
  '- The phrase is direct translation / Vietnamese English.',
  '- The situation needs a more polite or natural spoken formula.',
  '- The repaired sentence is a reusable pattern for this scene.',
  '',
  '# Level behavior',
  '- intermediate: produce one natural, easy-to-repeat sentence. A short Vietnamese explanation is useful.',
  '- advanced: produce a concise, native-like spoken sentence. Explain only the useful pattern, briefly.',
  '',
  '# Output',
  'Return exactly one JSON object. No markdown. No text before or after JSON.',
  'Required shape:',
  '{"shouldRepair":false,"priority":"none","reason":"good_enough","interruptionRisk":"high","original":"","repaired":"","explanationVi":""}',
  '',
  'Allowed priority: none, low, medium, high.',
  'Allowed reason: good_enough, too_short, unclear_transcript, minor_issue, grammar, naturalness, politeness, reusable_pattern.',
  'Allowed interruptionRisk: low, medium, high.',
  'If shouldRepair is false, priority should be none or low and repaired/explanationVi should be empty.',
  'If shouldRepair is true, priority must be medium or high, interruptionRisk must not be high, and repaired must be one short spoken English sentence.',
].join('\n');

function parseJsonPayload(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?|```$/g, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (err2: unknown) {
        const err2Msg = err2 instanceof Error ? err2.message : String(err2);
        throw new Error(`Invalid JSON: ${err2Msg}. Output was: "${trimmed.slice(0, 300)}"`, { cause: err2 });
      }
    }
    throw new Error(`Response is not JSON: ${errMsg}. Output was: "${trimmed.slice(0, 300)}"`, { cause: err });
  }
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeRepairDecision(raw: unknown, latestUserLine: string): RepairDecision {
  const o = raw as Record<string, unknown>;
  const shouldRepair = o.shouldRepair === true;
  const priority = enumValue(o.priority, ['none', 'low', 'medium', 'high'] as const, shouldRepair ? 'medium' : 'none');
  const reason = enumValue(
    o.reason,
    [
      'good_enough',
      'too_short',
      'unclear_transcript',
      'minor_issue',
      'grammar',
      'naturalness',
      'politeness',
      'reusable_pattern',
    ] as const,
    shouldRepair ? 'naturalness' : 'good_enough',
  );
  const interruptionRisk = enumValue(o.interruptionRisk, ['low', 'medium', 'high'] as const, shouldRepair ? 'medium' : 'high');
  const original = typeof o.original === 'string' && o.original.trim() ? o.original.trim() : latestUserLine.trim();
  const repaired = typeof o.repaired === 'string' ? o.repaired.trim() : '';
  const explanationVi = typeof o.explanationVi === 'string' ? o.explanationVi.trim() : '';

  if (!shouldRepair || !repaired) {
    return {
      ...NO_REPAIR,
      priority: priority === 'high' || priority === 'medium' ? 'low' : priority,
      reason,
      original: '',
    };
  }

  return {
    shouldRepair: true,
    priority,
    reason,
    interruptionRisk,
    original,
    repaired,
    explanationVi,
  };
}

export function shouldShowRepairDecision(decision: RepairDecision, level: HintLevel, latestUserLine: string): boolean {
  if (level === 'beginner') return false;
  if (!decision.shouldRepair) return false;
  if (decision.priority === 'none' || decision.priority === 'low') return false;
  if (decision.interruptionRisk === 'high') return false;
  if (!decision.repaired.trim()) return false;
  if (latestUserLine.trim().split(/\s+/).filter(Boolean).length < 4) return false;
  return true;
}

export async function evaluateRepairOpportunity(
  settings: StoredSettings,
  scenario: MockScenario,
  level: HintLevel,
  turns: ConversationTurn[],
  latestAssistantLine: string,
  latestUserLine: string,
  recentRepairDecisions: RepairDecision[],
  signal?: AbortSignal,
): Promise<RepairDecision> {
  if (level === 'beginner') return NO_REPAIR;

  const cleanUserLine = latestUserLine.trim();
  if (!cleanUserLine) return NO_REPAIR;

  const payload = {
    level,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      aiRole: scenario.aiRole,
      userRole: scenario.userRole,
      goal: scenario.goal,
      situationCard: scenario.prompt,
    },
    latestAssistantLine: latestAssistantLine.trim() || null,
    latestUserLine: cleanUserLine,
    recentTurns: turns.slice(-MAX_RECENT_TURNS).map((t, i) => ({
      turn: i + 1,
      speaker: t.speaker,
      role: t.role,
      text: t.text,
    })),
    recentRepairDecisions: recentRepairDecisions.slice(-MAX_REPAIR_HISTORY).map((d) => ({
      original: d.original,
      repaired: d.repaired,
      shouldRepair: d.shouldRepair,
    })),
    decisionCriteria: {
      repairMustBeWorthInterruptingLiveConversation: true,
      mostTurnsShouldNotBeRepaired: true,
      repairOnlyIntermediateAndAdvanced: true,
      oneShortRepeatableSentence: true,
    },
  };

  const messages: ChatMsg[] = [
    { role: 'system', content: REPAIR_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        'Evaluate this live voice learner turn. Return the required JSON object only.',
        JSON.stringify(payload),
      ].join('\n'),
    },
  ];

  const text = await fetchChatCompletion(settings, messages, 0.15, { max_tokens: 650, jsonMode: true, signal });
  return normalizeRepairDecision(parseJsonPayload(text), cleanUserLine);
}
