import AVFoundation
import Foundation
import Observation

/// Plays saved per-turn audio — a single line, or the whole conversation in order.
@MainActor
@Observable
final class ConversationPlayer: NSObject {
    private(set) var playingTurnId: String?
    private(set) var isPlayingAll = false

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

    private func playNext() {
        guard isPlayingAll, !queue.isEmpty else {
            stop()
            return
        }
        let turn = queue.removeFirst()
        start(file: turn.audioFile!, turnId: turn.id)
    }

    private func start(file: String, turnId: String) {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default)
        try? session.setActive(true)

        guard let newPlayer = try? AVAudioPlayer(contentsOf: AudioStore.url(for: file)) else {
            if isPlayingAll { playNext() } else { stop() }
            return
        }
        player = newPlayer
        newPlayer.delegate = self
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
