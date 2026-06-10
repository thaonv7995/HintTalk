import type { ShadowingGenre, ShadowingLesson, StoredSettings } from '../types';
import { ttsVoiceModelPromptOptions } from '../data/ttsVoiceModels';
import { fetchChatCompletion, type ChatMsg } from './chatCompletion';
import { parseJsonPayload } from './jsonPayload';

export type ShadowingPromptPlan = {
  title: string;
  level: ShadowingLesson['level'];
  genre: ShadowingGenre;
  voiceHint: string;
  ttsVoice?: string;
  ttsModel?: string;
  promptInstruction: string;
  targetWpm: number;
};

const SHADOWING_LESSON_PROMPT = [
  'You generate short English shadowing passages for intermediate and advanced learners.',
  'Return exactly one JSON object. No markdown.',
  'The passage must sound like something a real person would hear: announcement, weather, radio, meeting update, service message, or podcast/radio segment.',
  'The line count is not fixed; follow the requested length mode and line range from the user message.',
  'Each line should be one natural spoken sentence, 5-18 words.',
  'Avoid copyrighted text, brand names, and uncommon proper nouns.',
  'Also choose exactly one ttsModel id from the provided ttsModelOptions that best matches the passage style and accent.',
  'Do not invent ttsModel values. The ttsModel must exactly match one provided id.',
  'Also create a promptInstruction field that describes how a TTS reader should read the generated passage.',
  'The promptInstruction must mention natural pacing, a 3 second rest between lines, and no extra commentary.',
  'Required JSON shape:',
  '{"title":"...","level":"intermediate","genre":"announcement","voiceHint":"...","ttsModel":"edge-tts/en-GB-ThomasNeural","promptInstruction":"...","targetWpm":145,"lines":[{"text":"...","focusPhrase":"..."}]}',
  'Allowed level: intermediate, advanced.',
  'Allowed genre: announcement, radio, weather, meeting, service, podcast.',
  'focusPhrase must be a short exact phrase from the same line.',
].join('\n');

function cleanGenre(value: unknown): ShadowingGenre {
  const allowed: ShadowingGenre[] = ['announcement', 'radio', 'weather', 'meeting', 'service', 'podcast'];
  return typeof value === 'string' && allowed.includes(value as ShadowingGenre) ? (value as ShadowingGenre) : 'announcement';
}

