import AVFoundation
import Foundation
import Observation

@MainActor
@Observable
final class LiveVoiceViewModel {
    enum Phase: Equatable {
        case idle
        case connecting
        case live
        case ended
    }

    enum MicState: Equatable {
        case muted
        case cooldown(Int)
        case open
        case aiSpeaking
    }

    // MARK: Setup (persisted)

    var setup: LiveVoiceSetup {
        didSet { persistSetup() }
    }

    // MARK: Session state

    private(set) var phase: Phase = .idle
    private(set) var micState: MicState = .muted
    private(set) var turns: [ConversationTurn] = []
    private(set) var aiCaption = ""
    private(set) var aiCaptionVi = ""
    private(set) var hintText = ""
    private(set) var hintVi = ""
    private(set) var hintLoading = false
    private(set) var hintError: String?
    private(set) var repair: RepairDecision?
    private(set) var repairVi = ""
    private(set) var userIsSpeaking = false
    private(set) var inputLevel: Float = 0
    private(set) var outputLevel: Float = 0
    private(set) var sessionStartedAt: Date?
    /// True while the engine is retrying after a network drop mid-session.
    private(set) var reconnecting = false
    var errorMessage: String?

    private let settings = SettingsStore.shared
    private var engine: RealtimeVoiceEngine?
    private var scenario: Scenario?
    private var repairHistory: [RepairDecision] = []
    /// Audio files written during this session — deleted if the session isn't saved.
    private var sessionAudioFiles: [String] = []
    private var cooldownTask: Task<Void, Never>?
    private var hintTask: Task<Void, Never>?
    private var repairTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 3

    var currentPreset: TopicPreset? { TopicCatalog.preset(setup.topicPresetId) }

    var scenePreview: String {
        let preset = currentPreset
        let scene = preset?.situation.trimmed ?? ""
        if preset?.id == "open" && scene.isEmpty {
            return "Once you start speaking, jointly pick concrete roles and a backdrop (café queue, taxi line, airport desk, …)."
        }
        return scene.isEmpty ? "Describe the specifics together verbally while staying in-character." : scene
    }

    init() {
        if let data = UserDefaults.standard.data(forKey: "liveVoiceSetup"),
           let saved = try? JSONDecoder().decode(LiveVoiceSetup.self, from: data) {
            setup = saved
        } else {
            setup = LiveVoiceSetup()
        }
    }

    private func persistSetup() {
        if let data = try? JSONEncoder().encode(setup) {
            UserDefaults.standard.set(data, forKey: "liveVoiceSetup")
        }
    }

    func applyPreset(_ preset: TopicPreset) {
        setup.topicPresetId = preset.id
        if !preset.defaultAiRole.isEmpty { setup.aiRole = preset.defaultAiRole }
        if !preset.defaultUserRole.isEmpty { setup.userRole = preset.defaultUserRole }
    }

    func swapRoles() {
        let ai = setup.aiRole
        setup.aiRole = setup.userRole
        setup.userRole = ai
    }

    // MARK: - Session lifecycle

    func start() async {
        guard phase == .idle || phase == .ended else { return }
        errorMessage = nil

        guard !settings.realtimeApiKey.trimmed.isEmpty else {
            errorMessage = "Add your OpenAI Realtime API key in Settings first."
            return
        }

        let granted = await AVAudioApplication.requestRecordPermission()
        guard granted else {
            errorMessage = "Microphone permission is required for live voice practice."
            return
        }

        resetSessionState()
        phase = .connecting
        sessionStartedAt = Date()
        scenario = TopicCatalog.scenario(from: setup)

        openConnection(resume: false)
    }

    private func openConnection(resume: Bool) {
        guard let scenario else { return }

        let engine = RealtimeVoiceEngine()
        self.engine = engine
        wireEngineCallbacks(engine, resume: resume)

        var config = RealtimeVoiceEngine.sessionConfig(
            scenario: scenario,
            level: setup.level,
            voice: settings.realtimeVoice,
            speaksFirst: setup.speaksFirst,
            casualCompanionMode: settings.casualCompanionMode
        )
        if resume, var instructions = config["instructions"] as? String {
            instructions += "\n\n" + resumeContext(scenario: scenario)
            config["instructions"] = instructions
        }
        engine.isMuted = true
        engine.recordsAudio = settings.saveAudio && settings.saveTranscripts
        engine.connect(apiKey: settings.realtimeApiKey.trimmed, model: settings.realtimeModel, sessionConfig: config)
    }

    /// Injected into the system prompt when re-establishing a dropped session
    /// so the AI continues the same scene instead of starting over.
    private func resumeContext(scenario: Scenario) -> String {
        var lines = ["SESSION RESUMED after a brief network drop. The conversation so far:"]
        for turn in turns.suffix(12) {
            let speaker = turn.role == .ai ? scenario.aiRole : scenario.userRole
            lines.append("\(speaker): \(turn.text)")
        }
        lines.append("Continue the same scene naturally from this exact point. Do NOT restart, re-greet, or summarize the conversation.")
        return lines.joined(separator: "\n")
    }

