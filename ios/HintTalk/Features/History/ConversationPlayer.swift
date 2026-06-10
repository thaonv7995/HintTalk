import AVFoundation
import Foundation
import Observation

/// Plays saved per-turn audio — a single line, or the whole conversation in order.
@MainActor
@Observable
final class ConversationPlayer: NSObject {
    private(set) var playingTurnId: String?
    private(set) var isPlayingAll = false

    /// Review playback speed (applies immediately, persists across turns).
    var playbackRate: Double = 1.0 {
        didSet { player?.rate = Float(playbackRate) }
    }

    private var player: AVAudioPlayer?
    private var queue: [ConversationTurn] = []

    func playAll(_ turns: [ConversationTurn]) {
        stop()
        queue = turns.filter { AudioStore.exists($0.audioFile) }
        guard !queue.isEmpty else { return }
        isPlayingAll = true
        playNext()
    }

    func play(_ turn: ConversationTurn) {
        stop()
        guard let file = turn.audioFile, AudioStore.exists(file) else { return }
        start(file: file, turnId: turn.id)
    }

    func toggle(_ turn: ConversationTurn) {
        if playingTurnId == turn.id, !isPlayingAll {
            stop()
        } else {
            play(turn)
        }
    }

    func stop() {
        player?.stop()
        player = nil
        playingTurnId = nil
        isPlayingAll = false
        queue = []
    }

    /// Call when leaving the screen so the `.playback` session does not linger
    /// and conflict with the live-voice engine's `.playAndRecord` session.
    func releaseAudioSession() {
        stop()
        AudioSessionCoordinator.shared.deactivate()
    }

    private func playNext() {
        guard isPlayingAll, !queue.isEmpty else {
            stop()
            return
        }
        let turn = queue.removeFirst()
        start(file: turn.audioFile!, turnId: turn.id)
    }

    private func start(file: String, turnId: String) {
        try? AudioSessionCoordinator.shared.activate(.playback)

        guard let newPlayer = try? AVAudioPlayer(contentsOf: AudioStore.url(for: file)) else {
            if isPlayingAll { playNext() } else { stop() }
            return
        }
        player = newPlayer
        newPlayer.delegate = self
        newPlayer.enableRate = true
        newPlayer.rate = Float(playbackRate)
        playingTurnId = turnId
        newPlayer.play()
    }
}

extension ConversationPlayer: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if self.isPlayingAll {
                self.playNext()
            } else {
                self.playingTurnId = nil
            }
        }
    }
}
