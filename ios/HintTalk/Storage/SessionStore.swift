import Foundation
import Observation

/// Persists practice sessions as JSON in Documents (mirrors web `hinttalk.sessions.v1`, max 100).
@Observable
final class SessionStore {
    static let shared = SessionStore()
    private static let maxSessions = 100

    private(set) var sessions: [PracticeSession] = []

    private var fileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("sessions.json")
    }

    private init() {
        load()
        if SettingsStore.shared.autoDeleteAudio {
            cleanupExpiredAudio()
        }
    }

    func add(_ session: PracticeSession) {
        sessions.insert(session, at: 0)
        if sessions.count > Self.maxSessions {
            let evicted = sessions.suffix(from: Self.maxSessions)
            AudioStore.delete(evicted.flatMap { $0.turns.compactMap(\.audioFile) })
            sessions = Array(sessions.prefix(Self.maxSessions))
        }
        persist()
    }

    func delete(at offsets: IndexSet) {
        let removed = offsets.map { sessions[$0] }
        AudioStore.delete(removed.flatMap { $0.turns.compactMap(\.audioFile) })
        sessions.remove(atOffsets: offsets)
        persist()
    }

    func clearAll() {
        AudioStore.delete(sessions.flatMap { $0.turns.compactMap(\.audioFile) })
        sessions = []
        persist()
    }

    /// Deletes all stored audio but keeps transcripts.
    func clearAllAudio() {
        AudioStore.deleteAllFiles()
        stripAudioReferences { _ in true }
    }

    /// Removes audio files older than the retention window and clears dangling references.
    func cleanupExpiredAudio() {
        let deleted = AudioStore.deleteFilesOlderThanRetention()
        guard !deleted.isEmpty else { return }
        stripAudioReferences { deleted.contains($0) }
    }

    private func stripAudioReferences(_ shouldStrip: (String) -> Bool) {
        var changed = false
        for s in sessions.indices {
            for t in sessions[s].turns.indices {
                if let file = sessions[s].turns[t].audioFile, shouldStrip(file) {
                    sessions[s].turns[t].audioFile = nil
                    changed = true
                }
            }
        }
        if changed { persist() }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        sessions = (try? decoder.decode([PracticeSession].self, from: data)) ?? []
    }

    private func persist() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(sessions) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