    func end() {
        cooldownTask?.cancel()
        hintTask?.cancel()
        repairTask?.cancel()
        reconnectTask?.cancel()
        reconnecting = false
        engine?.stopPlayback()
        engine?.disconnect()
        engine = nil

        if phase == .live || phase == .connecting {
            saveSessionIfNeeded()
        }
        phase = .ended
        micState = .muted
        inputLevel = 0
        outputLevel = 0
    }

    func reset() {
        end()
        resetSessionState()
        phase = .idle
    }

    func toggleMic() {
        guard phase == .live, let engine else { return }
        switch micState {
        case .open:
            engine.isMuted = true
            micState = .muted
        case .muted, .cooldown:
            cooldownTask?.cancel()
            engine.isMuted = false
            micState = .open
        case .aiSpeaking:
            break
        }
    }

    func dismissRepair() {
        repair = nil
        repairVi = ""
    }

    private func resetSessionState() {
        turns = []
        aiCaption = ""
        aiCaptionVi = ""
        hintText = ""
        hintVi = ""
        hintLoading = false
        hintError = nil
        repair = nil
        repairVi = ""
        repairHistory = []
        userIsSpeaking = false
        sessionAudioFiles = []
        reconnecting = false
        reconnectAttempts = 0
    }

    private func saveSessionIfNeeded() {
        guard settings.saveTranscripts, !turns.isEmpty, let scenario, let startedAt = sessionStartedAt else {
            // Session not persisted — drop any audio written during it.
            AudioStore.delete(sessionAudioFiles)
            sessionAudioFiles = []
            return
        }
        SessionStore.shared.add(
            PracticeSession(
                scenarioId: scenario.id,
                scenarioTitle: scenario.title,
                level: setup.level,
                aiRole: scenario.aiRole,
                userRole: scenario.userRole,
                startedAt: startedAt,
                endedAt: Date(),
                turns: turns
            )
        )
        sessionAudioFiles = []
    }

    // MARK: - Engine wiring

    private func wireEngineCallbacks(_ engine: RealtimeVoiceEngine, resume: Bool = false) {
        engine.onConnected = { [weak self] in
            guard let self else { return }
            self.phase = .live
            self.reconnecting = false
            self.reconnectAttempts = 0

            if resume {
                // Pick the flow back up: if the learner spoke last, the AI owes a reply.
                if self.turns.last?.role == .user {
                    self.engine?.requestResponse()
                    self.micState = .aiSpeaking
                } else {
                    self.finishCooldown()
                }
                return
            }

            if self.setup.speaksFirst == .ai {
                self.engine?.requestResponse()
                self.micState = .aiSpeaking
            } else {
                self.engine?.isMuted = false
                self.micState = .open
            }
            // Web generates an opening hint as soon as the session goes live,
            // before any AI line exists (LiveVoiceSessionPage `hintedLiveOnceRef`).
            self.generateHint(currentAiLine: "")
        }

        engine.onAiResponseStarted = { [weak self] in
            guard let self else { return }
            self.cooldownTask?.cancel()
            self.engine?.isMuted = true
            self.micState = .aiSpeaking
            self.aiCaption = ""
            self.aiCaptionVi = ""
        }

        engine.onAiTranscriptDelta = { [weak self] delta in
            self?.aiCaption += delta
        }

        engine.onAiTranscriptDone = { [weak self] transcript in
            self?.handleAiTurnFinished(transcript)
        }

        engine.onAiAudioFinished = { [weak self] in
            self?.startCooldown()
        }

        engine.onUserTranscript = { [weak self] transcript, audio in
            self?.handleUserTranscript(transcript, audio: audio)
        }

        engine.onAiAudioCaptured = { [weak self] audio in
            self?.attachAudioToLastAiTurn(audio)
        }

        engine.onUserSpeakingChanged = { [weak self] speaking in
            self?.userIsSpeaking = speaking
        }

        engine.onLevels = { [weak self] input, output in
            self?.inputLevel = input
            self?.outputLevel = output
        }

        engine.onError = { [weak self] message in
            guard let self else { return }
            // Transient socket drops are handled by the reconnect path below.
            if self.phase == .live, message.hasPrefix("Connection lost") { return }
            self.errorMessage = message
        }

        engine.onDisconnected = { [weak self] in
            guard let self, self.phase == .live || self.phase == .connecting else { return }
            self.handleDisconnect()
        }
    }

