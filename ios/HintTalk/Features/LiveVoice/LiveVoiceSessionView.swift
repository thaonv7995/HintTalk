import SwiftUI

/// Full-screen live session: orb + mic, AI caption with Vietnamese, hint card, repair card.
struct LiveVoiceSessionView: View {
    @Bindable var model: LiveVoiceViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showScene = false
    @State private var showTranscript = false

    var body: some View {
        ZStack {
            HT.pageGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                ScrollView {
                    VStack(spacing: 16) {
                        if model.phase == .connecting {
                            connectingBadge
                        }

                        orbSection

                        captionSection

                        if let repair = model.repair {
                            repairCard(repair)
                        }

                        // Web hides the hint rail entirely in casual companion mode.
                        if !SettingsStore.shared.casualCompanionMode {
                            hintSection
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }

                micBar
                    .padding(.horizontal, 24)
                    .padding(.bottom, 12)
            }

            if let error = model.errorMessage, model.phase != .live {
                errorOverlay(error)
            }
        }
        .sheet(isPresented: $showScene) { sceneSheet }
        .sheet(isPresented: $showTranscript) { transcriptSheet }
        .interactiveDismissDisabled(model.phase == .live || model.phase == .connecting)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                model.end()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(HT.textLight)
                    .padding(10)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(model.currentPreset?.label ?? "Conversation")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(HT.textLight)
                    .lineLimit(1)
                Text("\(model.setup.userRole) ↔ \(model.setup.aiRole)")
                    .font(.caption2)
                    .foregroundStyle(HT.textDim)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                showScene = true
            } label: {
                Image(systemName: "doc.text")
                    .font(.subheadline)
                    .foregroundStyle(HT.teal)
                    .padding(9)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }

            Button {
                showTranscript = true
            } label: {
                Image(systemName: "list.bullet.rectangle")
                    .font(.subheadline)
                    .foregroundStyle(HT.teal)
                    .padding(9)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }
        }
    }

    private var connectingBadge: some View {
        HStack(spacing: 8) {
            ProgressView()
                .tint(HT.teal)
            Text("Connecting to your AI partner…")
                .font(.footnote)
                .foregroundStyle(HT.textDim)
        }
        .padding(.top, 8)
    }

    // MARK: Orb

    private var orbSection: some View {
        OrbView(
            level: max(model.inputLevel, model.outputLevel),
            aiSpeaking: model.micState == .aiSpeaking,
            idle: model.phase != .live
        )
        .frame(height: 230)
        .accessibilityHidden(true)
    }

    // MARK: AI caption

    private var captionSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Circle()
                    .fill(model.micState == .aiSpeaking ? Color(hex: 0x9D8CFF) : HT.teal)
                    .frame(width: 7, height: 7)
                Text(model.setup.aiRole)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HT.teal)
            }
            if model.aiCaption.isEmpty {
                Text(model.phase == .live ? "Listening…" : " ")
                    .font(.body)
                    .foregroundStyle(HT.textDim)
            } else {
                Text(model.aiCaption)
                    .font(.system(.body, design: .serif))
                    .foregroundStyle(HT.textLight)
                    .fixedSize(horizontal: false, vertical: true)
                if !model.aiCaptionVi.isEmpty {
                    Text(model.aiCaptionVi)
                        .font(.footnote)
                        .foregroundStyle(HT.mint.opacity(0.75))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .htCard()
        .animation(.easeOut(duration: 0.2), value: model.aiCaption)
    }

    // MARK: Hint

    private var hintSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill")
                    .font(.caption)
                    .foregroundStyle(HT.gold)
                Text(model.setup.userRole)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HT.gold)
                Spacer()
                if model.hintLoading {
                    ProgressView().controlSize(.mini).tint(HT.gold)
                }
            }

            if let hintError = model.hintError {
                Text("Hint failed: \(hintError)")
                    .font(.caption)
                    .foregroundStyle(HT.orange)
                    .fixedSize(horizontal: false, vertical: true)
            } else if model.hintText.isEmpty {
                Text(SettingsStore.shared.hintAgentConfigured
                    ? "Hints appear after your partner speaks."
                    : "Set a Hint API key in Settings to get suggestions.")
                    .font(.footnote)
                    .foregroundStyle(HT.textDim)
            } else {
                ForEach(model.hintText.components(separatedBy: "\n\n"), id: \.self) { paragraph in
                    Text(paragraph)
                        .font(.system(.callout, design: .rounded).weight(.medium))
                        .foregroundStyle(HT.goldSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !model.hintVi.isEmpty {
                    Text(model.hintVi)
                        .font(.caption)
                        .foregroundStyle(HT.mint.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(HT.gold.opacity(0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(HT.gold.opacity(0.3), lineWidth: 1)
                )
        )
        .animation(.easeOut(duration: 0.2), value: model.hintText)
    }

    // MARK: Repair card

    private func repairCard(_ repair: RepairDecision) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "bandage.fill")
                    .font(.caption)
                    .foregroundStyle(HT.orange)
                Text("SAY IT MORE NATURALLY")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(HT.orange)
                    .kerning(1)
                Spacer()
                Button {
                    model.dismissRepair()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(HT.textDim)
                }
            }
            Text(repair.original)
                .font(.caption)
                .strikethrough(color: HT.textDim)
                .foregroundStyle(HT.textDim)
            Text(repair.repaired)
                .font(.callout.weight(.semibold))
                .foregroundStyle(HT.textLight)
            if !repair.explanationVi.isEmpty {
                Text(repair.explanationVi)
                    .font(.caption)
                    .foregroundStyle(HT.mint.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(HT.orange.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(HT.orange.opacity(0.35), lineWidth: 1)
                )
        )
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: Mic bar

    private var micBar: some View {
        VStack(spacing: 8) {
            Text(micStatusText)
                .font(.caption)
                .foregroundStyle(HT.textDim)

            Button {
                model.toggleMic()
            } label: {
                ZStack {
                    Circle()
                        .fill(micColor.opacity(0.16))
                        .frame(width: 84, height: 84)
                        .overlay(Circle().strokeBorder(micColor.opacity(0.6), lineWidth: 2))

                    if case let .cooldown(remaining) = model.micState {
                        Text("\(remaining)")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(HT.gold)
                            .contentTransition(.numericText())
                    } else {
                        Image(systemName: micIcon)
                            .font(.system(size: 30, weight: .semibold))
                            .foregroundStyle(micColor)
                            .symbolEffect(.variableColor, isActive: model.userIsSpeaking)
                    }
                }
            }
            .disabled(model.phase != .live || model.micState == .aiSpeaking)
        }
        .animation(.snappy, value: model.micState)
    }

    private var micColor: Color {
        switch model.micState {
        case .open: return HT.teal
        case .aiSpeaking: return Color(hex: 0x9D8CFF)
        case .cooldown: return HT.gold
        case .muted: return HT.textDim
        }
    }

    private var micIcon: String {
        switch model.micState {
        case .open: return "mic.fill"
        case .aiSpeaking: return "speaker.wave.2.fill"
        default: return "mic.slash.fill"
        }
    }

    private var micStatusText: String {
        switch model.micState {
        case .open: return model.userIsSpeaking ? "Listening — keep going" : "Your turn — speak naturally"
        case .aiSpeaking: return "\(model.setup.aiRole) is speaking…"
        case let .cooldown(s): return "Think time — mic opens in \(s)s"
        case .muted: return model.phase == .live ? "Mic muted — tap to speak" : " "
        }
    }

    // MARK: Sheets & overlays

    private var sceneSheet: some View {
        NavigationStack {
            ScrollView {
                Text(TopicCatalog.situationScript(
                    preset: model.currentPreset,
                    userRole: model.setup.userRole,
                    aiRole: model.setup.aiRole
                ))
                .font(.callout)
                .foregroundStyle(HT.textLight)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)
            }
            .background(HT.pageGradient.ignoresSafeArea())
            .navigationTitle("Scene")
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large])
        }
    }

    private var transcriptSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if model.turns.isEmpty {
                        Text("No lines yet.")
                            .font(.footnote)
                            .foregroundStyle(HT.textDim)
                    }
                    ForEach(model.turns) { turn in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(turn.speaker)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(turn.role == .ai ? HT.teal : HT.gold)
                            Text(turn.text)
                                .font(.callout)
                                .foregroundStyle(HT.textLight)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .htCard(padding: 10)
                    }
                }
                .padding(16)
            }
            .background(HT.pageGradient.ignoresSafeArea())
            .navigationTitle("Transcript")
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large])
        }
    }

    private func errorOverlay(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title)
                .foregroundStyle(HT.orange)
            Text(message)
                .font(.callout)
                .foregroundStyle(HT.textLight)
                .multilineTextAlignment(.center)
            Button("Close") {
                model.end()
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(HT.teal)
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(HT.navy2)
                .shadow(radius: 30)
        )
        .padding(32)
    }
}
