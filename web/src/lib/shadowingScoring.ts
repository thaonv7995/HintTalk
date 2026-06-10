import type { ShadowingCaptureStatus, ShadowingLineResult, ShadowingPaceLabel } from '../types';

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

function paceLabel(modelDurationMs: number, captureDurationMs: number): ShadowingPaceLabel {
  if (modelDurationMs <= 0 || captureDurationMs <= 0) return 'unknown';
  const ratio = captureDurationMs / modelDurationMs;
  if (ratio > 1.28) return 'too_slow';
  if (ratio < 0.72) return 'too_fast';
  return 'close';
}

export function scoreShadowingLine(
  lineId: string,
  target: string,
  transcript: string,
  timing: { modelDurationMs: number; captureDurationMs: number },
  captureStatus?: ShadowingCaptureStatus,
  captureError?: string,
): ShadowingLineResult {
  const targetWords = tokenize(target);
  const transcriptWords = tokenize(transcript);
  const resolvedCaptureStatus = captureStatus ?? (transcriptWords.length ? 'captured' : 'no_speech');
  const remaining = [...transcriptWords];
  let matched = 0;
  const missingWords: string[] = [];

  targetWords.forEach((word) => {
    const idx = remaining.indexOf(word);
    if (idx >= 0) {
      matched += 1;
      remaining.splice(idx, 1);
    } else {
      missingWords.push(word);
    }
  });

  const targetSet = new Set(targetWords);
  const extraWords = remaining.filter((word) => !targetSet.has(word));
  const changedWords = missingWords.slice(0, Math.max(0, extraWords.length));
  const denominator = Math.max(targetWords.length, 1);
  const penalty = Math.min(extraWords.length / denominator, 0.28);
  const accuracy = Math.max(0, Math.min(1, matched / denominator - penalty));

  return {
    lineId,
    target,
    transcript: transcript.trim(),
    captureStatus: resolvedCaptureStatus,
    captureError,
    accuracy,
    paceLabel: resolvedCaptureStatus === 'captured' ? paceLabel(timing.modelDurationMs, timing.captureDurationMs) : 'unknown',
    missingWords: [...new Set(missingWords)].slice(0, 8),
    extraWords: [...new Set(extraWords)].slice(0, 8),
    changedWords: [...new Set(changedWords)].slice(0, 8),
    modelDurationMs: timing.modelDurationMs,
    captureDurationMs: timing.captureDurationMs,
  };
}

export function formatAccuracy(value: number): string {
  return `${Math.round(value * 100)}%`;
}
