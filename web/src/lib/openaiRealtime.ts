import type { HintLevel, LiveVoiceSpeaksFirst, MockScenario } from '../types';
import { openAiRealtimeCallsUrl } from './endpoints';

/** Server VAD: longer silence before “end of turn” so the model does not reply mid‑pause while the learner is still speaking. */
const REALTIME_SERVER_VAD = {
  type: 'server_vad' as const,
  prefix_padding_ms: 400,
  /** API default is 500ms — too aggressive for natural pauses between clauses. */
  silence_duration_ms: 1200,
  threshold: 0.5,
};

export function buildRealtimeSessionJson(
  scenario: MockScenario,
  level: HintLevel,
  model: string,
  voice: string,
  speaksFirst: LiveVoiceSpeaksFirst = 'ai',
): string {
  const openingRules =
    speaksFirst === 'user'
      ? [
          'OPENING ORDER — LEARNER FIRST (mandatory for this session): The learner speaks before you.',
          'Until the learner has finished their first spoken turn, produce NO assistant audio and NO spoken reply.',
          'After they speak first, respond like a real person in your role — acknowledge what they said, react, then continue naturally (not a single clipped sentence every time).',
          'If they seem stuck while muted, do not interrupt — they may still be preparing.',
        ]
      : [
          'OPENING ORDER — ASSISTANT FIRST (mandatory for this session): You speak before the learner.',
          'Open with a warm, natural welcome in character — one or two short sentences is fine if it feels human.',
          'Draw them into the scene without sounding like an exam question.',
        ];

  return JSON.stringify({
    type: 'realtime',
    model,
    instructions: [
      'You are HintTalk live roleplay partner.',
      'Speak English only.',
      '',
      'CONVERSATION STYLE (critical):',
      '- Sound like a real spoken chat, not a phrase-drill or interrogation.',
      '- Vary turn length: often 2–4 short sentences; sometimes one fuller thought when it fits; avoid robot ping-pong (question → one-word answer → next question).',
      '- React to what they actually said — agree, empathize, pick up a detail — before you move the scene forward.',
      '- Mix statements, brief reactions, and questions; do NOT end every single turn with only a question.',
      '- Use natural spoken English (contractions, fillers like “well”, “sure”, “oh” when appropriate to your role).',
      '- Stay concise enough for voice: avoid long monologues or lectures.',
      '',
      'Learners often pause mid‑sentence to think — treat short silences as part of the same turn; do not rush to fill every gap.',
      '',
      'Do not grade or correct the learner unless they explicitly ask for feedback.',
      '',
      `Scenario: ${scenario.title}`,
      `Your role: ${scenario.aiRole}`,
      `Learner role: ${scenario.userRole}`,
      `Goal: ${scenario.goal}`,
      `Learner hint level: ${level}`,
      scenario.prompt ? `Situation script (both of you are acting this):\n${scenario.prompt}` : '',
      '',
      'The learner may choose any topic or imaginary situation.',
      'Stay in your assigned role; if they switch topic or ask for a new role-play, adapt naturally.',
      ...openingRules,
    ]
      .filter(Boolean)
      .join('\n'),
    audio: {
      input: {
        transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en',
        },
        turn_detection: REALTIME_SERVER_VAD,
      },
      output: { voice },
    },
  });
}

export async function exchangeRealtimeSdp(
  apiKey: string,
  offerSdp: string,
  sessionJson: string,
): Promise<{ ok: boolean; answerSdp?: string; errorText?: string }> {
  const fd = new FormData();
  fd.set('sdp', offerSdp);
  fd.set('session', sessionJson);

  const res = await fetch(openAiRealtimeCallsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: fd,
  });

  const text = await res.text();
  if (!res.ok) return { ok: false, errorText: text.slice(0, 800) };
  return { ok: true, answerSdp: text };
}
