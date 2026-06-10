import SwiftUI

struct SettingsView: View {
    @State private var settings = SettingsStore.shared
    @State private var testState: TestState = .idle
    @State private var audioSize: String = ""

    enum TestState: Equatable {
        case idle
        case testing
        case ok(Int)
        case failed(String)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("OpenAI API key (sk-…)", text: $settings.realtimeApiKey)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    TextField("Model", text: $settings.realtimeModel)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
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
                    SecureField("API key", text: $settings.hintApiKey)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    TextField("Base URL", text: $settings.hintBaseUrl)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    TextField("Model", text: $settings.hintModel)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
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
                    TextField("Transcription model", text: $settings.sttModel)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Toggle("Use OpenAI TTS voice", isOn: $settings.useOpenAiTts)
                    if settings.useOpenAiTts {
                        TextField("TTS model", text: $settings.ttsModel)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        TextField("TTS voice", text: $settings.ttsVoice)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
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
            .onAppear { refreshAudioSize() }
        }
    }

    private func refreshAudioSize() {
        audioSize = AudioStore.formattedTotalSize()
    }

    private var testButton: some View {
        Button {
            testState = .testing
            let baseUrl = settings.hintBaseUrl
            let apiKey = settings.effectiveHintApiKey
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
