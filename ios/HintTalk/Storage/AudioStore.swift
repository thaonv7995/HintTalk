import Foundation

/// Local store for per-turn conversation audio (mono PCM16 @ 24 kHz written as WAV).
enum AudioStore {
    static let retentionDays = 7

    static var directory: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("audio", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func url(for filename: String) -> URL {
        directory.appendingPathComponent(filename)
    }

    static func exists(_ filename: String?) -> Bool {
        guard let filename else { return false }
        return FileManager.default.fileExists(atPath: url(for: filename).path)
    }

    /// Writes raw PCM16 (24 kHz mono) as a WAV file; returns the stored filename.
    @discardableResult
    static func savePcm(_ pcm: Data, sampleRate: Int = 24000) -> String? {
        guard !pcm.isEmpty else { return nil }
        let filename = "turn-\(UUID().uuidString).wav"
        do {
            try wavData(pcm16: pcm, sampleRate: sampleRate).write(to: url(for: filename), options: .atomic)
            return filename
        } catch {
            return nil
        }
    }

    /// Copies an already-encoded audio file (e.g. shadowing m4a capture) into the store.
    @discardableResult
    static func saveFile(from sourceURL: URL) -> String? {
        let ext = sourceURL.pathExtension.isEmpty ? "m4a" : sourceURL.pathExtension
        let filename = "turn-\(UUID().uuidString).\(ext)"
        do {
            try FileManager.default.copyItem(at: sourceURL, to: url(for: filename))
            return filename
        } catch {
            return nil
        }
    }

    static func delete(_ filenames: [String]) {
        for name in filenames {
            try? FileManager.default.removeItem(at: url(for: name))
        }
    }

    static func deleteAllFiles() {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        for file in files {
            try? FileManager.default.removeItem(at: file)
        }
    }

    /// Total bytes used by stored audio.
    static func totalSizeBytes() -> Int64 {
        let files = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.fileSizeKey]
        )) ?? []
        return files.reduce(Int64(0)) { sum, file in
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            return sum + Int64(size ?? 0)
        }
    }

    static func formattedTotalSize() -> String {
        ByteCountFormatter.string(fromByteCount: totalSizeBytes(), countStyle: .file)
    }

    /// Deletes audio files older than `retentionDays` (frees storage; transcripts stay).
    static func deleteFilesOlderThanRetention() -> Set<String> {
        let cutoff = Date().addingTimeInterval(-Double(retentionDays) * 86400)
        let files = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey]
        )) ?? []
        var deleted: Set<String> = []
        for file in files {
            let modified = (try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            if modified < cutoff {
                try? FileManager.default.removeItem(at: file)
                deleted.insert(file.lastPathComponent)
            }
        }
        return deleted
    }

    // MARK: WAV encoding

    private static func wavData(pcm16: Data, sampleRate: Int) -> Data {
        var data = Data(capacity: pcm16.count + 44)
        let byteRate = UInt32(sampleRate * 2)

        data.append(contentsOf: Array("RIFF".utf8))
        data.appendLE(UInt32(36 + pcm16.count))
        data.append(contentsOf: Array("WAVE".utf8))
        data.append(contentsOf: Array("fmt ".utf8))
        data.appendLE(UInt32(16))            // fmt chunk size
        data.appendLE(UInt16(1))             // PCM
        data.appendLE(UInt16(1))             // mono
        data.appendLE(UInt32(sampleRate))
        data.appendLE(byteRate)
        data.appendLE(UInt16(2))             // block align
        data.appendLE(UInt16(16))            // bits per sample
        data.append(contentsOf: Array("data".utf8))
        data.appendLE(UInt32(pcm16.count))
        data.append(pcm16)
        return data
    }
}

private extension Data {
    mutating func appendLE<T: FixedWidthInteger>(_ value: T) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }
}
