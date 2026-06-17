/**
 * Voca Dictionary Bridge API client.
 *
 * Fetches vocabulary cards from the Voca Bridge (/v1/cards) and prepares
 * a subset for injection into live-voice AI instructions so the partner
 * naturally weaves target words into conversation.
 */

import { vocaCardsUrl, vocaHealthUrl } from './endpoints';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type VocaCard = {
  slug: string;
  word: string;
  meaningVi: string;
  meaningEn: string;
  partOfSpeech: string;
  pronunciation: string;
  examples: string[];
  level: 'new' | 'learning' | 'known' | 'mastered';
};

/* ------------------------------------------------------------------ */
/*  Normalise raw API card → VocaCard                                  */
/* ------------------------------------------------------------------ */

function normaliseCard(raw: Record<string, unknown>): VocaCard {
  const word = String(raw.word ?? '').trim();
  const slug =
    typeof raw.slug === 'string' && raw.slug
      ? raw.slug
      : typeof raw.id === 'string' && raw.id
        ? raw.id
        : word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const examples: string[] = [];
  if (Array.isArray(raw.examples)) {
    for (const ex of raw.examples) {
      if (typeof ex === 'string' && ex.trim()) examples.push(ex.trim());
    }
  }

  return {
    slug,
    word,
    meaningVi: String(raw.meaningVi ?? ''),
    meaningEn: String(raw.meaningEn ?? ''),
    partOfSpeech: String(raw.partOfSpeech ?? ''),
    pronunciation: String(raw.pronunciation ?? raw.ipa ?? ''),
    examples,
    level: (['new', 'learning', 'known', 'mastered'].includes(String(raw.level))
      ? String(raw.level)
      : 'new') as VocaCard['level'],
  };
}

/* ------------------------------------------------------------------ */
/*  Fetch helpers                                                      */
/* ------------------------------------------------------------------ */

function authHeaders(token: string): HeadersInit {
  const h: HeadersInit = {};
  if (token.trim()) h.Authorization = `Bearer ${token.trim()}`;
  return h;
}

/**
 * Check Voca Bridge health.
 * Resolves `true` if bridge is reachable, `false` otherwise.
 */
export async function checkVocaHealth(token: string): Promise<boolean> {
  try {
    const res = await fetch(vocaHealthUrl(), { headers: authHeaders(token) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch all vocabulary cards from the Voca Bridge API.
 */
export async function fetchVocaCards(
  token: string,
  signal?: AbortSignal,
): Promise<VocaCard[]> {
  const res = await fetch(vocaCardsUrl(), {
    headers: authHeaders(token),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Voca API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as unknown;

  // Versioned format: { version, cards: [...] }
  let rawCards: unknown[];
  if (
    json &&
    typeof json === 'object' &&
    'cards' in json &&
    Array.isArray((json as Record<string, unknown>).cards)
  ) {
    rawCards = (json as Record<string, unknown>).cards as unknown[];
  } else if (Array.isArray(json)) {
    // Legacy flat array
    rawCards = json;
  } else {
    throw new Error('Unexpected Voca cards response shape');
  }

  return rawCards
    .filter((c): c is Record<string, unknown> => c != null && typeof c === 'object')
    .map(normaliseCard)
    .filter((c) => c.word);
}

/* ------------------------------------------------------------------ */
/*  Selection helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Fisher-Yates shuffle (returns new array).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `count` random cards from `cards`, preferring cards whose level is
 * in `preferredLevels` (default: `new`, `learning`).  Falls back to other
 * levels if the preferred pool is too small.
 */
export function pickRandomVocaWords(
  cards: VocaCard[],
  count: number,
  preferredLevels: VocaCard['level'][] = ['new', 'learning'],
): VocaCard[] {
  const preferred = cards.filter((c) => preferredLevels.includes(c.level));
  const rest = cards.filter((c) => !preferredLevels.includes(c.level));

  const pool = [...shuffle(preferred), ...shuffle(rest)];
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}

/* ------------------------------------------------------------------ */
/*  AI prompt formatting                                               */
/* ------------------------------------------------------------------ */

/**
 * Build a text block for insertion into OpenAI Realtime session
 * instructions.  The AI partner reads this and naturally weaves the
 * words into conversation.
 */
export function formatVocaForAiInstructions(cards: VocaCard[]): string {
  if (!cards.length) return '';

  const wordLines = cards
    .map((c) => {
      const parts: string[] = [`- "${c.word}"`];
      if (c.partOfSpeech) parts.push(`(${c.partOfSpeech})`);
      if (c.meaningVi) parts.push(`— ${c.meaningVi}`);
      if (c.examples.length) parts.push(`Example: "${c.examples[0]}"`);
      return parts.join(' ');
    })
    .join('\n');

  return [
    '',
    'VOCABULARY CONTEXT (optional — for reference only):',
    'The learner is studying these words. You may naturally use some of them if they fit the conversation — but there is absolutely no obligation to include any of them. Prioritise natural, flowing dialogue over vocabulary coverage.',
    '',
    'Words the learner is studying:',
    wordLines,
  ].join('\n');
}

/**
 * Short keyword list for Hint Agent context (not the full instruction block).
 */
export function vocaWordsForHintPayload(cards: VocaCard[]): string[] {
  return cards.map((c) => c.word);
}
