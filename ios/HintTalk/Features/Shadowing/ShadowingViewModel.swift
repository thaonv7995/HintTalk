import AVFoundation
import Foundation
import Observation

@MainActor
@Observable
final class ShadowingViewModel: NSObject {
    enum Phase: Equatable {
        case pickLesson
        case ready
        case playingModel
        case gap(Int)
        case recording
        case processing
        case finished
    }

    private(set) var phase: Phase = .pickLesson
    private(set) var lesson: ShadowingLesson?
    private(set) var lineIndex = 0
    private(set) var results: [ShadowingLineResult] = []
    private(set) var transcribing = 0
    var errorMessage: String?

    let lessons = TopicCatalog.shadowingLessons
    private let settings = SettingsStore.shared

    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var recorder: AVAudioRecorder?
    private var modelPlaybackStart: Date?
    private var modelDurationMs: Double = 0
    private var recordingStart: Date?
    private var flowTask: Task<Void, Never>?
    private var playbackContinuation: CheckedContinuation<Void, Never>?
    private var runStartedAt: Date?
    private var sessionSaved = false
    /// Audio written during this run — deleted if the run is abandoned before saving.
    private var sessionAudioFiles: [String] = []

    var currentLine: ShadowingLine? {
        guard let lesson, lineIndex < lesson.lines.count else { return nil }
        return lesson.lines[lineIndex]
    }

    var averageAccuracy: Double {
        let captured = results.filter { !$0.captureFailed }
        guard !captured.isEmpty else { return 0 }
        return captured.map(\.accuracy).reduce(0, +) / Double(captured.count)
    }

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    // MARK: Lesson control

    func select(_ lesson: ShadowingLesson) {
        self.lesson = lesson
        lineIndex = 0
        results = []
        errorMessage = nil
        phase = .ready
    }

    func backToLessons() {
        stopRun()
        lesson = nil
        results = []
        phase = .pickLesson
    }

    func startRun() async {
        guard lesson != nil else { return }
        errorMessage = nil

        let granted = await AVAudioApplication.requestRecordPermission()
        guard granted else {
            errorMessage = "Microphone permission is required for shadowing."
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
        } catch {
            errorMessage = "Audio session failed: \(error.localizedDescription)"
            return
        }

        discardUnsavedAudio()
        lineIndex = 0
        results = []
        sessionSaved = false
        runStartedAt = Date()
        runFlow()
    }

    func stopRun() {
        flowTask?.cancel()
        flowTask = nil
        synthesizer.stopSpeaking(at: .immediate)
        audioPlayer?.stop()
        recorder?.stop()
        recorder = nil
        if let continuation = playbackContinuation {
            playbackContinuation = nil
            continuation.resume()
        }
        if phase != .finished, phase != .pickLesson {
            phase = lesson == nil ? .pickLesson : .ready
        }
        discardUnsavedAudio()
    }

    private func discardUnsavedAudio() {
        guard !sessionSaved, !sessionAudioFiles.isEmpty else { return }
        AudioStore.delete(sessionAudioFiles)
        sessionAudioFiles = []
    }

    /// Learner taps "Done" mid-recording to cut the capture short.
    func finishRecordingEarly() {
        guard phase == .recording else { return }
        flowTask?.cancel()
        completeCurrentRecording()
        advanceLine()
    }

    // MARK: Flow

    private func runFlow() {
        flowTask?.cancel()
        flowTask = Task { [weak self] in
            guard let self else { return }
            while let line = self.currentLine, !Task.isCancelled {
                self.phase = .playingModel
                await self.playModelLine(line.text)
                guard !Task.isCancelled else { return }

                // Gap countdown before recording.
                var gap = max(0, Int(self.settings.shadowingGapSeconds.rounded()))
                while gap > 0, !Task.isCancelled {
                    self.phase = .gap(gap)
                    try? await Task.sleep(for: .seconds(1))
                    gap -= 1
                }
                guard !Task.isCancelled else { return }

                // Record: give the learner model duration ×1.8 + 1.5s.
                self.phase = .recording
                self.startRecording()
                let recordSeconds = min(20, self.modelDurationMs / 1000 * 1.8 + 1.5)
                try? await Task.sleep(for: .seconds(recordSeconds))
                guard !Task.isCancelled else { return }

                self.completeCurrentRecording()
                self.advanceLine()
            }
        }
    }

    private func advanceLine() {
        lineIndex += 1
        if currentLine == nil {
            phase = .finished
            flowTask?.cancel()
            maybeSaveSession()
        }
    }

    // MARK: Model line playback

