import SwiftUI
import UIKit

struct SettingsView: View {
    @State private var settings = SettingsStore.shared
    @State private var testState: TestState = .idle
    @State private var audioSize: String = ""
    @State private var justSaved = false

    // Text inputs are edited as drafts and persisted only when tapping Save.
    @State private var realtimeApiKey = ""
    @State private var realtimeModel = ""
    @State private var hintApiKey = ""
    @State private var hintBaseUrl = ""
    @State private var hintModel = ""
    @State private var sttModel = ""
    @State private var ttsModel = ""
    @State private var ttsVoice = ""

    enum TestState: Equatable {
        case idle
        case testing
        case ok(Int)
        case failed(String)
    }

    private var hasChanges: Bool {
        realtimeApiKey != settings.realtimeApiKey
            || realtimeModel != settings.realtimeModel
            || hintApiKey != settings.hintApiKey
            || hintBaseUrl != settings.hintBaseUrl
            || hintModel != settings.hintModel
            || sttModel != settings.sttModel
            || ttsModel != settings.ttsModel
            || ttsVoice != settings.ttsVoice
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PasteField(placeholder: "OpenAI API key (sk-…)", text: $realtimeApiKey, secure: true)
                    PasteField(placeholder: "Model", text: $realtimeModel)
                    Picker("Voice", selection: $settings.realtimeVoice) {
                        ForEach(["marin", "cedar", "alloy", "echo", "shimmer", "verse", "coral", "sage"], id: \.self) {
                            Text($0.capitalized).tag($0)
                        }
                    }
                    VStack(alignment: .leading) {
                        Text("Think time after AI reply: \(Int(settings.realtimeCooldownSeconds))s")
                            .font(.subheadline)
                        Slider(value: $settings.realtimeCooldownSeconds, in: 0 ... 15, step: 1)
                    }
                } header: {
                    Text("Live voice (Realtime)")
                } footer: {
                    Text("Your key is stored in the iOS Keychain and sent only to OpenAI.")
                }

                Section {
                    PasteField(placeholder: "API key", text: $hintApiKey, secure: true)
                    PasteField(placeholder: "Base URL", text: $hintBaseUrl, keyboard: .URL)
                    PasteField(placeholder: "Model", text: $hintModel)
                    testButton
                } header: {
                    Text("Hint & coaching model")
                } footer: {
                    Text("Powers hints, sentence repair, and Vietnamese captions. Any OpenAI-compatible endpoint works. Leave the key empty to reuse your Realtime OpenAI key.")
                }

                Section("Live voice experience") {
                    Toggle("Vietnamese captions under AI lines", isOn: $settings.showAiCaptionVi)
                    Toggle("Vietnamese under hints", isOn: $settings.showHintVi)
                    Toggle("Hands-free mic (auto-unmute)", isOn: $settings.micHandsFree)
                    Toggle("Repair my sentence", isOn: $settings.repairMySentence)
                    Toggle("Casual companion mode", isOn: $settings.casualCompanionMode)
                }

                Section("Shadowing") {
                    VStack(alignment: .leading) {
                        Text("Gap before recording: \(Int(settings.shadowingGapSeconds))s")
                            .font(.subheadline)
                        Slider(value: $settings.shadowingGapSeconds, in: 1 ... 8, step: 1)
                    }
                    PasteField(placeholder: "Transcription model", text: $sttModel)
                    Toggle("Use OpenAI TTS voice", isOn: $settings.useOpenAiTts)
                    if settings.useOpenAiTts {
                        PasteField(placeholder: "TTS model", text: $ttsModel)
                        PasteField(placeholder: "TTS voice", text: $ttsVoice)
                    }
                }

                Section {
                    Toggle("Save transcripts", isOn: $settings.saveTranscripts)
                    Toggle("Record conversation audio", isOn: $settings.saveAudio)
                        .disabled(!settings.saveTranscripts)
                    Toggle("Auto-delete audio after \(AudioStore.retentionDays) days", isOn: $settings.autoDeleteAudio)
                    LabeledContent("Audio storage used", value: audioSize)
                    Button("Clear all audio", role: .destructive) {
                        SessionStore.shared.clearAllAudio()
                        refreshAudioSize()
                    }
                    Button("Clear session history", role: .destructive) {
                        SessionStore.shared.clearAll()
                        refreshAudioSize()
                    }
                } header: {
                    Text("Data & storage")
                } footer: {
                    Text("Each spoken line is saved locally so you can replay and review your speaking in History. Audio never leaves this device.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(HT.pageGradient.ignoresSafeArea())
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    saveButton
                }
            }
            .onAppear {
                loadDrafts()
                refreshAudioSize()
            }
        }
    }

    private var saveButton: some View {
        Button {
            saveDrafts()
        } label: {
            if justSaved {
                Label("Saved", systemImage: "checkmark.circle.fill")
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(.green)
            } else {
                Text("Save")
                    .fontWeight(.semibold)
            }
        }
        .disabled(!hasChanges && !justSaved)
    }

    private func loadDrafts() {
        realtimeApiKey = settings.realtimeApiKey
        realtimeModel = settings.realtimeModel
        hintApiKey = settings.hintApiKey
        hintBaseUrl = settings.hintBaseUrl
        hintModel = settings.hintModel
        sttModel = settings.sttModel
        ttsModel = settings.ttsModel
        ttsVoice = settings.ttsVoice
    }

    private func saveDrafts() {
        settings.realtimeApiKey = realtimeApiKey.trimmed
        settings.realtimeModel = realtimeModel.trimmed
        settings.hintApiKey = hintApiKey.trimmed
        settings.hintBaseUrl = hintBaseUrl.trimmed
        settings.hintModel = hintModel.trimmed
        settings.sttModel = sttModel.trimmed
        settings.ttsModel = ttsModel.trimmed
        settings.ttsVoice = ttsVoice.trimmed
        loadDrafts()

        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        withAnimation { justSaved = true }
        Task {
            try? await Task.sleep(for: .seconds(2))
            withAnimation { justSaved = false }
        }
    }

    private func refreshAudioSize() {
        audioSize = AudioStore.formattedTotalSize()
    }

    private var testButton: some View {
        Button {
            testState = .testing
            // Test with the on-screen draft values so users can verify before saving.
            let baseUrl = hintBaseUrl.trimmed
            let key = hintApiKey.trimmed
            let apiKey = !key.isEmpty
                ? key
                : (baseUrl.contains("api.openai.com") ? realtimeApiKey.trimmed : "")
            Task {
                do {
                    let count = try await ChatCompletionClient.listModels(baseUrl: baseUrl, apiKey: apiKey)
                    testState = .ok(count)
                } catch {
                    testState = .failed(error.localizedDescription)
                }
            }
        } label: {
            HStack {
                Text("Test connection")
                Spacer()
                switch testState {
                case .idle:
                    EmptyView()
                case .testing:
                    ProgressView().controlSize(.small)
                case let .ok(count):
                    Label("\(count) models", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                case .failed:
                    Label("Failed", systemImage: "xmark.circle.fill")
                        .foregroundStyle(HT.orange)
                        .font(.caption)
                }
            }
        }
        .disabled(testState == .testing)
    }
}

/// Text/secure input row with a one-tap paste button.
private struct PasteField: View {
    let placeholder: String
    @Binding var text: String
    var secure = false
    var keyboard: UIKeyboardType = .default

    var body: some View {
        HStack(spacing: 10) {
            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .keyboardType(keyboard)

            Button {
                if let pasted = UIPasteboard.general.string {
                    text = pasted.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            } label: {
                Image(systemName: "clipboard")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Paste \(placeholder)")
        }
    }
}
