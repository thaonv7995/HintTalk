import Foundation

struct ChatMessage: Encodable {
    var role: String
    var content: String
}

enum ChatClientError: LocalizedError {
    case badURL
    case http(Int, String)
    case emptyResponse
    case emptyContent(finishReason: String)
    case badPayload(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid hint base URL"
        case let .http(status, body): return "HTTP \(status): \(body.prefix(280))"
        case .emptyResponse: return "Empty model response"
        case let .emptyContent(finishReason): return "Empty model response (finish_reason: \(finishReason))"
        case let .badPayload(detail): return detail
        }
    }
}

/// Port of web `chatCompletion.ts` — calls the OpenAI-compatible endpoint directly (no proxy needed natively).
enum ChatCompletionClient {
    static func fetch(
        settings: SettingsStore,
        messages: [ChatMessage],
        temperature: Double,
        maxTokens: Int? = nil,
        jsonMode: Bool = false
    ) async throws -> String {
        var body: [String: Any] = [
            "model": settings.hintModel,
            "messages": messages.map { ["role": $0.role, "content": $0.content] },
            "temperature": temperature,
        ]
        if let maxTokens { body["max_tokens"] = maxTokens }
        if jsonMode { body["response_format"] = ["type": "json_object"] }

        do {
            return try await send(settings: settings, body: body)
        } catch let ChatClientError.http(400, errorBody) {
            // Newer OpenAI models reject `max_tokens` (want `max_completion_tokens`)
            // and non-default `temperature` — retry once with adjusted params.
            var retryBody = body
            var shouldRetry = false
            if errorBody.contains("max_tokens"), let maxTokens {
                retryBody.removeValue(forKey: "max_tokens")
                retryBody["max_completion_tokens"] = maxTokens
                shouldRetry = true
            }
            if errorBody.contains("temperature") {
                retryBody.removeValue(forKey: "temperature")
                shouldRetry = true
            }
            guard shouldRetry else { throw ChatClientError.http(400, errorBody) }
            return try await send(settings: settings, body: retryBody)
        } catch ChatClientError.emptyContent(finishReason: "length") where maxTokens != nil {
            // Reasoning models burn invisible tokens before emitting text; the cap
            // exhausted before any content appeared. Retry once with a larger budget.
            var retryBody = body
            retryBody.removeValue(forKey: "max_tokens")
            retryBody["max_completion_tokens"] = 8000
            return try await send(settings: settings, body: retryBody)
        }
    }

    /// Streaming variant — `onDelta` receives the full accumulated text after each chunk,
    /// so callers can progressively parse partial output (e.g. show hints early).
    static func fetchStreaming(
        settings: SettingsStore,
        messages: [ChatMessage],
        temperature: Double,
        maxTokens: Int? = nil,
        jsonMode: Bool = false,
        onDelta: @escaping (String) -> Void
    ) async throws -> String {
        var body: [String: Any] = [
            "model": settings.hintModel,
            "messages": messages.map { ["role": $0.role, "content": $0.content] },
            "temperature": temperature,
            "stream": true,
        ]
        if let maxTokens { body["max_tokens"] = maxTokens }
        if jsonMode { body["response_format"] = ["type": "json_object"] }

        do {
            return try await sendStream(settings: settings, body: body, onDelta: onDelta)
        } catch let ChatClientError.http(400, errorBody) {
            var retryBody = body
            var shouldRetry = false
            if errorBody.contains("max_tokens"), let maxTokens {
                retryBody.removeValue(forKey: "max_tokens")
                retryBody["max_completion_tokens"] = maxTokens
                shouldRetry = true
            }
            if errorBody.contains("temperature") {
                retryBody.removeValue(forKey: "temperature")
                shouldRetry = true
            }
            guard shouldRetry else { throw ChatClientError.http(400, errorBody) }
            return try await sendStream(settings: settings, body: retryBody, onDelta: onDelta)
        }
    }

