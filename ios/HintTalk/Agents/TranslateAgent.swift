import Foundation

/// Port of web `translateLineVi.ts` — Vietnamese captions for live dialogue and hints.
enum TranslateAgent {
    static func toVietnamese(settings: SettingsStore, english: String) async -> String {
        let trimmed = english.trimmed
        guard !trimmed.isEmpty, settings.hintAgentConfigured else { return "" }
        do {
            return try await ChatCompletionClient.fetch(
                settings: settings,
                messages: [
                    ChatMessage(
                        role: "system",
                        content: "You translate English spoken dialogue into natural Vietnamese. Output ONLY the Vietnamese text — no quotes, labels, or explanation."
                    ),
                    ChatMessage(role: "user", content: trimmed),
                ],
                temperature: 0.15,
                maxTokens: 280
            ).trimmed
        } catch {
            return ""
        }
    }
}
