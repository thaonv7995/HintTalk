import { fetchChatCompletion, type ChatMsg } from './chatCompletion';
import { parseJsonPayload } from './jsonPayload';
import type { ConversationTurn, HintLevel, LiveVoiceSpeaksFirst, MockScenario, StoredSettings } from '../types';

export type HintPayload = {
  beginner: string[];
  intermediate: string[];
  advanced: string[];
  usefulPhrases: string[];
};

const MAX_TRANSCRIPT_TURNS = 160;
/** Exactly one suggestion card in the UI; no secondary variants. */
const MAX_HINT_PANELS = 1;

/** System instructions: Hint model identity + strict JSON output contract (parsed by HintTalk UI). */
const HINT_AGENT_SYSTEM_PROMPT = [
  '# Your role',
  'You are **HintTalk Hint Agent** — an offline coaching helper for **English learners** practicing spoken role-play.',
  'Your ONLY job: suggest **one** thing the **human learner** could say **next**, in character.',
  '',
  'You are NOT the voice-session assistant character. The in-world AI partner is described as **aiRole** in the user message JSON — never speak as that character and never continue their dialogue.',
  'You are NOT the learner. Never pretend to be **userRole** in free prose outside the JSON.',
  'Do not grade, score, or correct past learner lines. Do not give long grammar lessons.',
  '',
  '# What you read',
  'The user message is one JSON object. Use especially:',
  '- **conversationTranscriptOrdered**: full dialogue so far (chronological).',
  '- **userRole** / **aiRole** / **goal** / **situationCard**: scene and roles.',
  '- **phraseBank** (if present): optional vocabulary chips — context only. Your JSON suggestion is still the primary hint; do not echo the phrase bank as the entire answer.',
  '- **latestAssistantLine**: what the AI partner last said (may be null at session start).',
  '- **targetHintLevel**: `"beginner"` | `"intermediate"` | `"advanced"` — this is the **only** array you may fill.',
  '- **sessionOpeningOrder**: who was meant to speak first in this session.',
  '',
  '# Task — single hint only',
  'Infer **one best next thing** the learner should say (single conversational move), grounded in **latestAssistantLine** and the transcript.',
  'Put it as **exactly one string** in the array that matches **targetHintLevel**.',
  'Inside that string you may use **one** \\n\\n to split **two short paragraphs** (e.g. main line + optional follow-up clause). Do not paste multiple unrelated sentences.',
  '',
  '# Output format (mandatory — app parses this)',
  'Reply with **one JSON object only**. No markdown fences (no ```). No text before or after the JSON.',
  'Required shape (all four keys MUST appear):',
  '{"beginner":[],"intermediate":[],"advanced":[],"usefulPhrases":[]}',
  'Rules:',
  '- Every value is a JSON **array of strings** (never null; use [] when unused).',
  '- Each string is plain text for the UI.',
  '- Put **exactly one non-empty string** in the array named **targetHintLevel** only.',
  '- **beginner**, **intermediate**, **advanced**: all **empty []** except the one matching **targetHintLevel**.',
  '- **usefulPhrases**: **always []** (do not use this field).',
  '',
  '# Style per level',
  '- **beginner**: one natural full sentence (or two short paragraphs with \\n\\n).',
  '- **intermediate**: **only** a handful of **English words or short phrases** (ideas / vocabulary / chunks) the learner might use — **not** a sentence template. Pack **3–8** fragments into **one string**, separated by ** · ** (middle dot + spaces). Example shape: `sorry · running late · just arriving · platform change`. **Forbidden**: blanks, underscores (`___`), brackets with dots, gap-fill, or “complete the sentence”. No full sample dialogue sentence.',
  '- **advanced**: concise cues or keywords only (minimal scaffolding — terse reminders).',
].join('\n');

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

export function normalizeHintPayload(raw: unknown): HintPayload {
  const o = raw as Record<string, unknown>;
  const empty: string[] = [];
  return {
    beginner: asList(o.beginner ?? empty),
    intermediate: asList(o.intermediate ?? empty),
    advanced: asList(o.advanced ?? empty),
    usefulPhrases: asList(o.usefulPhrases ?? empty),
  };
}