    private static func sendStream(
        settings: SettingsStore,
        body: [String: Any],
        onDelta: @escaping (String) -> Void
    ) async throws -> String {
        let request = try makeRequest(settings: settings, body: body)
        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200 ..< 300).contains(status) else {
            var errorBody = ""
            for try await line in bytes.lines where errorBody.count < 2000 {
                errorBody += line
            }
            throw ChatClientError.http(status, errorBody)
        }

        var accumulated = ""
        var rawFallback = ""
        for try await line in bytes.lines {
            try Task.checkCancellation()
            let trimmedLine = line.trimmed
            guard trimmedLine.hasPrefix("data: ") else {
                // Provider may have ignored `stream: true` and sent a plain JSON body.
                rawFallback += line + "\n"
                continue
            }
            if trimmedLine == "data: [DONE]" { break }
            let jsonStr = String(trimmedLine.dropFirst(6))
            guard
                let chunkData = jsonStr.data(using: .utf8),
                let chunk = (try? JSONSerialization.jsonObject(with: chunkData)) as? [String: Any],
                let choices = chunk["choices"] as? [[String: Any]],
                let delta = choices.first?["delta"] as? [String: Any],
                let piece = delta["content"] as? String,
                !piece.isEmpty
            else { continue }
            accumulated += piece
            onDelta(accumulated)
        }

        let text = accumulated.trimmed
        if !text.isEmpty { return text }

        // Non-streaming fallback body (provider ignored the stream flag).
        if let data = rawFallback.data(using: .utf8),
           let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
           let choices = json["choices"] as? [[String: Any]],
           let message = choices.first?["message"] as? [String: Any],
           let content = (message["content"] as? String)?.trimmed,
           !content.isEmpty {
            return content
        }
        throw ChatClientError.emptyContent(finishReason: "stream")
    }

    private static func makeRequest(settings: SettingsStore, body: [String: Any]) throws -> URLRequest {
        let base = settings.hintBaseUrl.trimmed
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)/chat/completions") else {
            throw ChatClientError.badURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let apiKey = settings.effectiveHintApiKey
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    private static func send(settings: SettingsStore, body: [String: Any]) async throws -> String {
        let request = try makeRequest(settings: settings, body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        let raw = String(data: data, encoding: .utf8) ?? ""
        guard (200 ..< 300).contains(status) else {
            throw ChatClientError.http(status, raw)
        }

        // Some OpenAI-compatible providers reply with an SSE stream even for
        // non-streaming requests (same handling as web `chatCompletion.ts`).
        let contentType = http?.value(forHTTPHeaderField: "Content-Type") ?? ""
        if contentType.contains("text/event-stream") || raw.trimmed.hasPrefix("data:") {
            return try accumulateStream(raw)
        }

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let choices = json["choices"] as? [[String: Any]],
            let firstChoice = choices.first,
            let message = firstChoice["message"] as? [String: Any]
        else {
            throw ChatClientError.badPayload("Unparseable API response: \(raw.trimmed.prefix(200))")
        }

        var content = (message["content"] as? String) ?? ""
        if content.trimmed.isEmpty, let parts = message["content"] as? [[String: Any]] {
            // Providers that return content as an array of typed parts.
            content = parts.compactMap { $0["text"] as? String }.joined()
        }

        let trimmed = content.trimmed
        guard !trimmed.isEmpty else {
            let finishReason = firstChoice["finish_reason"] as? String ?? "unknown"
            throw ChatClientError.emptyContent(finishReason: finishReason)
        }
        return trimmed
    }

    private static func accumulateStream(_ raw: String) throws -> String {
        var accumulated = ""
        for line in raw.split(separator: "\n") {
            let trimmedLine = String(line).trimmed
            guard trimmedLine.hasPrefix("data: "), trimmedLine != "data: [DONE]" else { continue }
            let jsonStr = String(trimmedLine.dropFirst(6))
            guard
                let chunkData = jsonStr.data(using: .utf8),
                let chunk = (try? JSONSerialization.jsonObject(with: chunkData)) as? [String: Any],
                let choices = chunk["choices"] as? [[String: Any]],
                let delta = choices.first?["delta"] as? [String: Any],
                let piece = delta["content"] as? String
            else { continue }
            accumulated += piece
        }
        let text = accumulated.trimmed
        guard !text.isEmpty else { throw ChatClientError.badPayload("Empty stream response") }
        return text
    }

    /// Connection check — GET /models (port of the settings "test" button).
    static func listModels(baseUrl: String, apiKey: String) async throws -> Int {
        let base = baseUrl.trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)/models") else { throw ChatClientError.badURL }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("Bearer \(apiKey.trimmed)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw ChatClientError.http(status, String(data: data, encoding: .utf8) ?? "")
        }
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        return (json?["data"] as? [Any])?.count ?? 0
    }
}

