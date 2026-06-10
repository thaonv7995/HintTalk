import Foundation

/// Loads the bundled topic catalog and builds situation scripts / scenarios
/// (port of web `liveVoiceTopics/situationScript.ts` + `liveVoiceFreeScenario.ts`).
enum TopicCatalog {
    static let categories: [TopicCategory] = {
        guard let url = Bundle.main.url(forResource: "topics", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(TopicCatalogFile.self, from: data)
        else { return [] }
        return file.categories
    }()

    static let shadowingLessons: [ShadowingLesson] = {
        guard let url = Bundle.main.url(forResource: "shadowingLessons", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(ShadowingLessonsFile.self, from: data)
        else { return [] }
        return file.lessons
    }()

    static func preset(_ id: String) -> TopicPreset? {
        for category in categories {
            if let preset = category.topics.first(where: { $0.id == id }) {
                return preset
            }
        }
        return nil
    }

    static func category(forPreset presetId: String) -> TopicCategory? {
        categories.first { $0.topics.contains(where: { $0.id == presetId }) }
    }

    private static let registerNotes: [String: String] = [
        "free": "flexible tone — mirror the learner after they pick direction",
        "casual": "relaxed contractions friendly small talk pacing",
        "neutral": "clear everyday polite English understandable in service encounters",
        "formal": "courteous complete sentences respectful address",
        "clinical": "calm healthcare English empathy without exceeding professional scope",
        "empathetic": "warm validating language while solving the issue constructively",
    ]

    private static func userSpeakingLine(_ label: String) -> String {
        let trimmed = label.trimmed
        if trimmed.isEmpty || trimmed.lowercased() == "you" {
            return "Your speaking part: use a concrete role name (Customer, Friend, Date, Patient, …). The word “You” alone is not a role."
        }
        return "You speak as \(trimmed)."
    }

    private static func aiSpeakingLine(_ label: String) -> String {
        let trimmed = label.trimmed
        return trimmed.isEmpty
            ? "The assistant responds as one clear counter-role."
            : "The assistant speaks as \(trimmed)."
    }

    static func situationScript(preset: TopicPreset?, userRole: String, aiRole: String) -> String {
        let isOpen = preset?.id == "open"
        let scene = preset?.situation.trimmed ?? ""

        var lines: [String] = ["Scene"]
        if isOpen && scene.isEmpty {
            lines.append("Once you start speaking, jointly pick concrete roles and a backdrop (café queue, taxi line, coworking tour, airport desk, …). Invent details verbally as you talk.")
        } else if !scene.isEmpty {
            lines.append(scene)
        } else {
            lines.append("Describe the specifics together verbally while staying in-character.")
        }
        lines.append("")
        lines.append(userSpeakingLine(userRole))
        lines.append("")
        lines.append(aiSpeakingLine(aiRole))

        if let preset, !isOpen, let category = category(forPreset: preset.id) {
            let tone = !preset.register.isEmpty ? preset.register : category.registerDefault
            lines.append("")
            lines.append("Register (\(tone))")
            lines.append(registerNotes[tone] ?? registerNotes["neutral"]!)

            lines.append("")
            lines.append("Learner guide — practice aims")
            for bullet in category.learnerGuide + preset.learnerExtras {
                lines.append("• \(bullet)")
            }

            lines.append("")
            lines.append("AI guide — embody the role realistically")
            for bullet in category.aiGuide + preset.aiExtras {
                lines.append("• \(bullet)")
            }

            lines.append("")
            lines.append("Preset label")
            lines.append(preset.label)
        }

        return lines.joined(separator: "\n")
    }

    /// Builds the effective scenario for Realtime + agents from a live-voice setup.
    static func scenario(from setup: LiveVoiceSetup) -> Scenario {
        let preset = preset(setup.topicPresetId)
        let topic = preset?.situation.trimmed ?? ""
        let aiRole = setup.aiRole.trimmed.isEmpty ? "Conversation partner" : setup.aiRole.trimmed
        let userRole = setup.userRole.trimmed.isEmpty ? "Learner" : setup.userRole.trimmed

        let script = situationScript(preset: preset, userRole: userRole, aiRole: aiRole)
        let title = preset?.label ?? (topic.isEmpty ? "Conversation" : String(topic.prefix(72)))
        let sceneFragment = topic.isEmpty ? "" : "Scene: \(topic). "

        return Scenario(
            id: setup.topicPresetId,
            title: title,
            aiRole: aiRole,
            userRole: userRole,
            goal: "Speak in English in a natural back-and-forth (not one rigid Q&A line each turn). \(sceneFragment)Roles: AI “\(aiRole)”, learner “\(userRole)”. Stay in character; react and build on what they say; adapt if they change topic or ask for a new role-play.",
            prompt: script
        )
    }
}
