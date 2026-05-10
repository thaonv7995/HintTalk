/** Same-origin proxy avoids browser CORS when calling OpenAI with a personal API key. */
export function chatCompletionsUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (u.includes('api.openai.com')) return '/openai/v1/chat/completions';
  return `${u}/chat/completions`;
}

export function modelsListUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (u.includes('api.openai.com')) return '/openai/v1/models';
  return `${u}/models`;
}

export function openAiRealtimeCallsUrl(): string {
  return '/openai/v1/realtime/calls';
}