/** Collapse model output to exactly one hint string on the requested level; strip extras. */
export function capPayloadToSingleHint(normalized: HintPayload, targetLevel: HintLevel): HintPayload {
  const lists: Record<HintLevel, string[]> = {
    beginner: normalized.beginner.map((s) => s.trim()).filter(Boolean),
    intermediate: normalized.intermediate.map((s) => s.trim()).filter(Boolean),
    advanced: normalized.advanced.map((s) => s.trim()).filter(Boolean),
  };
  const chosen =
    lists[targetLevel][0] ??
    lists.beginner[0] ??
    lists.intermediate[0] ??
    lists.advanced[0] ??
    '';

  if (!chosen) {
    throw new Error('Hint model returned empty arrays');
  }

  return {
    beginner: [],
    intermediate: [],
    advanced: [],
    usefulPhrases: [],
    [targetLevel]: [chosen],
  } as HintPayload;
}

export function hintAtLevel(h: HintPayload, level: HintLevel, index: number): string {
  const list = level === 'beginner' ? h.beginner : level === 'intermediate' ? h.intermediate : h.advanced;
  if (!list.length) return '';
  return list[index % list.length] ?? '';
}

/** Each JSON array item becomes one UI card; capped to one panel. */
export function hintPanelsAtLevel(h: HintPayload, level: HintLevel): { paragraphs: string[] }[] {
  const list = level === 'beginner' ? h.beginner : level === 'intermediate' ? h.intermediate : h.advanced;
  return list
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_HINT_PANELS)
    .map((s) => ({
      paragraphs: s
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    }))
    .filter((panel) => panel.paragraphs.length > 0);
}

export function hintUsefulPhrasesLines(h: HintPayload): string[] {
  void h;
  return [];
}

/** Plain-text join (e.g. logs); UI should prefer hintPanelsAtLevel. */
export function hintsBlockAtLevel(h: HintPayload, level: HintLevel): string {
  const list = level === 'beginner' ? h.beginner : level === 'intermediate' ? h.intermediate : h.advanced;
  const parts = list
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_HINT_PANELS);
  return parts.join('\n\n');
}

export type GenerateHintOptions = {
  speaksFirst?: LiveVoiceSpeaksFirst;
  signal?: AbortSignal;
};

export async function generateHintPayload(
  settings: StoredSettings,
  scenario: MockScenario,
  level: HintLevel,
  turns: ConversationTurn[],
  currentAiLine: string,
  options?: GenerateHintOptions,
): Promise<HintPayload> {
  const ordered =
    turns.length > MAX_TRANSCRIPT_TURNS ? turns.slice(-MAX_TRANSCRIPT_TURNS) : [...turns];
  const conversationTranscriptOrdered = ordered.map((t, i) => ({
    turn: i + 1,
    speaker: t.speaker,
    role: t.role,
    text: t.text,
  }));

  const latestAssistantLine =
    currentAiLine.trim() ||
    [...ordered].reverse().find((t) => t.role === 'ai')?.text?.trim() ||
    '';

  const openingOrder =
    options?.speaksFirst === 'user'
      ? 'learner_speaks_first'
      : options?.speaksFirst === 'ai'
        ? 'assistant_speaks_first'
        : 'unknown';

  const payload = {
    scenario: scenario.id,
    title: scenario.title,
    aiRole: scenario.aiRole,
    userRole: scenario.userRole,
    goal: scenario.goal,
    targetHintLevel: level,
    phraseBank: scenario.phraseBank,
    situationCard: scenario.prompt,
    sessionOpeningOrder: openingOrder,
    latestAssistantLine: latestAssistantLine || null,
    conversationTranscriptOrdered,
    transcriptTurnCount: conversationTranscriptOrdered.length,
    transcriptTruncated: turns.length > MAX_TRANSCRIPT_TURNS,
    hintUiLimits: {
      maxSuggestionCards: MAX_HINT_PANELS,
      maxUsefulPhraseLines: 0,
    },
  };

  const messages: ChatMsg[] = [
    { role: 'system', content: HINT_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        'Below is the HintTalk hint request as JSON. Respond with the required JSON object only.',
        JSON.stringify(payload),
      ].join('\n'),
    },
  ];

  // Generous cap: reasoning models spend invisible tokens before emitting the
  // JSON, and a too-small budget truncates the output mid-object.
  const text = await fetchChatCompletion(settings, messages, 0.28, {
    max_tokens: 2000,
    jsonMode: true,
    signal: options?.signal,
  });
  const parsed = parseJsonPayload(text);
  const normalized = normalizeHintPayload(parsed);
  return capPayloadToSingleHint(normalized, level);
}
