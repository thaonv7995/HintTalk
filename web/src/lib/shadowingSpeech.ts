import { getSpeechRecognitionCtor, transcribeResults, type SpeechRecognitionInstance } from './webSpeech';
import { audioTranscriptionsUrl } from './endpoints';
import type { ShadowingCaptureStatus } from '../types';

export type ShadowingVoiceOptions = {
  rate: number;
  lang?: string;
};

export type ShadowingCaptureController = {
  stop(): Promise<{ transcript: string; startedAt: number; endedAt: number; durationMs: number; status: ShadowingCaptureStatus; errorMessage?: string }>;
};

export function estimateLineDurationMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const baseWpm = 145 * Math.max(0.5, rate);
  return Math.max(1200, Math.round((words / baseWpm) * 60_000));
}

export function speakShadowingLine(text: string, options: ShadowingVoiceOptions): Promise<{ startedAt: number; endedAt: number; durationMs: number }> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      const startedAt = Date.now();
      const durationMs = estimateLineDurationMs(text, options.rate);
      globalThis.setTimeout(() => resolve({ startedAt, endedAt: Date.now(), durationMs }), durationMs);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate;
    utterance.lang = options.lang ?? 'en-US';
    const startedAt = Date.now();
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      const endedAt = Date.now();
      resolve({ startedAt, endedAt, durationMs: Math.max(1, endedAt - startedAt) });
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}

type ShadowingCaptureOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

function bestAudioMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function compactErrorMessage(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function transcribeAudioBlobWithModel(blob: Blob, apiKey: string, baseUrl: string, model: string): Promise<string> {
  const fd = new FormData();
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  fd.set('file', blob, `shadowing-line.${ext}`);
  fd.set('model', model);
  fd.set('language', 'en');
  fd.set('response_format', 'json');

  const url = audioTranscriptionsUrl(baseUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (url.startsWith('/api-proxy')) {
    headers['X-Proxy-Target'] = baseUrl.trim().replace(/\/+$/, '');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: fd,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${model}: ${compactErrorMessage(text) || `HTTP ${res.status}`}`);
  let json: { text?: string };
  try {
    json = JSON.parse(text) as { text?: string };
  } catch {
    throw new Error(`${model}: invalid JSON response`);
  }
  return (json.text ?? '').trim();
}

async function transcribeAudioBlob(blob: Blob, apiKey: string, baseUrl: string, preferredModel: string): Promise<string> {
  if (blob.size < 600) return '';
  const errors: string[] = [];
  const models = [preferredModel, 'gpt-4o-mini-transcribe', 'whisper-1'].filter((model, index, arr) => model && arr.indexOf(model) === index);
  for (const model of models) {
    try {
      return await transcribeAudioBlobWithModel(blob, apiKey, baseUrl, model);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(' | '));
}

async function startMediaRecorderCapture(apiKey: string, baseUrl: string, model: string): Promise<ShadowingCaptureController | null> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    return {
      stop: async () => {
        const now = Date.now();
        return { transcript: '', startedAt: now, endedAt: now, durationMs: 1, status: 'mic_unavailable' };
      },
    };
  }
  const chunks: Blob[] = [];
  const mimeType = bestAudioMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const startedAt = Date.now();
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.start(250);

  return {
    stop: () =>
      new Promise((resolve) => {
        const endedAt = Date.now();
        recorder.addEventListener(
          'stop',
          () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
            stream.getTracks().forEach((track) => track.stop());
            void transcribeAudioBlob(blob, apiKey, baseUrl, model)
              .then((transcript) => {
                resolve({
                  transcript,
                  startedAt,
                  endedAt,
                  durationMs: Math.max(1, endedAt - startedAt),
                  status: transcript ? 'captured' : 'no_speech',
                });
              })
              .catch((error) => {
                resolve({
                  transcript: '',
                  startedAt,
                  endedAt,
                  durationMs: Math.max(1, endedAt - startedAt),
                  status: 'transcription_failed',
                  errorMessage: compactErrorMessage(error instanceof Error ? error.message : String(error)),
                });
              });
          },
          { once: true },
        );
        try {
          recorder.stop();
        } catch {
          stream.getTracks().forEach((track) => track.stop());
          resolve({ transcript: '', startedAt, endedAt, durationMs: Math.max(1, endedAt - startedAt), status: 'capture_unavailable' });
        }
      }),
  };
}

function startWebSpeechCapture(): ShadowingCaptureController | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognition: SpeechRecognitionInstance = new Ctor();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;

  let latestTranscript = '';
  const startedAt = Date.now();
  recognition.addEventListener('result', (ev) => {
    latestTranscript = transcribeResults(ev);
  });

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        const endedAt = Date.now();
        try {
          recognition.stop();
        } catch {
          /* noop */
        }
        window.setTimeout(
          () =>
            resolve({
              transcript: latestTranscript.trim(),
              startedAt,
              endedAt,
              durationMs: Math.max(1, endedAt - startedAt),
              status: latestTranscript.trim() ? 'captured' : 'no_speech',
            }),
          80,
        );
      }),
  };
}

export async function startShadowingCapture(options: ShadowingCaptureOptions = {}): Promise<ShadowingCaptureController | null> {
  const apiKey = options.apiKey?.trim();
  const baseUrl = options.baseUrl?.trim() || 'https://api.openai.com/v1';
  const model = options.model?.trim() || 'gpt-4o-mini-transcribe';
  if (apiKey) {
    try {
      const recorder = await startMediaRecorderCapture(apiKey, baseUrl, model);
      if (recorder) return recorder;
    } catch {
      const fallback = startWebSpeechCapture();
      if (fallback) return fallback;
    }
  } else {
    const fallback = startWebSpeechCapture();
    if (fallback) return fallback;
    return {
      stop: async () => {
        const now = Date.now();
        return { transcript: '', startedAt: now, endedAt: now, durationMs: 1, status: 'missing_api_key' };
      },
    };
  }
  return {
    stop: async () => {
      const now = Date.now();
      return { transcript: '', startedAt: now, endedAt: now, durationMs: 1, status: 'capture_unavailable' };
    },
  };
}
