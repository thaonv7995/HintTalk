import type { ShadowingLesson, StoredSettings } from '../types';
import { exchangeRealtimeSdp } from './openaiRealtime';
import { parseJsonPayload } from './jsonPayload';
import type { ShadowingPromptPlan } from './shadowingLessonAgent';

type RealtimeEvent = {
  type?: string;
  delta?: string;
  text?: string;
  transcript?: string;
  part?: { type?: string; text?: string };
  item?: { content?: { type?: string; text?: string; transcript?: string }[] };
  error?: { message?: string; code?: string; type?: string };
  response?: {
    id?: string;
    status?: string;
    status_details?: { error?: { message?: string } };
    metadata?: Record<string, string>;
    output?: { content?: { type?: string; text?: string; transcript?: string }[] }[];
  };
};

export type ShadowingRealtimeReader = {
  generateLesson(seed: { topicHint: string; topicDescription: string; genre: ShadowingLesson['genre']; level: ShadowingLesson['level'] }): Promise<ShadowingLesson>;
  speakLine(text: string): Promise<{ startedAt: number; endedAt: number; durationMs: number }>;
  close(): void;
};

type ShadowingRealtimeReaderOptions = {
  onDebug?: (message: string) => void;
};

function buildShadowingRealtimeSession(settings: StoredSettings): string {
  return JSON.stringify({
    type: 'realtime',
    model: settings.realtimeModel,
  });
}

