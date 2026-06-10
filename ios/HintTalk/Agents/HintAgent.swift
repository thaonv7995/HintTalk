import Foundation

/// Port of web `hintAgent.ts` — one "what to say next" suggestion per AI turn.
enum HintAgent {
    private static let maxTranscriptTurns = 160

    private static let systemPrompt = [
        "# Your role",
        "You are **HintTalk Hint Agent** — an offline coaching helper for **English learners** practicing spoken role-play.",
        "Your ONLY job: suggest **one** thing the **human learner** could say **next**, in character.",
        "",
        "You are NOT the voice-session assistant character. The in-world AI partner is described as **aiRole** in the user message JSON — never speak as that character and never continue their dialogue.",
        "You are NOT the learner. Never pretend to be **userRole** in free prose outside the JSON.",
        "Do not grade, score, or correct past learner lines. Do not give long grammar lessons.",
        "",
        "# What you read",
        "The user message is one JSON object. Use especially:",
        "- **conversationTranscriptOrdered**: full dialogue so far (chronological).",
        "- **userRole** / **aiRole** / **goal** / **situationCard**: scene and roles.",
        "- **latestAssistantLine**: what the AI partner last said (may be null at session start).",
        "- **targetHintLevel**: `\"beginner\"` | `\"intermediate\"` | `\"advanced\"` — this is the **only** array you may fill.",
        "- **sessionOpeningOrder**: who was meant to speak first in this session.",
        "",
        "# Task — single hint only",
        "Infer **one best next thing** the learner should say (single conversational move), grounded in **latestAssistantLine** and the transcript.",
        "Put it as **exactly one string** in the array that matches **targetHintLevel**.",
        "Inside that string you may use **one** \\n\\n to split **two short paragraphs** (e.g. main line + optional follow-up clause). Do not paste multiple unrelated sentences.",
        "",
        "# Output format (mandatory — app parses this)",
        "Reply with **one JSON object only**. No markdown fences (no ```). No text before or after the JSON.",
        "Required shape (all four keys MUST appear):",
        "{\"beginner\":[],\"intermediate\":[],\"advanced\":[],\"usefulPhrases\":[]}",
        "Rules:",
        "- Every value is a JSON **array of strings** (never null; use [] when unused).",
        "- Each string is plain text for the UI.",
        "- Put **exactly one non-empty string** in the array named **targetHintLevel** only.",
        "- **beginner**, **intermediate**, **advanced**: all **empty []** except the one matching **targetHintLevel**.",
        "- **usefulPhrases**: **always []** (do not use this field).",
        "",
        "# Style per level",
        "- **beginner**: one natural full sentence (or two short paragraphs with \\n\\n).",
        "- **intermediate**: **only** a handful of **English words or short phrases** (ideas / vocabulary / chunks) the learner might use — **not** a sentence template. Pack **3–8** fragments into **one string**, separated by ** · ** (middle dot + spaces). Example shape: `sorry · running late · just arriving · platform change`. **Forbidden**: blanks, underscores (`___`), brackets with dots, gap-fill, or “complete the sentence”. No full sample dialogue sentence.",
        "- **advanced**: concise cues or keywords only (minimal scaffolding — terse reminders).",
    ].joined(separator: "\n")

    static func generateHint(
        settings: SettingsStore,
        scenario: Scenario,
        level: HintLevel,
        turns: [ConversationTurn],
        currentAiLine: String,
        speaksFirst: SpeaksFirst
    ) async throws -> String {
        let ordered = turns.suffix(maxTranscriptTurns)
        let transcript: [[String: Any]] = ordered.enumerated().map { index, turn in
            ["turn": index + 1, "speaker": turn.speaker, "role": turn.role.rawValue, "text": turn.text]
        }

        let latestAssistantLine = currentAiLine.trimmed.isEmpty
            ? (ordered.reversed().first(where: { $0.role == .ai })?.text.trimmed ?? "")
            : currentAiLine.trimmed

        let payload: [String: Any] = [
            "scenario": scenario.id,
            "title": scenario.title,
            "aiRole": scenario.aiRole,
            "userRole": scenario.userRole,
            "goal": scenario.goal,
            "targetHintLevel": level.rawValue,
            "situationCard": scenario.prompt,
            "sessionOpeningOrder": speaksFirst == .user ? "learner_speaks_first" : "assistant_speaks_first",
            "latestAssistantLine": latestAssistantLine.isEmpty ? NSNull() : latestAssistantLine,
            "conversationTranscriptOrdered": transcript,
            "transcriptTurnCount": transcript.count,
            "transcriptTruncated": turns.count > maxTranscriptTurns,
            "hintUiLimits": ["maxSuggestionCards": 1, "maxUsefulPhraseLines": 0],
        ]
        let payloadJson = String(data: try JSONSerialization.data(withJSONObject: payload), encoding: .utf8) ?? "{}"

        let text = try await ChatCompletionClient.fetch(
            settings: settings,
            messages: [
                ChatMessage(role: "system", content: systemPrompt),
                ChatMessage(
                    role: "user",
                    content: "Below is the HintTalk hint request as JSON. Respond with the required JSON object only.\n\(payloadJson)"
                ),
            ],
            temperature: 0.28,
            maxTokens: 2000,
            jsonMode: true
        )

        guard let parsed = JSONPayload.parse(text) else {
            throw ChatClientError.badPayload("Hint model returned no parseable JSON: \(text.trimmed.prefix(120))")
        }

        // Prefer the requested level; fall back through the rest (port of capPayloadToSingleHint).
        let order = [level.rawValue, "beginner", "intermediate", "advanced"]
        for key in order {
            if let list = parsed[key] as? [Any] {
                let strings = list.compactMap { ($0 as? String).map(cleanHintText) }.filter { !$0.isEmpty }
                if let first = strings.first { return first }
            }
        }
        throw ChatClientError.badPayload("Hint model returned empty hint arrays")
    }

    /// Strips markdown/list debris that some models leak into hint strings
    /// (e.g. `**`, backticks, `3. ` prefixes, stray `").` fragments).
    static func cleanHintText(_ raw: String) -> String {
        let paragraphs = raw
            .components(separatedBy: "\n")
            .map { line -> String in
                var p = line
                    .replacingOccurrences(of: "**", with: "")
                    .replacingOccurrences(of: "`", with: "")
                p = p.replacingOccurrences(
                    of: #"^\s*(?:[-*•]|\d+[.)])\s+"#,
                    with: "",
                    options: .regularExpression
                )
                return p.trimmed
            }
            // Drop fragments with no letters at all (JSON/markdown leftovers).
            .filter { $0.rangeOfCharacter(from: .letters) != nil }
        return paragraphs.joined(separator: "\n\n")
    }
}
