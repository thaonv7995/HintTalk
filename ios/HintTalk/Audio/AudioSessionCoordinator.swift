import AVFoundation

/// Single owner of the shared `AVAudioSession`.
///
/// Live voice, shadowing, and history playback each need different session
/// configurations. When they configured the session themselves we hit
/// category-fighting bugs (quiet output, engine silently stopped). All
/// configuration now goes through this coordinator.
final class AudioSessionCoordinator {
    static let shared = AudioSessionCoordinator()

    enum Mode: Equatable {
        case idle
        /// History review + shadowing model lines — full media volume.
        case playback
        /// Shadowing capture phase.
        case recording
        /// Realtime duplex conversation.
        case liveVoice
    }

    private(set) var mode: Mode = .idle
    /// True when audio is coming out of the built-in speaker/receiver
    /// (the only routes where mic can pick up the AI voice as echo).
    private(set) var isSpeakerRoute = true

    private var routeObserver: NSObjectProtocol?

    private init() {
        updateRoute()
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.updateRoute()
        }
    }

    func activate(_ newMode: Mode) throws {
        guard newMode != .idle else {
            deactivate()
            return
        }
        let session = AVAudioSession.sharedInstance()
        if mode != newMode {
            switch newMode {
            case .idle:
                break
            case .playback:
                try session.setCategory(.playback, mode: .spokenAudio)
            case .recording:
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.defaultToSpeaker, .allowBluetoothHFP]
                )
            case .liveVoice:
                // `.default` mode keeps full media playback volume (`.voiceChat`
                // applies call-style gain reduction). Echo is prevented by mic
                // gating in RealtimeVoiceEngine while AI audio is draining.
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
                )
                try? session.setPreferredSampleRate(48000)
            }
            mode = newMode
        }
        try session.setActive(true)
        updateRoute()
    }

    /// Re-assert the session after a system interruption (call, Siri) ends.
    func reactivate() {
        guard mode != .idle else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    func deactivate() {
        mode = .idle
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func updateRoute() {
        let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
        isSpeakerRoute = outputs.contains {
            $0.portType == .builtInSpeaker || $0.portType == .builtInReceiver
        }
    }
}