    private func playModelLine(_ text: String) async {
        modelPlaybackStart = Date()

        if settings.useOpenAiTts, !settings.realtimeApiKey.trimmed.isEmpty {
            do {
                let data = try await AudioApiClient.speech(
                    apiKey: settings.realtimeApiKey.trimmed,
                    model: settings.ttsModel,
                    voice: settings.ttsVoice,
                    text: text
                )
                try await playAudioData(data)
                return
            } catch {
                // Fall through to system TTS on failure.
            }
        }

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            playbackContinuation = continuation
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
            utterance.rate = 0.48
            synthesizer.speak(utterance)
        }
        modelDurationMs = Date().timeIntervalSince(modelPlaybackStart ?? Date()) * 1000
    }

    private func playAudioData(_ data: Data) async throws {
        let player = try AVAudioPlayer(data: data)
        audioPlayer = player
        modelDurationMs = player.duration * 1000
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            playbackContinuation = continuation
            player.delegate = self
            player.play()
        }
    }

    // MARK: Recording + scoring

    private var captureURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("shadow-capture.m4a")
    }

    private func startRecording() {
        recordingStart = Date()
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 24000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        try? FileManager.default.removeItem(at: captureURL)
        recorder = try? AVAudioRecorder(url: captureURL, settings: settings)
        recorder?.record()
    }

    private func completeCurrentRecording() {
        guard let line = currentLine else { return }
        let captureMs = Date().timeIntervalSince(recordingStart ?? Date()) * 1000
        let modelMs = modelDurationMs
        recorder?.stop()
        recorder = nil

        // Keep the learner's recording locally (same store + cleanup rules as live voice).
        var storedFile: String?
        if settings.saveTranscripts, settings.saveAudio, let saved = AudioStore.saveFile(from: captureURL) {
            storedFile = saved
            sessionAudioFiles.append(saved)
        }

        let apiKey = settings.realtimeApiKey.trimmed
        guard !apiKey.isEmpty else {
            var result = ShadowingScorer.score(
                lineId: line.id, target: line.text, transcript: "",
                modelMs: modelMs, captureMs: captureMs,
                captureFailed: true, captureError: "No API key for transcription"
            )
            result.audioFile = storedFile
            appendResult(result)
            return
        }

        // Copy the capture aside so the next line can reuse the recorder URL.
        let transcribeURL: URL
        if let storedFile {
            transcribeURL = AudioStore.url(for: storedFile)
        } else {
            let captureCopy = FileManager.default.temporaryDirectory
                .appendingPathComponent("shadow-\(line.id)-\(UUID().uuidString).m4a")
            try? FileManager.default.copyItem(at: captureURL, to: captureCopy)
            transcribeURL = captureCopy
        }

        let sttModel = settings.sttModel
        transcribing += 1
        Task { [weak self] in
            defer {
                self?.transcribing -= 1
                if storedFile == nil {
                    try? FileManager.default.removeItem(at: transcribeURL)
                }
            }
            var result: ShadowingLineResult
            do {
                let transcript = try await AudioApiClient.transcribe(
                    apiKey: apiKey, model: sttModel, audioFileURL: transcribeURL
                )
                result = ShadowingScorer.score(
                    lineId: line.id, target: line.text, transcript: transcript,
                    modelMs: modelMs, captureMs: captureMs
                )
            } catch {
                result = ShadowingScorer.score(
                    lineId: line.id, target: line.text, transcript: "",
                    modelMs: modelMs, captureMs: captureMs,
                    captureFailed: true, captureError: error.localizedDescription
                )
            }
            result.audioFile = storedFile
            self?.appendResult(result)
        }
    }

    private func appendResult(_ result: ShadowingLineResult) {
        results.append(result)
        results.sort { lhs, rhs in
            guard let lesson else { return false }
            let order = lesson.lines.map(\.id)
            return (order.firstIndex(of: lhs.lineId) ?? 0) < (order.firstIndex(of: rhs.lineId) ?? 0)
        }
        maybeSaveSession()
    }

    // MARK: Session persistence (mirrors live-voice history)

    private func maybeSaveSession() {
        guard !sessionSaved,
              phase == .finished,
              transcribing == 0,
              settings.saveTranscripts,
              let lesson,
              !results.isEmpty
        else { return }
        sessionSaved = true

        var turns: [ConversationTurn] = []
        for line in lesson.lines {
            turns.append(ConversationTurn(speaker: "Model", role: .ai, text: line.text))
            if let result = results.first(where: { $0.lineId == line.id }) {
                var turn = ConversationTurn(
                    speaker: "You",
                    role: .user,
                    text: result.transcript.isEmpty ? "(no speech captured)" : result.transcript
                )
                turn.audioFile = result.audioFile
                turn.accuracy = result.captureFailed ? nil : result.accuracy
                turns.append(turn)
            }
        }

        SessionStore.shared.add(
            PracticeSession(
                scenarioId: lesson.id,
                scenarioTitle: lesson.title,
                level: HintLevel(rawValue: lesson.level) ?? .intermediate,
                aiRole: "Model",
                userRole: "You",
                kind: .shadowing,
                startedAt: runStartedAt ?? Date(),
                endedAt: Date(),
                turns: turns
            )
        )
        sessionAudioFiles = []
    }
}

extension ShadowingViewModel: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.playbackContinuation?.resume()
            self.playbackContinuation = nil
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.playbackContinuation?.resume()
            self.playbackContinuation = nil
        }
    }
}

extension ShadowingViewModel: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.playbackContinuation?.resume()
            self.playbackContinuation = nil
        }
    }
}
