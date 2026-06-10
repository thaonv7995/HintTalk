import Foundation
import Speech

/// On-device transcription via SFSpeechRecognizer — faster and free compared to
/// the Whisper API. Used by Shadowing, with the API as fallback.
enum SpeechTranscriber {
    enum TranscriberError: LocalizedError {
        case unavailable
        case notAuthorized

        var errorDescription: String? {
            switch self {
            case .unavailable: return "On-device speech recognition is unavailable"
            case .notAuthorized: return "Speech recognition permission was not granted"
            }
        }
    }

    private static func recognizer() -> SFSpeechRecognizer? {
        SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }

    static var isAvailable: Bool {
        recognizer()?.isAvailable ?? false
    }

    static func requestAuthorization() async -> Bool {
        if SFSpeechRecognizer.authorizationStatus() == .authorized { return true }
        return await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }

    /// Transcribes a recorded audio file, preferring on-device recognition
    /// (no audio leaves the phone when the on-device model is installed).
    static func transcribe(fileURL: URL) async throws -> String {
        guard await requestAuthorization() else { throw TranscriberError.notAuthorized }
        guard let recognizer = recognizer(), recognizer.isAvailable else {
            throw TranscriberError.unavailable
        }

        let request = SFSpeechURLRecognitionRequest(url: fileURL)
        request.shouldReportPartialResults = false
        request.taskHint = .dictation
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        return try await withCheckedThrowingContinuation { continuation in
            var resumed = false
            recognizer.recognitionTask(with: request) { result, error in
                guard !resumed else { return }
                if let error {
                    resumed = true
                    continuation.resume(throwing: error)
                } else if let result, result.isFinal {
                    resumed = true
                    continuation.resume(returning: result.bestTranscription.formattedString)
                }
            }
        }
    }
}
