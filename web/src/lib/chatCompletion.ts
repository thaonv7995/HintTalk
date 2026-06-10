import { chatCompletionsUrl } from './endpoints';
import type { StoredSettings } from '../types';

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function fetchChatCompletion(
  settings: StoredSettings,
  messages: ChatMsg[],
  temperature = 0.6,
  fetchOpts?: { max_tokens?: number; jsonMode?: boolean; signal?: AbortSignal },
): Promise<string> {
  const url = chatCompletionsUrl(settings.hintBaseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.hintApiKey) headers.Authorization = `Bearer ${settings.hintApiKey}`;
  if (url.startsWith('/api-proxy')) {
    headers['X-Proxy-Target'] = settings.hintBaseUrl.trim().replace(/\/+$/, '');
  }

  const body: Record<string, unknown> = {
    model: settings.hintModel,
    messages,
    temperature,
  };
  if (fetchOpts?.max_tokens != null) body.max_tokens = fetchOpts.max_tokens;
  if (fetchOpts?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: fetchOpts?.signal,
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(raw.slice(0, 400) || `HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') || raw.trim().startsWith('data:')) {
    let accumulatedText = '';
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = parsed.choices?.[0]?.delta?.content || '';
          accumulatedText += chunkText;
        } catch {
          // Ignore
        }
      }
    }
    const text = accumulatedText.trim();
    if (!text) throw new Error('Empty stream response');
    return text;
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(raw);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const headersObj: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      headersObj[key] = val;
    });
    throw new Error(
      `Failed to parse API response: ${errMsg}. Status: ${res.status} ${res.statusText}. Headers: ${JSON.stringify(headersObj)}. Raw body: ${raw.slice(0, 300)}`,
      { cause: err },
    );
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty model response');
  return text;
}