function normalizeLessonLines(rawLines: unknown[], maxLines: number): ShadowingLesson['lines'] {
  return rawLines
    .map((item, index) => {
      const line = item as Record<string, unknown>;
      const text = typeof line.text === 'string' ? line.text.trim() : typeof item === 'string' ? item.trim() : '';
      if (!text) return null;
      const focusPhrase = typeof line.focusPhrase === 'string' ? line.focusPhrase.trim() : '';
      return {
        id: `ai-${Date.now()}-${index}`,
        text,
        focusPhrase: focusPhrase && text.toLowerCase().includes(focusPhrase.toLowerCase()) ? focusPhrase : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, maxLines) as ShadowingLesson['lines'];
}

export async function generateShadowingLesson(
  settings: StoredSettings,
  seed: {
    genre: ShadowingGenre;
    level: ShadowingLesson['level'];
    topicHint?: string;
    topicDescription?: string;
    lengthMode?: 'brief' | 'standard' | 'full';
    gapSeconds?: number;
    continuous?: boolean;
  },
): Promise<ShadowingLesson> {
  const effectiveSettings = {
    ...settings,
    hintApiKey: settings.hintApiKey.trim() || settings.realtimeApiKey.trim(),
  };
  if (!effectiveSettings.hintApiKey.trim()) throw new Error('Add an OpenAI key before generating a shadowing lesson.');

  const messages: ChatMsg[] = [
    {
      role: 'system',
      content: [
        SHADOWING_LESSON_PROMPT,
        'Decide the exact number of lines based on the content and length mode.',
        'brief: 4-6 lines. standard: 7-10 lines. full: 11-16 lines.',
        'Each line should be one natural spoken sentence, 5-18 words.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        genre: seed.genre,
        level: seed.level,
        topicHint: seed.topicHint || 'daily public announcement for travel, work, or news',
        topicDescription: seed.topicDescription || null,
        lengthMode: seed.lengthMode ?? 'standard',
        ttsModelOptions: ttsVoiceModelPromptOptions(),
        readingContract: {
          pauseBetweenLinesSeconds: seed.gapSeconds ?? 3,
          continuousReading: Boolean(seed.continuous),
          aiDecidesLineCount: true,
          noExtraCommentary: true,
          learnerWillShadowWhileAudioPlays: true,
        },
      }),
    },
  ];

  const lineRange = seed.lengthMode === 'brief' ? { min: 4, max: 6 } : seed.lengthMode === 'full' ? { min: 11, max: 16 } : { min: 7, max: 10 };
  let rawText = await fetchChatCompletion(effectiveSettings, messages, 0.7, { max_tokens: Math.max(900, lineRange.max * 140), jsonMode: true });
  let raw = parseJsonPayload(rawText) as Record<string, unknown>;
  let rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  let lines = normalizeLessonLines(rawLines, lineRange.max);

  if (lines.length < lineRange.min || lines.length > lineRange.max) {
    const retryMessages: ChatMsg[] = [
      ...messages,
      {
        role: 'assistant',
        content: rawText,
      },
      {
        role: 'user',
        content: `Regenerate the JSON with ${lineRange.min}-${lineRange.max} lines exactly for lengthMode=${seed.lengthMode ?? 'standard'}. Keep the same JSON shape and choose one provided ttsModel id.`,
      },
    ];
    rawText = await fetchChatCompletion(effectiveSettings, retryMessages, 0.55, { max_tokens: Math.max(900, lineRange.max * 140), jsonMode: true });
    raw = parseJsonPayload(rawText) as Record<string, unknown>;
    rawLines = Array.isArray(raw.lines) ? raw.lines : [];
    lines = normalizeLessonLines(rawLines, lineRange.max);
  }

  if (lines.length < lineRange.min || lines.length > lineRange.max) {
    throw new Error(`AI returned ${lines.length || 'no'} usable shadowing lines; expected ${lineRange.min}-${lineRange.max}.`);
  }

  const promptInstruction =
    typeof raw.promptInstruction === 'string' && raw.promptInstruction.trim()
      ? raw.promptInstruction.trim()
      : [
          'Read these shadowing lines with natural pacing.',
          seed.continuous ? 'Read as one continuous passage with no artificial pauses.' : `Pause ${seed.gapSeconds ?? 3} seconds between lines so the learner can breathe.`,
          'Do not add greetings, numbering, explanations, or extra commentary.',
        ]
          .filter(Boolean)
          .join('\n');

  return {
    id: `ai-${Date.now()}`,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'AI shadowing passage',
    level: raw.level === 'advanced' ? 'advanced' : seed.level,
    genre: cleanGenre(raw.genre ?? seed.genre),
    voiceHint: typeof raw.voiceHint === 'string' && raw.voiceHint.trim() ? raw.voiceHint.trim() : 'Model voice',
    ttsModel: typeof raw.ttsModel === 'string' && raw.ttsModel.trim() ? raw.ttsModel.trim() : undefined,
    ttsVoice: typeof raw.ttsVoice === 'string' && raw.ttsVoice.trim() ? raw.ttsVoice.trim() : undefined,
    promptInstruction,
    targetWpm: typeof raw.targetWpm === 'number' ? Math.min(175, Math.max(125, Math.round(raw.targetWpm))) : 145,
    lines,
  };
}

export async function generateShadowingPromptInstruction(
  settings: StoredSettings,
  seed: { genre: ShadowingGenre; level: ShadowingLesson['level']; topicHint?: string; topicDescription?: string },
): Promise<ShadowingPromptPlan> {
  const lesson = await generateShadowingLesson(settings, seed);
  return {
    title: lesson.title,
    level: lesson.level,
    genre: lesson.genre,
    voiceHint: lesson.voiceHint,
    ttsModel: lesson.ttsModel,
    ttsVoice: lesson.ttsVoice,
    promptInstruction: lesson.promptInstruction || '',
    targetWpm: lesson.targetWpm,
  };
}
