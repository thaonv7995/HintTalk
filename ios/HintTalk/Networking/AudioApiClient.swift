import Foundation

/// OpenAI audio endpoints used by Shadowing: transcription (STT) and speech (TTS).
enum AudioApiClient {
    private static let base = "https://api.openai.com/v1"

    /// POST /v1/audio/transcriptions (multipart) — returns transcribed text.
    static func transcribe(apiKey: String, model: String, audioFileURL: URL) async throws -> String {
        guard let url = URL(string: "\(base)/audio/transcriptions") else { throw ChatClientError.badURL }
        let boundary = "hinttalk-\(UUID().uuidString)"

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("model", model)
        field("language", "en")
        field("response_format", "json")

        let fileData = try Data(contentsOf: audioFileURL)
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"capture.m4a\"\r\nContent-Type: audio/m4a\r\n\r\n".utf8))
        body.append(fileData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw ChatClientError.http(status, String(data: data, encoding: .utf8) ?? "")
        }
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        return (json?["text"] as? String) ?? ""
    }

    /// POST /v1/audio/speech — returns audio bytes (mp3).
    static func speech(apiKey: String, model: String, voice: String, text: String) async throws -> Data {
        guard let url = URL(string: "\(base)/audio/speech") else { throw ChatClientError.badURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": model,
            "input": text,
            "voice": voice,
            "response_format": "mp3",
            "instructions": "Read naturally at a clear, steady pace for an English learner shadowing the line.",
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw ChatClientError.http(status, String(data: data, encoding: .utf8) ?? "")
        }
        return data
    }
}
