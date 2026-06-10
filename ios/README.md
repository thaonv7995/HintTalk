# HintTalk iOS

Native Swift/SwiftUI companion app for the HintTalk web app — live English role-play with an AI partner (OpenAI Realtime) plus shadowing practice.

## Requirements

- Xcode 16+ (built with Xcode 26.1), iOS 17.0+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`) — the `.xcodeproj` is generated from `project.yml`
- An OpenAI API key (entered in-app, stored in the iOS Keychain)

## Build & run

```bash
cd ios
xcodegen generate
open HintTalk.xcodeproj
```

Or from the CLI:

```bash
xcodebuild -project HintTalk.xcodeproj -scheme HintTalk \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

> Live voice needs a real device or simulator microphone. On a physical device set your development team in Xcode signing settings.

## Architecture

Pure native, zero third-party dependencies.

| Layer | Implementation |
|-------|----------------|
| UI | SwiftUI, `@Observable` view models, dark theme ported from `web/src/mock-theme.css` |
| Realtime voice | `URLSessionWebSocketTask` → OpenAI Realtime (PCM16 @ 24 kHz), `AVAudioEngine` capture/playback with `.voiceChat` echo cancellation (`Realtime/RealtimeVoiceEngine.swift`) |
| Coaching agents | Direct ports of `hintAgent.ts`, `repairAgent.ts`, `translateLineVi.ts` (same prompts + JSON contracts) in `Agents/` |
| Orb | `TimelineView` + `Canvas` fibonacci-sphere particle orb (`Components/OrbView.swift`) — native port of the Three.js orb |
| Shadowing | `AVSpeechSynthesizer` (or OpenAI TTS) model lines → `AVAudioRecorder` capture → `/v1/audio/transcriptions` → bag-of-words scoring ported from `shadowingScoring.ts` |
| Data | Topic catalog + lessons bundled as JSON (regenerate with `npx tsx web/scripts/export-ios-data.mts`); sessions stored as JSON in Documents; API keys in Keychain |

### Web → iOS transport note

The web app uses WebRTC (`POST /v1/realtime/calls`); the iOS app uses the Realtime **WebSocket** transport instead, which avoids bundling the ~heavy WebRTC framework while keeping the same session semantics (server VAD, whisper input transcription, identical instructions built by `RealtimeVoiceEngine.sessionConfig`).

## Regenerating bundled data

When topics or lessons change in the web app:

```bash
npx -y tsx web/scripts/export-ios-data.mts
```

This rewrites `ios/HintTalk/Resources/topics.json` and `shadowingLessons.json`.
