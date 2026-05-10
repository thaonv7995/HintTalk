import { chatCompletionsUrl } from './endpoints';
import type { StoredSettings } from '../types';

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function fetchChatCompletion(
  settings: StoredSettings,
  messages: ChatMsg[],
  temperature = 0.6,
  fetchOpts?: { max_tokens?: number },
): Promise<string> {
  const url = chatCompletionsUrl(settings.hintBaseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.hintApiKey) headers.Authorization = `Bearer ${settings.hintApiKey}`;

  const body: Record<string, unknown> = {
    model: settings.hintModel,
    messages,
    temperature,
  };
  if (fetchOpts?.max_tokens != null) body.max_tokens = fetchOpts.max_tokens;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(raw.slice(0, 400) || `HTTP ${res.status}`);
  const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty model response');
  return text;
}
