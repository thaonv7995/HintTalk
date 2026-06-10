import Foundation
import Observation

/// Mirrors web `StoredSettings` — API keys live in Keychain, the rest in UserDefaults.
@Observable
final class SettingsStore {
    static let shared = SettingsStore()

    // MARK: Realtime

    var realtimeApiKey: String {
        didSet { Keychain.set(realtimeApiKey, for: "realtimeApiKey") }
    }
    var realtimeModel: String { didSet { save("realtimeModel", realtimeModel) } }
    var realtimeVoice: String { didSet { save("realtimeVoice", realtimeVoice) } }
    var realtimeCooldownSeconds: Double { didSet { save("realtimeCooldownSeconds", realtimeCooldownSeconds) } }

    // MARK: Hint / coaching model

    var hintApiKey: String {
        didSet { Keychain.set(hintApiKey, for: "hintApiKey") }
    }
    var hintBaseUrl: String { didSet { save("hintBaseUrl", hintBaseUrl) } }
    var hintModel: String { didSet { save("hintModel", hintModel) } }

    // MARK: Live voice UX

    var showAiCaptionVi: Bool { didSet { save("showAiCaptionVi", showAiCaptionVi) } }
    var showHintVi: Bool { didSet { save("showHintVi", showHintVi) } }
    var micHandsFree: Bool { didSet { save("micHandsFree", micHandsFree) } }
    var repairMySentence: Bool { didSet { save("repairMySentence", repairMySentence) } }
    var casualCompanionMode: Bool { didSet { save("casualCompanionMode", casualCompanionMode) } }
    var saveTranscripts: Bool { didSet { save("saveTranscripts", saveTranscripts) } }
    /// Record per-line conversation audio locally for review playback.
    var saveAudio: Bool { didSet { save("saveAudio", saveAudio) } }
    /// Auto-delete stored audio after `AudioStore.retentionDays` to free storage.
    var autoDeleteAudio: Bool { didSet { save("autoDeleteAudio", autoDeleteAudio) } }

    // MARK: Shadowing

    var sttModel: String { didSet { save("sttModel", sttModel) } }
    var shadowingGapSeconds: Double { didSet { save("shadowingGapSeconds", shadowingGapSeconds) } }
    var useOpenAiTts: Bool { didSet { save("useOpenAiTts", useOpenAiTts) } }
    var ttsModel: String { didSet { save("ttsModel", ttsModel) } }
    var ttsVoice: String { didSet { save("ttsVoice", ttsVoice) } }

    /// Hint key falls back to the Realtime OpenAI key when the base URL is OpenAI,
    /// so a single key is enough to power the whole app.
    var effectiveHintApiKey: String {
        if !hintApiKey.trimmed.isEmpty { return hintApiKey.trimmed }
        if hintBaseUrl.contains("api.openai.com") { return realtimeApiKey.trimmed }
        return ""
    }

    /// Hint agent is usable only when key + model + base URL are set.
    var hintAgentConfigured: Bool {
        !effectiveHintApiKey.isEmpty && !hintModel.trimmed.isEmpty && !hintBaseUrl.trimmed.isEmpty
    }

    private init() {
        let d = UserDefaults.standard
        realtimeApiKey = Keychain.get("realtimeApiKey")
        realtimeModel = d.string(forKey: "realtimeModel") ?? "gpt-realtime-mini"
        realtimeVoice = d.string(forKey: "realtimeVoice") ?? "marin"
        realtimeCooldownSeconds = d.object(forKey: "realtimeCooldownSeconds") as? Double ?? 5
        hintApiKey = Keychain.get("hintApiKey")
        hintBaseUrl = d.string(forKey: "hintBaseUrl") ?? "https://api.openai.com/v1"
        hintModel = d.string(forKey: "hintModel") ?? "gpt-4o-mini"
        showAiCaptionVi = d.object(forKey: "showAiCaptionVi") as? Bool ?? true
        showHintVi = d.object(forKey: "showHintVi") as? Bool ?? true
        micHandsFree = d.object(forKey: "micHandsFree") as? Bool ?? true
        repairMySentence = d.object(forKey: "repairMySentence") as? Bool ?? true
        casualCompanionMode = d.object(forKey: "casualCompanionMode") as? Bool ?? false
        saveTranscripts = d.object(forKey: "saveTranscripts") as? Bool ?? true
        saveAudio = d.object(forKey: "saveAudio") as? Bool ?? true
        autoDeleteAudio = d.object(forKey: "autoDeleteAudio") as? Bool ?? true
        sttModel = d.string(forKey: "sttModel") ?? "gpt-4o-mini-transcribe"
        shadowingGapSeconds = d.object(forKey: "shadowingGapSeconds") as? Double ?? 3
        useOpenAiTts = d.object(forKey: "useOpenAiTts") as? Bool ?? false
        ttsModel = d.string(forKey: "ttsModel") ?? "gpt-4o-mini-tts"
        ttsVoice = d.string(forKey: "ttsVoice") ?? "alloy"
    }

    private func save(_ key: String, _ value: Any) {
        UserDefaults.standard.set(value, forKey: key)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
