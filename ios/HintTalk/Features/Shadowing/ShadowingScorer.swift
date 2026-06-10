import Foundation

/// Port of web `shadowingScoring.ts` — bag-of-words accuracy + pace label.
///
/// Both target and transcript run through the same normalization (contraction
/// expansion, digits→words), so the learner is never penalized when the STT
/// writes "I'm"/"20" while the target says "I am"/"twenty" or vice versa.
enum ShadowingScorer {
    /// Irregular contractions that the suffix rules below can't derive.
    private static let irregularContractions: [String: [String]] = [
        "won't": ["will", "not"],
        "can't": ["can", "not"],
        "cannot": ["can", "not"],
        "shan't": ["shall", "not"],
        "ain't": ["is", "not"],
        "let's": ["let", "us"],
        "gonna": ["going", "to"],
        "wanna": ["want", "to"],
        "gotta": ["got", "to"],
        "kinda": ["kind", "of"],
        "ok": ["okay"],
    ]

    /// Expands one lowercased token (apostrophes intact) into canonical words.
    private static func expandContraction(_ token: String) -> [String] {
        if let words = irregularContractions[token] { return words }
        let suffixes: [(String, [String])] = [
            ("n't", ["not"]),
            ("'ll", ["will"]),
            ("'re", ["are"]),
            ("'ve", ["have"]),
            ("'d", ["would"]),
            ("'m", ["am"]),
            // "'s" is ambiguous (is/has/possessive) but the expansion is applied
            // symmetrically to target and transcript, so matching stays consistent.
            ("'s", ["is"]),
        ]
        for (suffix, expansion) in suffixes where token.hasSuffix(suffix) && token.count > suffix.count {
            return [String(token.dropLast(suffix.count))] + expansion
        }
        return [token]
    }

    private static let ones = [
        "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
        "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
        "seventeen", "eighteen", "nineteen",
    ]
    private static let tens = [
        "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    ]

    /// Spells out 0...9999 the way STT models transcribe spoken numbers.
    private static func numberToWords(_ n: Int) -> [String] {
        switch n {
        case 0 ..< 20:
            return [ones[n]]
        case 20 ..< 100:
            let rest = n % 10
            return rest == 0 ? [tens[n / 10]] : [tens[n / 10], ones[rest]]
        case 100 ..< 1000:
            let rest = n % 100
            return [ones[n / 100], "hundred"] + (rest == 0 ? [] : numberToWords(rest))
        case 1000 ..< 10000:
            let rest = n % 1000
            return numberToWords(n / 1000) + ["thousand"] + (rest == 0 ? [] : numberToWords(rest))
        default:
            return ["\(n)"]
        }
    }

    private static func normalizeToken(_ raw: String) -> [String] {
        let lowered = raw.lowercased().replacingOccurrences(of: "’", with: "'")
        let stripped = String(lowered.filter { $0.isLetter || $0.isNumber || $0 == "'" })
        guard !stripped.isEmpty else { return [] }

        return expandContraction(stripped).flatMap { word -> [String] in
            let clean = word.filter { $0.isLetter || $0.isNumber }
            guard !clean.isEmpty else { return [] }
            if clean.allSatisfy(\.isNumber), let n = Int(clean), n < 10000 {
                return numberToWords(n)
            }
            return [clean]
        }
    }

    private static func tokenize(_ text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace)
            .flatMap { normalizeToken(String($0)) }
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
