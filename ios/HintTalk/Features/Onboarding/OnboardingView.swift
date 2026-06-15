import SwiftUI
import UIKit

/// First-launch welcome: explains the app and gets the OpenAI key in place,
/// so new users aren't dropped into an empty app that silently can't connect.
struct OnboardingView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var settings = SettingsStore.shared
    @State private var apiKey = ""
    var onDone: () -> Void

    var body: some View {
        ZStack {
            HT.pageGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        VStack(alignment: .leading, spacing: 8) {
                            Image(systemName: "waveform.and.person.filled")
                                .font(.system(size: HTLayout.isRegularWidth(horizontalSizeClass) ? 52 : 44))
                                .foregroundStyle(HT.teal)
                            Text("Welcome to HintTalk")
                                .font(.system(.largeTitle, design: .rounded).weight(.bold))
                                .foregroundStyle(HT.textLight)
                            Text("Practice speaking English out loud — with an AI partner that actually talks back.")
                                .font(.callout)
                                .foregroundStyle(HT.textDim)
                        }
                        .padding(.top, HTLayout.isRegularWidth(horizontalSizeClass) ? 56 : 40)

                        if HTLayout.isRegularWidth(horizontalSizeClass) {
                            HStack(alignment: .top, spacing: 24) {
                                VStack(alignment: .leading, spacing: 18) {
                                    featureRow(
                                        icon: "person.wave.2.fill",
                                        color: HT.teal,
                                        title: "Live role-play",
                                        detail: "Order coffee, ace an interview, chat with a stranger — real voice conversations."
                                    )
                                    featureRow(
                                        icon: "lightbulb.fill",
                                        color: HT.gold,
                                        title: "Hints when you're stuck",
                                        detail: "Suggestions for what to say next, plus gentle fixes for your sentences."
                                    )
                                }
                                featureRow(
                                    icon: "repeat.circle.fill",
                                    color: HT.mint,
                                    title: "Shadowing",
                                    detail: "Listen, repeat, and get accuracy + pace feedback on every line."
                                )
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 18) {
                                featureRow(
                                    icon: "person.wave.2.fill",
                                    color: HT.teal,
                                    title: "Live role-play",
                                    detail: "Order coffee, ace an interview, chat with a stranger — real voice conversations."
                                )
                                featureRow(
                                    icon: "lightbulb.fill",
                                    color: HT.gold,
                                    title: "Hints when you're stuck",
                                    detail: "Suggestions for what to say next, plus gentle fixes for your sentences."
                                )
                                featureRow(
                                    icon: "repeat.circle.fill",
                                    color: HT.mint,
                                    title: "Shadowing",
                                    detail: "Listen, repeat, and get accuracy + pace feedback on every line."
                                )
                            }
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Connect your OpenAI API key")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(HT.textLight)

                            HStack(spacing: 10) {
                                SecureField("sk-…", text: $apiKey)
                                    .autocorrectionDisabled()
                                    .textInputAutocapitalization(.never)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 12)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .fill(Color.white.opacity(0.07))
                                    )
                                    .foregroundStyle(HT.textLight)

                                Button {
                                    if let pasted = UIPasteboard.general.string {
                                        apiKey = pasted.trimmingCharacters(in: .whitespacesAndNewlines)
                                    }
                                } label: {
                                    Image(systemName: "clipboard")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(HT.teal)
                                        .padding(12)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .fill(Color.white.opacity(0.07))
                                        )
                                }
                            }

                            Text("Stored only in your iOS Keychain and sent only to OpenAI. You can change it anytime in Settings.")
                                .font(.caption)
                                .foregroundStyle(HT.textDim)
                        }
                    }
                    .htReadableWidth(680)
                    .htPagePadding()
                    .padding(.bottom, 16)
                }

                VStack(spacing: 10) {
                    Button {
                        settings.realtimeApiKey = apiKey.trimmed
                        onDone()
                    } label: {
                        Text("Start practicing")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 15)
                            .background(RoundedRectangle(cornerRadius: 16).fill(HT.teal))
                            .foregroundStyle(HT.navy)
                    }
                    .disabled(apiKey.trimmed.isEmpty)
                    .opacity(apiKey.trimmed.isEmpty ? 0.5 : 1)

                    Button {
                        onDone()
                    } label: {
                        Text("Skip for now")
                            .font(.subheadline)
                            .foregroundStyle(HT.textDim)
                    }
                }
                .htReadableWidth(680)
                .htPagePadding()
                .padding(.bottom, 16)
            }
        }
    }

    private func featureRow(icon: String, color: Color, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
                .frame(width: 34, height: 34)
                .background(Circle().fill(color.opacity(0.14)))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(HT.textLight)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(HT.textDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
