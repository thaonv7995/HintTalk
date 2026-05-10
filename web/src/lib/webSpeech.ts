/** Safari / Chromium Web Speech API constructor */
export type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  addEventListener(type: string, listener: (ev: unknown) => void): void;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  const g = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
}

export function transcribeResults(ev: unknown): string {
  const event = ev as { results: Iterable<{ 0: { transcript: string } }> };
  return [...event.results].map((r) => r[0].transcript).join(' ');
}
