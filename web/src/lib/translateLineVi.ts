import { fetchChatCompletion } from './chatCompletion';
import type { StoredSettings } from '../types';

const SYSTEM =
  'You translate English spoken dialogue into natural Vietnamese. Output ONLY the Vietnamese text — no quotes, labels, or explanation.';

/** Translate one utterance for live captions (uses Hint Model settings). */
export async function translateLineToVi(settings: StoredSettings, english: string): Promise<string> {
  const trimmed = english.trim();
  if (!trimmed) return '';
  if (!settings.hintApiKey?.trim() || !settings.hintModel?.trim() || !settings.hintBaseUrl?.trim()) {
    return '';
  }
  const text = await fetchChatCompletion(
    settings,
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: trimmed },
    ],
    0.15,
    { max_tokens: 280 },
  );
  return text.trim();
}
