import Foundation

/// Port of web `shadowingScoring.ts` — bag-of-words accuracy + pace label.
enum ShadowingScorer {
    private static func normalize(_ word: String) -> String {
        word.lowercased()
            .replacingOccurrences(of: "’", with: "")
            .replacingOccurrences(of: "'", with: "")
            .filter { $0.isLetter || $0.isNumber }
    }

    private static func tokenize(_ text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace)
            .map { normalize(String($0)) }
            .filter { !$0.isEmpty }
    }

    private static func pace(modelMs: Double, captureMs: Double) -> ShadowingPace {
        guard modelMs > 0, captureMs > 0 else { return .unknown }
        let ratio = captureMs / modelMs
        if ratio > 1.28 { return .tooSlow }
        if ratio < 0.72 { return .tooFast }
        return .close
    }

    static func score(
        lineId: String,
        target: String,
        transcript: String,
        modelMs: Double,
        captureMs: Double,
        captureFailed: Bool = false,
        captureError: String? = nil
    ) -> ShadowingLineResult {
        let targetWords = tokenize(target)
        var remaining = tokenize(transcript)
        var matched = 0
        var missing: [String] = []

        for word in targetWords {
            if let idx = remaining.firstIndex(of: word) {
                matched += 1
                remaining.remove(at: idx)
            } else {
                missing.append(word)
            }
        }

        let targetSet = Set(targetWords)
        let extra = remaining.filter { !targetSet.contains($0) }
        let denominator = max(targetWords.count, 1)
        let penalty = min(Double(extra.count) / Double(denominator), 0.28)
        let accuracy = max(0, min(1, Double(matched) / Double(denominator) - penalty))

        return ShadowingLineResult(
            lineId: lineId,
            target: target,
            transcript: transcript.trimmed,
            accuracy: accuracy,
            pace: captureFailed ? .unknown : pace(modelMs: modelMs, captureMs: captureMs),
            missingWords: Array(NSOrderedSet(array: missing)).compactMap { $0 as? String }.prefix(8).map { $0 },
            extraWords: Array(NSOrderedSet(array: extra)).compactMap { $0 as? String }.prefix(8).map { $0 },
            captureFailed: captureFailed,
            captureError: captureError
        )
    }
}