/// Port of web `jsonPayload.ts` — tolerant JSON extraction: strips markdown fences,
/// finds outer braces, and best-effort repairs JSON cut off mid-generation.
enum JSONPayload {
    static func parse(_ text: String) -> [String: Any]? {
        var cleaned = text.trimmed
        if cleaned.hasPrefix("```") {
            cleaned = cleaned
                .replacingOccurrences(of: "```json", with: "")
                .replacingOccurrences(of: "```", with: "")
                .trimmed
        }
        if let direct = decode(cleaned) { return direct }

        // Fall back to the outermost {...} span.
        if let start = cleaned.firstIndex(of: "{") {
            if let end = cleaned.lastIndex(of: "}"), start < end,
               let outer = decode(String(cleaned[start ... end])) {
                return outer
            }
            // Last resort: repair JSON truncated mid-generation (token limit hit).
            return repairTruncated(String(cleaned[start...]))
        }
        return nil
    }

    private static func decode(_ s: String) -> [String: Any]? {
        guard let data = s.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    // MARK: Truncation repair (port of `parseRepairedTruncatedJson`)

    private struct ScanState {
        var stack: [Character] = []
        var inString = false
        var stringStart = -1
    }

    private static func scan(_ chars: [Character]) -> ScanState {
        var state = ScanState()
        var escaped = false
        for (i, ch) in chars.enumerated() {
            if state.inString {
                if escaped {
                    escaped = false
                } else if ch == "\\" {
                    escaped = true
                } else if ch == "\"" {
                    state.inString = false
                }
                continue
            }
            if ch == "\"" {
                state.inString = true
                state.stringStart = i
            } else if ch == "{" || ch == "[" {
                state.stack.append(ch)
            } else if ch == "}" || ch == "]" {
                _ = state.stack.popLast()
            }
        }
        return state
    }

    /// Try to recover truncated JSON by closing open strings/scopes.
    private static func repairTruncated(_ raw: String) -> [String: Any]? {
        let chars = Array(raw)
        let state = scan(chars)
        guard !state.stack.isEmpty || state.inString else { return nil }

        // Two ways to resolve an unterminated string: close it, or drop the partial string.
        let bases: [String] = state.inString
            ? [raw + "\"", String(chars[0 ..< max(state.stringStart, 0)])]
            : [raw]

        for base in bases {
            // Variant 2 additionally drops a dangling `"key":` and trailing separators.
            let dropped = base
                .replacingOccurrences(
                    of: #"("(?:[^"\\]|\\.)*")?\s*:?\s*$"#,
                    with: "",
                    options: .regularExpression
                )
                .replacingOccurrences(of: #"[,\s]+$"#, with: "", options: .regularExpression)

            for variant in [base, dropped] {
                let variantState = scan(Array(variant))
                if variantState.inString { continue }
                let closers = variantState.stack.reversed()
                    .map { $0 == "{" ? "}" : "]" }
                    .joined()
                if let repaired = decode(variant + closers) {
                    return repaired
                }
            }
        }
        return nil
    }
}
