import Foundation

// MARK: - Core enums

enum HintLevel: String, Codable, CaseIterable, Identifiable {
    case beginner
    case intermediate
    case advanced

    var id: String { rawValue }

    var label: String {
        switch self {
        case .beginner: return "Beginner"
        case .intermediate: return "Intermediate"
        case .advanced: return "Advanced"
        }
    }
}

enum SpeaksFirst: String, Codable, CaseIterable, Identifiable {
    case ai
    case user

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ai: return "AI speaks first"
        case .user: return "I speak first"
        }
    }
}

// MARK: - Conversation

struct ConversationTurn: Identifiable, Codable, Equatable {
    var id: String = UUID().uuidString
    var speaker: String
    var role: TurnRole
    var text: String
    var createdAt: Date = Date()
    /// Filename in the local audio store (per-line recording for review playback).
    var audioFile: String?
    /// Shadowing only: 0...1 accuracy score for this spoken line.
    var accuracy: Double?

    enum TurnRole: String, Codable {
        case ai
        case user
    }
}

enum SessionKind: String, Codable {
    case liveVoice = "live_voice"
    case shadowing
}

struct PracticeSession: Identifiable, Codable {
    var id: String = UUID().uuidString
    var scenarioId: String
    var scenarioTitle: String
    var level: HintLevel
    var aiRole: String
    var userRole: String
    /// nil (legacy) means live voice.
    var kind: SessionKind?
    var startedAt: Date
    var endedAt: Date?
    var turns: [ConversationTurn]

    var isShadowing: Bool { kind == .shadowing }
}

// MARK: - Scenario (effective role-play config fed to Realtime + agents)

struct Scenario {
    var id: String
    var title: String
    var aiRole: String
    var userRole: String
    var goal: String
    /// Full situation script (scene + register + guides) shared with Realtime instructions and agents.
    var prompt: String
}

// MARK: - Topic catalog (bundled JSON)

struct TopicPreset: Codable, Identifiable, Hashable {
    var id: String
    var label: String
    var subtitle: String
    var situation: String
    var defaultUserRole: String
    var defaultAiRole: String
    var register: String
    var learnerExtras: [String]
    var aiExtras: [String]
}

struct TopicCategory: Codable, Identifiable {
    var id: String
    var title: String
    var description: String
    var registerDefault: String
    var learnerGuide: [String]
    var aiGuide: [String]
    var topics: [TopicPreset]
}

struct TopicCatalogFile: Codable {
    var version: Int
    var categories: [TopicCategory]
}

// MARK: - Live voice setup

struct LiveVoiceSetup: Codable, Equatable {
    var topicPresetId: String = "open"
    var aiRole: String = "Conversation partner"
    var userRole: String = "Learner"
    var level: HintLevel = .intermediate
    var speaksFirst: SpeaksFirst = .ai
}

// MARK: - Repair agent

struct RepairDecision: Equatable {
    var shouldRepair: Bool
    var priority: Priority
    var reason: String
    var interruptionRisk: Risk
    var original: String
    var repaired: String
    var explanationVi: String

    enum Priority: String {
        case none, low, medium, high
    }

    enum Risk: String {
        case low, medium, high
    }

    static let noRepair = RepairDecision(
        shouldRepair: false,
        priority: .none,
        reason: "good_enough",
        interruptionRisk: .high,
        original: "",
        repaired: "",
        explanationVi: ""
    )
}

// MARK: - Shadowing

struct ShadowingLine: Codable, Identifiable, Hashable {
    var id: String
    var text: String
    var focusPhrase: String?
}

struct ShadowingLesson: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var level: String
    var genre: String
    var voiceHint: String
    var targetWpm: Int
    var lines: [ShadowingLine]
}

struct ShadowingLessonsFile: Codable {
    var version: Int
    var lessons: [ShadowingLesson]
}

enum ShadowingPace: String {
    case tooSlow = "too_slow"
    case close
    case tooFast = "too_fast"
    case unknown

    var label: String {
        switch self {
        case .tooSlow: return "Too slow"
        case .close: return "On pace"
        case .tooFast: return "Too fast"
        case .unknown: return "—"
        }
    }
}

struct ShadowingLineResult: Identifiable {
    var id: String { lineId }
    var lineId: String
    var target: String
    var transcript: String
    var accuracy: Double
    var pace: ShadowingPace
    var missingWords: [String]
    var extraWords: [String]
    var captureFailed: Bool
    var captureError: String?
    /// Local recording of the learner's attempt (audio store filename).
    var audioFile: String?
}
