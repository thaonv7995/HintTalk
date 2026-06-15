import SwiftUI

/// Setup screen: pick topic, roles, level, opening order → start a live session.
struct LiveVoiceView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Bindable var model: LiveVoiceViewModel
    @State private var showTopicPicker = false
    @State private var showSession = false
    @State private var settings = SettingsStore.shared

    var body: some View {
        NavigationStack {
            ZStack {
                HT.pageGradient.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header

                        if HTLayout.isRegularWidth(horizontalSizeClass) {
                            HStack(alignment: .top, spacing: 16) {
                                VStack(alignment: .leading, spacing: 18) {
                                    topicCard
                                    rolesCard
                                }
                                .frame(maxWidth: .infinity)

                                VStack(alignment: .leading, spacing: 18) {
                                    levelCard
                                    if let error = model.errorMessage {
                                        Text(error)
                                            .font(.footnote)
                                            .foregroundStyle(HT.orange)
                                            .htCard()
                                    }
                                    startButton
                                }
                                .frame(maxWidth: .infinity)
                            }
                        } else {
                            topicCard
                            rolesCard
                            levelCard

                            if let error = model.errorMessage {
                                Text(error)
                                    .font(.footnote)
                                    .foregroundStyle(HT.orange)
                                    .htCard()
                            }

                            startButton
                        }
                    }
                    .htReadableWidth(HTLayout.setupMaxWidth)
                    .htPagePadding()
                    .padding(.bottom, 28)
                }
            }
            .navigationBarHidden(true)
            .fullScreenCover(isPresented: $showSession) {
                LiveVoiceSessionView(model: model)
            }
            .sheet(isPresented: $showTopicPicker) {
                TopicPickerView(selectedId: model.setup.topicPresetId) { preset in
                    model.applyPreset(preset)
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(HT.teal)
                    .frame(width: 34, height: 34)
                    .overlay(
                        Image(systemName: "bubble.left.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(HT.navy)
                    )
                Text("HintTalk")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .foregroundStyle(HT.textLight)
            }
            Text("Live English role-play with an AI partner — hints whisper what to say next.")
                .font(.subheadline)
                .foregroundStyle(HT.textDim)
        }
        .padding(.top, 12)
    }

    private var topicCard: some View {
        Button {
            showTopicPicker = true
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("TOPIC")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(HT.teal)
                        .kerning(1.2)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption)
                        .foregroundStyle(HT.textDim)
                }
                Text(model.currentPreset?.label ?? "Any topic — decide together")
                    .font(.headline)
                    .foregroundStyle(HT.textLight)
                    .multilineTextAlignment(.leading)
                Text(model.scenePreview)
                    .font(.footnote)
                    .foregroundStyle(HT.textDim)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .htCard()
        }
        .buttonStyle(.plain)
    }

    private var rolesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("ROLES")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(HT.teal)
                    .kerning(1.2)
                Spacer()
                Button {
                    model.swapRoles()
                } label: {
                    Label("Swap", systemImage: "arrow.left.arrow.right")
                        .font(.caption.weight(.semibold))
                }
                .foregroundStyle(HT.gold)
            }

            roleField(title: "You speak as", text: $model.setup.userRole, icon: "person.fill")
            roleField(title: "AI speaks as", text: $model.setup.aiRole, icon: "sparkles")
        }
        .htCard()
    }

    private func roleField(title: String, text: Binding<String>, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.footnote)
                .foregroundStyle(HT.teal)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(HT.textDim)
                TextField("Role", text: text)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(HT.textLight)
                    .autocorrectionDisabled()
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(0.25))
        )
    }

    private var levelCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HINT LEVEL")
                .font(.caption2.weight(.bold))
                .foregroundStyle(HT.teal)
                .kerning(1.2)

            Picker("Level", selection: $model.setup.level) {
                ForEach(HintLevel.allCases) { level in
                    Text(level.label).tag(level)
                }
            }
            .pickerStyle(.segmented)

            Text("WHO SPEAKS FIRST")
                .font(.caption2.weight(.bold))
                .foregroundStyle(HT.teal)
                .kerning(1.2)
                .padding(.top, 4)

            Picker("Speaks first", selection: $model.setup.speaksFirst) {
                ForEach(SpeaksFirst.allCases) { order in
                    Text(order.label).tag(order)
                }
            }
            .pickerStyle(.segmented)
        }
        .htCard()
    }

    private var startButton: some View {
        Button {
            showSession = true
            Task { await model.start() }
        } label: {
            HStack {
                Image(systemName: "mic.fill")
                Text("Start live conversation")
                    .fontWeight(.bold)
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(HT.teal)
            )
            .foregroundStyle(HT.navy)
        }
        .disabled(settings.realtimeApiKey.trimmed.isEmpty)
        .opacity(settings.realtimeApiKey.trimmed.isEmpty ? 0.5 : 1)
        .overlay(alignment: .bottom) {
            if settings.realtimeApiKey.trimmed.isEmpty {
                Text("Add your OpenAI API key in Settings to start.")
                    .font(.caption)
                    .foregroundStyle(HT.gold)
                    .offset(y: 24)
            }
        }
        .padding(.bottom, 16)
    }
}
