import AVFoundation
import Foundation

/// Native OpenAI Realtime client over WebSocket (PCM16 @ 24 kHz both directions).
///
/// The web app uses WebRTC; on iOS we use the GA WebSocket transport instead so the app
/// stays dependency-free and fully native (AVAudioEngine handles capture + playback with
/// hardware echo cancellation via the `.voiceChat` audio session mode).
final class RealtimeVoiceEngine: NSObject {
    // MARK: Callbacks (delivered on the main actor)

    var onConnected: (() -> Void)?
    var onAiResponseStarted: (() -> Void)?
    var onAiTranscriptDelta: ((String) -> Void)?
    var onAiTranscriptDone: ((String) -> Void)?
    var onAiAudioFinished: (() -> Void)?
    /// Transcript + captured PCM16 @ 24 kHz for that spoken segment (nil when recording is off).
    var onUserTranscript: ((String, Data?) -> Void)?
    /// Full PCM16 audio of the AI response, emitted at `response.done`.
    var onAiAudioCaptured: ((Data) -> Void)?
    var onUserSpeakingChanged: ((Bool) -> Void)?
    var onLevels: ((Float, Float) -> Void)? // (input, output) RMS 0...1
    var onError: ((String) -> Void)?
    var onDisconnected: (() -> Void)?

    // MARK: State

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private var inputConverter: AVAudioConverter?
    private var configObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private let lock = NSLock()
    private var pendingOutputBuffers = 0
    private var responseActive = false
    private var closed = false

    /// When muted we keep the engine running but stop streaming mic audio.
    var isMuted = true

    /// When true, per-turn PCM is captured for local review playback.
    var recordsAudio = false
    private var userPreroll = Data()
    private var userSegment = Data()
    private var userSpeechActive = false
    private var pendingUserSegments: [Data] = []
    private var aiResponseAudio = Data()
    /// ~0.5 s of 24 kHz mono Int16 kept before VAD fires (covers prefix padding).
    private let prerollMaxBytes = 24000

