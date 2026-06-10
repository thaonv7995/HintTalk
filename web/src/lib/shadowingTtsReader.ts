import type { StoredSettings } from '../types';
import { audioSpeechUrl } from './endpoints';
import { estimateLineDurationMs } from './shadowingSpeech';

export type ShadowingTtsReader = {
  speakLine(text: string, options: { rate: number; instructions?: string; model?: string }): Promise<{ startedAt: number; endedAt: number; durationMs: number }>;
  close(): void;
};

function compactErrorMessage(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function createShadowingTtsReader(settings: StoredSettings, audio: HTMLAudioElement | null): ShadowingTtsReader | null {
  const apiKey = settings.hintApiKey.trim() || settings.realtimeApiKey.trim();
  if (!apiKey || !audio) return null;

  let abortController: AbortController | null = null;
  let objectUrl = '';

  const clearAudio = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  };

  return {
    speakLine: async (text, options) => {
      abortController?.abort();
      abortController = new AbortController();
      clearAudio();

      const body: Record<string, unknown> = {
        model: options.model ?? settings.ttsModel,
        input: text,
      };
      const isOpenAiSpeech = !settings.hintBaseUrl.trim() || settings.hintBaseUrl.includes('api.openai.com');
      if (isOpenAiSpeech) {
        body.instructions = options.instructions || 'Read naturally for English shadowing practice. Do not add any extra words.';
        body.response_format = 'mp3';
        body.speed = Math.min(1.25, Math.max(0.75, options.rate));
        body.voice = 'alloy';
      }

      const url = audioSpeechUrl(settings.hintBaseUrl);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (url.startsWith('/api-proxy')) {
        headers['X-Proxy-Target'] = settings.hintBaseUrl.trim().replace(/\/+$/, '');
      } else {
        headers['X-TTS-Base-Url'] = settings.hintBaseUrl.trim();
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        signal: abortController.signal,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const raw = await res.text();
        throw new Error(compactErrorMessage(raw) || `Speech API failed: HTTP ${res.status}`);
      }

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      const startedAt = Date.now();

      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        audio.addEventListener('ended', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        void audio.play().catch(finish);
      });

      const endedAt = Date.now();
      return {
        startedAt,
        endedAt,
        durationMs: Math.max(estimateLineDurationMs(text, options.rate), endedAt - startedAt),
      };
    },
    close: () => {
      abortController?.abort();
      abortController = null;
      clearAudio();
    },
  };
}