    /// Network drop mid-session: retry with backoff and restore the scene
    /// context instead of killing the session.
    private func handleDisconnect() {
        guard phase == .live, reconnectAttempts < maxReconnectAttempts else {
            if reconnecting {
                errorMessage = "Connection lost. Your conversation was saved to History."
            }
            end()
            return
        }
        reconnectAttempts += 1
        reconnecting = true
        micState = .muted
        cooldownTask?.cancel()
        engine?.disconnect()
        engine = nil

        let attempt = reconnectAttempts
        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Double(attempt)))
            guard let self, !Task.isCancelled, self.phase == .live, self.reconnecting else { return }
            self.openConnection(resume: true)
        }
    }

    // MARK: - Turn handling

    private func handleAiTurnFinished(_ transcript: String) {
        let text = transcript.trimmed
        guard !text.isEmpty, let scenario else { return }
        aiCaption = text
        turns.append(ConversationTurn(speaker: scenario.aiRole, role: .ai, text: text))

        if settings.showAiCaptionVi, settings.hintAgentConfigured {
            Task { [weak self] in
                guard let self else { return }
                let vi = await TranslateAgent.toVietnamese(settings: self.settings, english: text)
                if self.aiCaption == text { self.aiCaptionVi = vi }
            }
        }

        generateHint(currentAiLine: text)
    }

    private func handleUserTranscript(_ transcript: String, audio: Data?) {
        guard let scenario else { return }
        var turn = ConversationTurn(speaker: scenario.userRole, role: .user, text: transcript)
        if let audio, let filename = AudioStore.savePcm(audio) {
            turn.audioFile = filename
            sessionAudioFiles.append(filename)
        }
        turns.append(turn)

        // Same gates as web `repairEnabled` + pre-call word count check.
        guard settings.repairMySentence,
              !settings.casualCompanionMode,
              setup.level != .beginner,
              settings.hintAgentConfigured,
              transcript.trimmed.split(whereSeparator: \.isWhitespace).count >= 4
        else { return }
        let latestAiLine = turns.last(where: { $0.role == .ai })?.text ?? ""
        let history = repairHistory
        let level = setup.level
        let turnsSnapshot = turns

        repairTask?.cancel()
        repairTask = Task { [weak self] in
            guard let self else { return }
            do {
                let decision = try await RepairAgent.evaluate(
                    settings: self.settings,
                    scenario: scenario,
                    level: level,
                    turns: turnsSnapshot,
                    latestAssistantLine: latestAiLine,
                    latestUserLine: transcript,
                    recentDecisions: history
                )
                guard !Task.isCancelled else { return }
                self.repairHistory.append(decision)
                if RepairAgent.shouldShow(decision, level: level, latestUserLine: transcript) {
                    self.repair = decision
                    self.repairVi = decision.explanationVi
                    // Web clears the hint card while a repair card is showing.
                    self.hintTask?.cancel()
                    self.hintText = ""
                    self.hintVi = ""
                    self.hintLoading = false
                }
            } catch {
                // Repair is best-effort; stay silent on failure.
            }
        }
    }

    private func attachAudioToLastAiTurn(_ audio: Data) {
        guard let index = turns.lastIndex(where: { $0.role == .ai && $0.audioFile == nil }),
              let filename = AudioStore.savePcm(audio)
        else { return }
        turns[index].audioFile = filename
        sessionAudioFiles.append(filename)
    }

    private func generateHint(currentAiLine: String) {
        // Web disables the hint agent entirely in casual companion mode.
        guard !settings.casualCompanionMode, settings.hintAgentConfigured, let scenario else { return }
        hintTask?.cancel()
        hintLoading = true
        hintError = nil
        let level = setup.level
        let speaksFirst = setup.speaksFirst
        let turnsSnapshot = turns

        hintTask = Task { [weak self] in
            guard let self else { return }
            defer { self.hintLoading = false }
            do {
                let hint = try await HintAgent.generateHint(
                    settings: self.settings,
                    scenario: scenario,
                    level: level,
                    turns: turnsSnapshot,
                    currentAiLine: currentAiLine,
                    speaksFirst: speaksFirst
                )
                guard !Task.isCancelled else { return }
                self.hintText = hint
                self.hintVi = ""
                self.hintError = nil
                if self.settings.showHintVi {
                    let vi = await TranslateAgent.toVietnamese(settings: self.settings, english: hint)
                    if !Task.isCancelled, self.hintText == hint { self.hintVi = vi }
                }
            } catch {
                if !Task.isCancelled {
                    self.hintText = ""
                    self.hintError = error.localizedDescription
                }
            }
        }
    }

    // MARK: - Cooldown (rate-limit friendly pause after each AI reply)

    private func startCooldown() {
        guard phase == .live else { return }
        cooldownTask?.cancel()
        let total = max(0, Int(settings.realtimeCooldownSeconds.rounded()))

        guard total > 0 else {
            finishCooldown()
            return
        }

        micState = .cooldown(total)
        cooldownTask = Task { [weak self] in
            var remaining = total
            while remaining > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled, let self, self.phase == .live else { return }
                remaining -= 1
                self.micState = .cooldown(remaining)
            }
            self?.finishCooldown()
        }
    }

    private func finishCooldown() {
        guard phase == .live else { return }
        if settings.micHandsFree {
            engine?.isMuted = false
            micState = .open
        } else {
            micState = .muted
        }
    }
}
