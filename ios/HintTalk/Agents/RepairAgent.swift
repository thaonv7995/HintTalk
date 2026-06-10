import Foundation

/// Port of web `repairAgent.ts` — decides if a learner line is worth repairing mid-conversation.
enum RepairAgent {
    private static let maxRecentTurns = 18
    private static let maxRepairHistory = 8

    private static let systemPrompt = [
        "# Role",
        "You are HintTalk Repair Gate Agent, a speaking coach inside a live English voice conversation.",
        "",
        "# Core decision",
        "You are NOT a grammar checker. Your main job is to decide whether interrupting the live conversation is worth it.",
        "Most user turns should NOT be repaired.",
        "Repair only when the corrected sentence is clearly useful, reusable, easy to repeat, and improves spoken communication.",
        "",
        "# Do NOT repair",
        "- Short valid replies such as yes, okay, sure, thank you, sounds good, no problem.",
        "- Minor imperfections that do not hurt communication.",
        "- Lines where transcript quality is uncertain.",
        "- Lines that are already natural enough for the learner level.",
        "- Over-polishing or making the learner sound too formal/stiff.",
        "",
        "# Repair when worthwhile",
        "- The learner line is hard to understand.",
        "- Clear grammar blocks natural speech.",
        "- The phrase is direct translation / Vietnamese English.",
        "- The situation needs a more polite or natural spoken formula.",
        "- The repaired sentence is a reusable pattern for this scene.",
        "",
        "# Level behavior",
        "- intermediate: produce one natural, easy-to-repeat sentence. A short Vietnamese explanation is useful.",
        "- advanced: produce a concise, native-like spoken sentence. Explain only the useful pattern, briefly.",
        "",
        "# Output",
        "Return exactly one JSON object. No markdown. No text before or after JSON.",
        "Required shape:",
        "{\"shouldRepair\":false,\"priority\":\"none\",\"reason\":\"good_enough\",\"interruptionRisk\":\"high\",\"original\":\"\",\"repaired\":\"\",\"explanationVi\":\"\"}",
        "",
        "Allowed priority: none, low, medium, high.",
        "Allowed reason: good_enough, too_short, unclear_transcript, minor_issue, grammar, naturalness, politeness, reusable_pattern.",
        "Allowed interruptionRisk: low, medium, high.",
        "If shouldRepair is false, priority should be none or low and repaired/explanationVi should be empty.",
        "If shouldRepair is true, priority must be medium or high, interruptionRisk must not be high, and repaired must be one short spoken English sentence.",
    ].joined(separator: "\n")

    static func evaluate(
        settings: SettingsStore,
        scenario: Scenario,
        level: HintLevel,
        turns: [ConversationTurn],
        latestAssistantLine: String,
        latestUserLine: String,
        recentDecisions: [RepairDecision]
    ) async throws -> RepairDecision {
        guard level != .beginner else { return .noRepair }
        let cleanUserLine = latestUserLine.trimmed
        guard !cleanUserLine.isEmpty else { return .noRepair }

        let payload: [String: Any] = [
            "level": level.rawValue,
            "scenario": [
                "id": scenario.id,
                "title": scenario.title,
                "aiRole": scenario.aiRole,
                "userRole": scenario.userRole,
                "goal": scenario.goal,
                "situationCard": scenario.prompt,
            ],
            "latestAssistantLine": latestAssistantLine.trimmed.isEmpty ? NSNull() : latestAssistantLine.trimmed,
            "latestUserLine": cleanUserLine,
            "recentTurns": turns.suffix(maxRecentTurns).enumerated().map { index, turn in
                ["turn": index + 1, "speaker": turn.speaker, "role": turn.role.rawValue, "text": turn.text]
            },
            "recentRepairDecisions": recentDecisions.suffix(maxRepairHistory).map {
                ["original": $0.original, "repaired": $0.repaired, "shouldRepair": $0.shouldRepair]
            },
            "decisionCriteria": [
                "repairMustBeWorthInterruptingLiveConversation": true,
                "mostTurnsShouldNotBeRepaired": true,
                "repairOnlyIntermediateAndAdvanced": true,
                "oneShortRepeatableSentence": true,
            ],
        ]
        let payloadJson = String(data: try JSONSerialization.data(withJSONObject: payload), encoding: .utf8) ?? "{}"

        let text = try await ChatCompletionClient.fetch(
            settings: settings,
            messages: [
                ChatMessage(role: "system", content: systemPrompt),
                ChatMessage(
                    role: "user",
                    content: "Evaluate this live voice learner turn. Return the required JSON object only.\n\(payloadJson)"
                ),
            ],
            temperature: 0.15,
            maxTokens: 1500,
            jsonMode: true
        )

        guard let o = JSONPayload.parse(text) else { return .noRepair }

        let shouldRepair = o["shouldRepair"] as? Bool ?? false
        let priority = RepairDecision.Priority(rawValue: o["priority"] as? String ?? "") ?? (shouldRepair ? .medium : .none)
        let risk = RepairDecision.Risk(rawValue: o["interruptionRisk"] as? String ?? "") ?? (shouldRepair ? .medium : .high)
        let repaired = (o["repaired"] as? String)?.trimmed ?? ""

        guard shouldRepair, !repaired.isEmpty else { return .noRepair }

        return RepairDecision(
            shouldRepair: true,
            priority: priority,
            reason: o["reason"] as? String ?? "naturalness",
            interruptionRisk: risk,
            original: (o["original"] as? String)?.trimmed ?? cleanUserLine,
            repaired: repaired,
            explanationVi: (o["explanationVi"] as? String)?.trimmed ?? ""
        )
    }

    /// Port of `shouldShowRepairDecision` — UI gate.
    static func shouldShow(_ decision: RepairDecision, level: HintLevel, latestUserLine: String) -> Bool {
        guard level != .beginner,
              decision.shouldRepair,
              decision.priority == .medium || decision.priority == .high,
              decision.interruptionRisk != .high,
              !decision.repaired.trimmed.isEmpty
        else { return false }
        let wordCount = latestUserLine.trimmed.split(whereSeparator: \.isWhitespace).count
        return wordCount >= 4
    }
}