    private let sampleRate: Double = 24000
    private lazy var wireFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16, sampleRate: sampleRate, channels: 1, interleaved: true
    )!
    private lazy var playbackFormat = AVAudioFormat(
        standardFormatWithSampleRate: sampleRate, channels: 1
    )!

    // MARK: Lifecycle

    func connect(apiKey: String, model: String, sessionConfig: [String: Any]) {
        closed = false
        guard let url = URL(string: "wss://api.openai.com/v1/realtime?model=\(model)") else {
            emitError("Invalid realtime model")
            return
        }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let session = URLSession(configuration: .default)
        urlSession = session
        let task = session.webSocketTask(with: request)
        webSocket = task
        task.resume()
        receiveLoop()

        do {
            try startAudio()
        } catch {
            emitError("Audio engine failed: \(error.localizedDescription)")
            return
        }

        sendEvent(["type": "session.update", "session": sessionConfig])
    }

    func disconnect() {
        closed = true
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        stopAudio()
    }

    func requestResponse() {
        sendEvent(["type": "response.create"])
    }

    /// Stops AI playback immediately (used when the learner ends the session mid-reply).
    func stopPlayback() {
        playerNode.stop()
        lock.lock()
        pendingOutputBuffers = 0
        lock.unlock()
    }

    // MARK: Session config builder (port of web `buildRealtimeSessionConfig`)

    static func sessionConfig(
        scenario: Scenario,
        level: HintLevel,
        voice: String,
        speaksFirst: SpeaksFirst,
        casualCompanionMode: Bool
    ) -> [String: Any] {
        let openingRules: [String] = speaksFirst == .user
            ? [
                "OPENING ORDER — LEARNER FIRST (mandatory for this session): The learner speaks before you.",
                "Until the learner has finished their first spoken turn, produce NO assistant audio and NO spoken reply.",
                "After they speak first, respond like a real person in your role — acknowledge what they said, react, then continue naturally (not a single clipped sentence every time).",
                "If they seem stuck while muted, do not interrupt — they may still be preparing.",
            ]
            : [
                "OPENING ORDER — ASSISTANT FIRST (mandatory for this session): You speak before the learner.",
                "Open with a warm, natural welcome in character — one or two short sentences is fine if it feels human.",
                "Draw them into the scene without sounding like an exam question.",
            ]

        let casualRules: [String] = casualCompanionMode
            ? [
                "",
                "CRITICAL RULE — IMPLICIT RECASTING (No Explicit Corrections):",
                "- If the learner makes grammatical or vocabulary errors, do NOT point them out, correct them explicitly, or lecture them.",
                "- Instead, naturally reformulate the incorrect phrase in your next reply (e.g., if they say \"Yesterday I go to...\", reply with \"Oh, you went to...?\").",
                "- Help them acquire correct structures implicitly through your own natural replies.",
                "",
                "CRITICAL RULE — VIETNAMESE CODE-SWITCHING:",
                "- The learner may mix English and Vietnamese when they forget a word (e.g., \"It is very kịch tính\").",
                "- You must understand the Vietnamese words, translate them, and naturally include the correct English terms in your next response (e.g., \"Yes, it is indeed very dramatic!\").",
                "- Never comment on their mixed-language speech; just keep the conversation going smoothly.",
                "",
                "TONE & FLOW:",
                "- Maintain a very warm, friendly, casual, and completely non-evaluative tone.",
                "- Avoid sounding like an examiner or a strict teacher. Make them feel safe and comfortable.",
            ]
            : []

        var lines: [String] = [
            "You are HintTalk live roleplay partner.",
            "Speak English only.",
            "",
            "CONVERSATION STYLE (critical):",
            "- Sound like a real spoken chat, not a phrase-drill or interrogation.",
            "- Vary turn length: often 2–4 short sentences; sometimes one fuller thought when it fits; avoid robot ping-pong (question → one-word answer → next question).",
            "- React to what they actually said — agree, empathize, pick up a detail — before you move the scene forward.",
            "- Mix statements, brief reactions, and questions; do NOT end every single turn with only a question.",
            "- Use natural spoken English (contractions, fillers like “well”, “sure”, “oh” when appropriate to your role).",
            "- Stay concise enough for voice: avoid long monologues or lectures.",
            "",
            "Learners often pause mid‑sentence to think — treat short silences as part of the same turn; do not rush to fill every gap.",
            "",
            "Do not grade or correct the learner unless they explicitly ask for feedback.",
            "",
            "Scenario: \(scenario.title)",
            "Your role: \(scenario.aiRole)",
            "Learner role: \(scenario.userRole)",
            "Goal: \(scenario.goal)",
            "Learner hint level: \(level.rawValue)",
        ]
        if !scenario.prompt.isEmpty {
            lines.append("Situation script (both of you are acting this):\n\(scenario.prompt)")
        }
        lines.append("")
        lines.append("The learner may choose any topic or imaginary situation.")
        lines.append("Stay in your assigned role; if they switch topic or ask for a new role-play, adapt naturally.")
        lines.append(contentsOf: casualRules)
        lines.append(contentsOf: openingRules)

        return [
            "type": "realtime",
            "output_modalities": ["audio"],
            "instructions": lines.joined(separator: "\n"),
            "audio": [
                "input": [
                    "format": ["type": "audio/pcm", "rate": 24000],
                    "transcription": ["model": "whisper-1"],
                    "turn_detection": [
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 400,
                        "silence_duration_ms": 1200,
                    ],
                ],
                "output": [
                    "format": ["type": "audio/pcm", "rate": 24000],
                    "voice": voice,
                ],
            ],
        ]
    }

    // MARK: - Audio engine

    private func startAudio() throws {
        let session = AVAudioSession.sharedInstance()
        // `.default` mode keeps full media playback volume; `.voiceChat` applies
        // call-style gain reduction that makes the AI voice very quiet on device.
        // Echo is acceptable because the mic stream is muted while the AI speaks.
        try session.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
        )
        try session.setPreferredSampleRate(48000)
        try session.setActive(true)

        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: playbackFormat)

        let inputNode = audioEngine.inputNode
        let hwFormat = inputNode.outputFormat(forBus: 0)
        inputConverter = AVAudioConverter(from: hwFormat, to: wireFormat)

        inputNode.installTap(onBus: 0, bufferSize: 2048, format: hwFormat) { [weak self] buffer, _ in
            self?.handleCapturedBuffer(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        playerNode.play()

        // Category/route changes (e.g. coming from history playback) can stop a
        // freshly started engine; restart it so scheduled AI audio keeps playing.
        configObserver = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange,
            object: audioEngine,
            queue: .main
        ) { [weak self] _ in
            self?.restartEngineIfNeeded()
        }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo,
                  let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .ended
            else { return }
            try? AVAudioSession.sharedInstance().setActive(true)
            self?.restartEngineIfNeeded()
        }
    }

    private func restartEngineIfNeeded() {
        guard !closed else { return }
        if !audioEngine.isRunning {
            try? audioEngine.start()
        }
        if audioEngine.isRunning, !playerNode.isPlaying {
            playerNode.play()
        }
    }

    private func stopAudio() {
        if let configObserver {
            NotificationCenter.default.removeObserver(configObserver)
            self.configObserver = nil
        }
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
            self.interruptionObserver = nil
        }
        playerNode.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func handleCapturedBuffer(_ buffer: AVAudioPCMBuffer) {
        let inputLevel = isMuted ? 0 : Self.rms(of: buffer)
        notifyLevels(input: inputLevel)

        guard !isMuted, let converter = inputConverter else { return }

        let ratio = sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16
        guard let outBuffer = AVAudioPCMBuffer(pcmFormat: wireFormat, frameCapacity: capacity) else { return }

        var consumed = false
        var convError: NSError?
        let status = converter.convert(to: outBuffer, error: &convError) { _, outStatus in
            if consumed {
                outStatus.pointee = .noDataNow
                return nil
            }
            consumed = true
            outStatus.pointee = .haveData
            return buffer
        }
        guard status != .error, outBuffer.frameLength > 0, let channel = outBuffer.int16ChannelData else { return }

        let byteCount = Int(outBuffer.frameLength) * MemoryLayout<Int16>.size
        let data = Data(bytes: channel[0], count: byteCount)

        if recordsAudio {
            lock.lock()
            if userSpeechActive {
                userSegment.append(data)
            } else {
                userPreroll.append(data)
                if userPreroll.count > prerollMaxBytes {
                    userPreroll.removeFirst(userPreroll.count - prerollMaxBytes)
                }
            }
            lock.unlock()
        }

        sendEvent([
            "type": "input_audio_buffer.append",
            "audio": data.base64EncodedString(),
        ])
    }

    private func playAudioDelta(_ base64: String) {
        guard let data = Data(base64Encoded: base64), !data.isEmpty else { return }
        if recordsAudio {
            lock.lock()
            aiResponseAudio.append(data)
            lock.unlock()
        }
        let frameCount = AVAudioFrameCount(data.count / MemoryLayout<Int16>.size)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: playbackFormat, frameCapacity: frameCount),
              let channel = buffer.floatChannelData
        else { return }
        buffer.frameLength = frameCount

        data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            let samples = raw.bindMemory(to: Int16.self)
            for i in 0 ..< Int(frameCount) {
                channel[0][i] = Float(samples[i]) / 32768.0
            }
        }

        notifyLevels(output: Self.rms(of: buffer))

        lock.lock()
        pendingOutputBuffers += 1
        lock.unlock()

        playerNode.scheduleBuffer(buffer) { [weak self] in
            guard let self else { return }
            self.lock.lock()
            self.pendingOutputBuffers -= 1
            let drained = self.pendingOutputBuffers <= 0
            let responseDone = !self.responseActive
            self.lock.unlock()
            if drained {
                self.notifyLevels(output: 0)
                if responseDone {
                    DispatchQueue.main.async { self.onAiAudioFinished?() }
                }
            }
        }
        restartEngineIfNeeded()
    }

    private static func rms(of buffer: AVAudioPCMBuffer) -> Float {
        let frames = Int(buffer.frameLength)
        guard frames > 0 else { return 0 }
        var sum: Float = 0
        if let floats = buffer.floatChannelData {
            for i in 0 ..< frames { sum += floats[0][i] * floats[0][i] }
        } else if let ints = buffer.int16ChannelData {
            for i in 0 ..< frames {
                let v = Float(ints[0][i]) / 32768.0
                sum += v * v
            }
        } else {
            return 0
        }
        return min(1, sqrt(sum / Float(frames)) * 4)
    }

    private var lastLevelNotify = Date.distantPast
    private var latestInput: Float = 0
    private var latestOutput: Float = 0

    private func notifyLevels(input: Float? = nil, output: Float? = nil) {
        if let input { latestInput = input }
        if let output { latestOutput = output }
        let now = Date()
        guard now.timeIntervalSince(lastLevelNotify) > 0.05 else { return }
        lastLevelNotify = now
        let i = latestInput
        let o = latestOutput
        DispatchQueue.main.async { [weak self] in self?.onLevels?(i, o) }
    }

    // MARK: - WebSocket

    private func sendEvent(_ event: [String: Any]) {
        guard let webSocket,
              let data = try? JSONSerialization.data(withJSONObject: event),
              let json = String(data: data, encoding: .utf8)
        else { return }
        webSocket.send(.string(json)) { [weak self] error in
            if error != nil, self?.closed == false {
                // Transient send failures surface via the receive loop; ignore here.
            }
        }
    }

    private func receiveLoop() {
        webSocket?.receive { [weak self] result in
            guard let self, !self.closed else { return }
            switch result {
            case let .success(message):
                switch message {
                case let .string(text):
                    self.handleServerEvent(text)
                case let .data(data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleServerEvent(text)
                    }
                @unknown default:
                    break
                }
                self.receiveLoop()
            case let .failure(error):
                if !self.closed {
                    self.emitError("Connection lost: \(error.localizedDescription)")
                    DispatchQueue.main.async { self.onDisconnected?() }
                }
            }
        }
    }

    private func handleServerEvent(_ text: String) {
        guard let data = text.data(using: .utf8),
              let event = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = event["type"] as? String
        else { return }

        switch type {
        case "session.created", "session.updated":
            if type == "session.created" {
                DispatchQueue.main.async { self.onConnected?() }
            }

        case "response.created":
            lock.lock()
            responseActive = true
            aiResponseAudio = Data()
            lock.unlock()
            DispatchQueue.main.async { self.onAiResponseStarted?() }

        case "response.output_audio.delta", "response.audio.delta":
            if let delta = event["delta"] as? String {
                playAudioDelta(delta)
            }

        case "response.output_audio_transcript.delta", "response.audio_transcript.delta":
            if let delta = event["delta"] as? String {
                DispatchQueue.main.async { self.onAiTranscriptDelta?(delta) }
            }

        case "response.output_audio_transcript.done", "response.audio_transcript.done":
            if let transcript = event["transcript"] as? String {
                DispatchQueue.main.async { self.onAiTranscriptDone?(transcript) }
            }

        case "response.done":
            lock.lock()
            responseActive = false
            let drained = pendingOutputBuffers <= 0
            let aiAudio = aiResponseAudio
            aiResponseAudio = Data()
            lock.unlock()
            if recordsAudio, !aiAudio.isEmpty {
                DispatchQueue.main.async { self.onAiAudioCaptured?(aiAudio) }
            }
            if drained {
                DispatchQueue.main.async { self.onAiAudioFinished?() }
            }

        case "conversation.item.input_audio_transcription.completed":
            if let transcript = (event["transcript"] as? String)?.trimmed, !transcript.isEmpty {
                lock.lock()
                let segment = pendingUserSegments.isEmpty ? nil : pendingUserSegments.removeFirst()
                lock.unlock()
                DispatchQueue.main.async { self.onUserTranscript?(transcript, segment) }
            } else {
                // Empty transcript still consumes its queued audio segment.
                lock.lock()
                if !pendingUserSegments.isEmpty { pendingUserSegments.removeFirst() }
                lock.unlock()
            }

        case "input_audio_buffer.speech_started":
            lock.lock()
            userSegment = userPreroll
            userPreroll = Data()
            userSpeechActive = true
            lock.unlock()
            DispatchQueue.main.async { self.onUserSpeakingChanged?(true) }

        case "input_audio_buffer.speech_stopped":
            lock.lock()
            if !userSegment.isEmpty {
                pendingUserSegments.append(userSegment)
                if pendingUserSegments.count > 8 { pendingUserSegments.removeFirst() }
            }
            userSegment = Data()
            userSpeechActive = false
            lock.unlock()
            DispatchQueue.main.async { self.onUserSpeakingChanged?(false) }

        case "error":
            let message = ((event["error"] as? [String: Any])?["message"] as? String) ?? "Realtime error"
            emitError(message)

        default:
            break
        }
    }

    private func emitError(_ message: String) {
        DispatchQueue.main.async { self.onError?(message) }
    }
}
