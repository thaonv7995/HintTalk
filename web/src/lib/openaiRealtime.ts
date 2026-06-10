import type { HintLevel, LiveVoiceSpeaksFirst, MockScenario } from '../types';
import { openAiRealtimeCallsUrl } from './endpoints';



export function buildRealtimeSessionJson(model: string): string {
  return JSON.stringify({
    type: 'realtime',
    model,
  });
}

export function buildRealtimeSessionConfig(
  scenario: MockScenario,
  level: HintLevel,
  voice: string,
  speaksFirst: LiveVoiceSpeaksFirst = 'ai',
  casualCompanionMode: boolean = false,
) {
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

  const casualRules = casualCompanionMode
    ? [
        '',
        'CRITICAL RULE — IMPLICIT RECASTING (No Explicit Corrections):',
        '- If the learner makes grammatical or vocabulary errors, do NOT point them out, correct them explicitly, or lecture them.',
        '- Instead, naturally reformulate the incorrect phrase in your next reply (e.g., if they say "Yesterday I go to...", reply with "Oh, you went to...?").',
        '- Help them acquire correct structures implicitly through your own natural replies.',
        '',
        'CRITICAL RULE — VIETNAMESE CODE-SWITCHING:',
        '- The learner may mix English and Vietnamese when they forget a word (e.g., "It is very kịch tính").',
        '- You must understand the Vietnamese words, translate them, and naturally include the correct English terms in your next response (e.g., "Yes, it is indeed very dramatic!").',
        '- Never comment on their mixed-language speech; just keep the conversation going smoothly.',
        '',
        'TONE & FLOW:',
        '- Maintain a very warm, friendly, casual, and completely non-evaluative tone.',
        '- Avoid sounding like an examiner or a strict teacher. Make them feel safe and comfortable.',
      ]
    : [];

  return {
    type: 'realtime',
    modalities: ['text', 'audio'],
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
      ...casualRules,
      ...openingRules,
    ]
      .filter(Boolean)
      .join('\n'),
    voice,
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 400,
      silence_duration_ms: 1200,
    },
    input_audio_transcription: {
      model: 'whisper-1',
    },
  };
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
