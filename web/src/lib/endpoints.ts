/** Same-origin proxy avoids browser CORS when calling OpenAI with a personal API key. */
export function chatCompletionsUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (u.includes('api.openai.com')) return '/openai/v1/chat/completions';
  if (u.startsWith('http://') || u.startsWith('https://')) return '/api-proxy/chat/completions';
  return `${u}/chat/completions`;
}

export function modelsListUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (u.includes('api.openai.com')) return '/openai/v1/models';
  if (u.startsWith('http://') || u.startsWith('https://')) return '/api-proxy/models';
  return `${u}/models`;
}

export function openAiRealtimeCallsUrl(): string {
  return '/openai/v1/realtime/calls';
}

export function openAiAudioTranscriptionsUrl(): string {
  return '/openai/v1/audio/transcriptions';
}

export function audioTranscriptionsUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (!u || u.includes('api.openai.com')) return '/openai/v1/audio/transcriptions';
  if (u.startsWith('http://') || u.startsWith('https://')) return '/api-proxy/audio/transcriptions';
  return `${u}/audio/transcriptions`;
}

export function audioSpeechUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (!u || u.includes('api.openai.com')) return '/openai/v1/audio/speech';
  if (u.startsWith('http://') || u.startsWith('https://')) return '/api-proxy/audio/speech';
  return '/tts/audio/speech';
}

/** Voca Bridge API: fetch all vocabulary cards. */
export function vocaCardsUrl(): string {
  return '/voca-api/v1/cards';
}

/** Voca Bridge API: health check. */
export function vocaHealthUrl(): string {
  return '/voca-api/v1/health';
}