function normalizeRealtimeLesson(rawText: string, plan: ShadowingPromptPlan, seed: Parameters<ShadowingRealtimeReader['generateLesson']>[0]): ShadowingLesson {
  const raw = parseJsonPayload(rawText) as Record<string, unknown>;
  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = rawLines
    .map((item, index) => {
      const line = item as Record<string, unknown>;
      const text = typeof line.text === 'string' ? line.text.trim() : typeof item === 'string' ? item.trim() : '';
      if (!text) return null;
      const focusPhrase = typeof line.focusPhrase === 'string' ? line.focusPhrase.trim() : '';
      return {
        id: `rt-${Date.now()}-${index}`,
        text,
        focusPhrase: focusPhrase && text.toLowerCase().includes(focusPhrase.toLowerCase()) ? focusPhrase : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 5) as ShadowingLesson['lines'];

  if (lines.length !== 5) throw new Error(`Realtime generated ${lines.length || 'no'} usable lines; expected 5.`);

  return {
    id: `rt-${Date.now()}`,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : plan.title,
    level: raw.level === 'advanced' || raw.level === 'intermediate' ? raw.level : seed.level,
    genre: seed.genre,
    voiceHint: plan.voiceHint,
    promptInstruction: plan.promptInstruction,
    targetWpm: typeof raw.targetWpm === 'number' ? Math.min(175, Math.max(125, Math.round(raw.targetWpm))) : plan.targetWpm,
    lines,
  };
}

function readTextContent(parts?: { type?: string; text?: string; transcript?: string }[]): string {
  return (parts || [])
    .map((part) => {
      if (part.type === 'text' || part.type === 'output_text') return part.text || '';
      return part.text || part.transcript || '';
    })
    .join('')
    .trim();
}

function readResponseText(response?: RealtimeEvent['response']): string {
  return (response?.output || []).map((item) => readTextContent(item.content)).join('').trim();
}

export async function createShadowingRealtimeReader(
  settings: StoredSettings,
  plan: ShadowingPromptPlan,
  audio: HTMLAudioElement | null,
  options: ShadowingRealtimeReaderOptions = {},
): Promise<ShadowingRealtimeReader> {
  const apiKey = settings.realtimeApiKey.trim();
  if (!apiKey) throw new Error('Add Realtime API key before starting shadowing.');

  const pc = new RTCPeerConnection();
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.ontrack = (event) => {
    if (!audio || !event.streams[0]) return;
    audio.srcObject = event.streams[0];
    void audio.play().catch(() => {});
  };

  const dc = pc.createDataChannel('oai-events');
  const waitOpen = new Promise<void>((resolve, reject) => {
    dc.onopen = () => {
      options.onDebug?.('Realtime data channel open');
      try {
        dc.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              modalities: ['text', 'audio'],
              instructions: [
                plan.promptInstruction,
                '',
                'You are inside a shadowing practice session.',
                'First, generate a fresh passage only when the app asks for structured passage JSON.',
                'After that, when asked to read a line, produce only that exact line as natural spoken audio.',
                'Do not greet the learner. Do not number the line. Do not explain anything.',
                'The app handles the 3 second pause between lines.',
              ].join('\n'),
              voice: settings.realtimeVoice,
            },
          })
        );
        options.onDebug?.('Sent session.update for shadowing reader');
      } catch (err) {
        options.onDebug?.(`Failed to send session.update: ${err}`);
      }
      resolve();
    };
    dc.onerror = () => reject(new Error('Realtime data channel error'));
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const exchange = await exchangeRealtimeSdp(apiKey, offer.sdp || '', buildShadowingRealtimeSession(settings));
  if (!exchange.ok || !exchange.answerSdp) {
    pc.close();
    throw new Error(exchange.errorText || 'Realtime session failed');
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: exchange.answerSdp });
  await waitOpen;

  const pendingAudio: { resolve: (value: { startedAt: number; endedAt: number; durationMs: number }) => void; reject: (error: Error) => void; startedAt: number }[] = [];
  const pendingText: { resolve: (value: string) => void; reject: (error: Error) => void; chunks: string[] }[] = [];
  dc.onmessage = (event) => {
    let parsed: RealtimeEvent;
    try {
      parsed = JSON.parse(String(event.data || '')) as RealtimeEvent;
    } catch {
      return;
    }
    options.onDebug?.(`Realtime event: ${parsed.type || 'unknown'}`);
    if (parsed.type === 'error') {
      const error = new Error(parsed.error?.message || parsed.error?.code || 'Realtime event error');
      pendingText.shift()?.reject(error);
      pendingAudio.shift()?.reject(error);
      return;
    }
    if (parsed.type === 'response.output_text.delta' && pendingText.length) {
      pendingText[0].chunks.push(parsed.delta || '');
      return;
    }
    if (parsed.type === 'response.output_text.done' && pendingText.length) {
      const item = pendingText.shift();
      if (item) item.resolve((parsed.text || item.chunks.join('')).trim());
      return;
    }
    if (parsed.type === 'response.content_part.done' && (parsed.part?.type === 'text' || parsed.part?.type === 'output_text') && pendingText.length) {
      const item = pendingText.shift();
      if (item) item.resolve((parsed.part.text || item.chunks.join('')).trim());
      return;
    }
    if (parsed.type === 'response.output_item.done' && pendingText.length) {
      const text = readTextContent(parsed.item?.content);
      if (text) {
        const item = pendingText.shift();
        item?.resolve(text);
      }
      return;
    }
    if (parsed.type === 'response.done') {
      const textItem = pendingText[0];
      const audioItem = pendingAudio[0];
      if (!textItem && !audioItem) return;
      const endedAt = Date.now();
      if (parsed.response?.status === 'failed') {
        const error = new Error(parsed.response.status_details?.error?.message || 'Realtime response failed');
        pendingText.shift()?.reject(error);
        pendingAudio.shift()?.reject(error);
        return;
      }
      const completedTextItem = pendingText.shift();
      if (completedTextItem) {
        completedTextItem.resolve(readResponseText(parsed.response) || completedTextItem.chunks.join('').trim());
        return;
      }
      const completedAudioItem = pendingAudio.shift();
      if (completedAudioItem) {
        completedAudioItem.resolve({ startedAt: completedAudioItem.startedAt, endedAt, durationMs: Math.max(1, endedAt - completedAudioItem.startedAt) });
      }
    }
  };

  return {
    generateLesson: (seed) =>
      new Promise((resolve, reject) => {
        if (dc.readyState !== 'open') {
          reject(new Error('Realtime reader is not connected'));
          return;
        }
        const timeoutId = window.setTimeout(() => {
          const index = pendingText.findIndex((item) => item.reject === reject);
          if (index >= 0) pendingText.splice(index, 1);
          reject(new Error('Realtime passage generation timed out. Please try again.'));
        }, 25000);
        const prompt = [
          'Generate the shadowing passage now from the session prompt instruction.',
          'Return only valid JSON. Do not wrap it in markdown.',
          'Required JSON shape:',
          '{"title":"...","level":"intermediate","targetWpm":145,"lines":[{"text":"...","focusPhrase":"..."}]}',
          'Use exactly 5 lines. Each line must be one natural spoken sentence, 5-13 words.',
          'focusPhrase must be a short exact phrase from the same line.',
          `Topic: ${seed.topicHint}`,
          `Topic scope: ${seed.topicDescription}`,
          `Genre: ${seed.genre}`,
          `Level: ${seed.level}`,
        ].join('\n');
        pendingText.push({
          chunks: [],
          resolve: (text) => {
            window.clearTimeout(timeoutId);
            try {
              resolve(normalizeRealtimeLesson(text, plan, seed));
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Could not parse realtime lesson'));
            }
          },
          reject: (error) => {
            window.clearTimeout(timeoutId);
            reject(error);
          },
        });
        dc.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              conversation: 'none',
              metadata: { kind: 'shadowing_lesson' },
              output_modalities: ['text'],
              input: [
                {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: prompt }],
                },
              ],
            },
          }),
        );
      }),
    speakLine: (text: string) =>
      new Promise((resolve, reject) => {
        if (dc.readyState !== 'open') {
          reject(new Error('Realtime reader is not connected'));
          return;
        }
        const startedAt = Date.now();
        pendingAudio.push({ resolve, reject, startedAt });
        dc.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              conversation: 'none',
              metadata: { kind: 'shadowing_audio' },
              output_modalities: ['audio'],
              instructions: [
                'Read this exact shadowing line aloud once.',
                'Do not add commentary, prefixes, numbering, or explanations.',
                `Line: ${text}`,
              ].join('\n'),
            },
          }),
        );
      }),
    close: () => {
      try {
        dc.close();
      } catch {
        /* noop */
      }
      try {
        pc.close();
      } catch {
        /* noop */
      }
      if (audio) {
        audio.pause();
        audio.srcObject = null;
      }
    },
  };
}
