import SwiftUI

struct ShadowingView: View {
    @State private var model = ShadowingViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                HT.pageGradient.ignoresSafeArea()

                switch model.phase {
                case .pickLesson:
                    lessonList
                case .finished:
                    ShadowingResultsView(model: model)
                default:
                    runView
                }
            }
            .navigationBarHidden(true)
        }
    }

    // MARK: Lesson picker

    private var lessonList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Shadowing")
                        .font(.system(.title2, design: .rounded).weight(.bold))
                        .foregroundStyle(HT.textLight)
                    Text("Listen to a model line, repeat it aloud, and get accuracy + pace feedback.")
                        .font(.subheadline)
                        .foregroundStyle(HT.textDim)
                }
                .padding(.top, 12)

                ForEach(model.lessons) { lesson in
                    Button {
                        model.select(lesson)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(lesson.title)
                                    .font(.headline)
                                    .foregroundStyle(HT.textLight)
                                Spacer()
                                Text(lesson.level.capitalized)
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Capsule().fill(HT.teal.opacity(0.18)))
                                    .foregroundStyle(HT.teal)
                            }
                            Text("\(lesson.lines.count) lines · \(lesson.genre) · ~\(lesson.targetWpm) wpm")
                                .font(.caption)
                                .foregroundStyle(HT.textDim)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .htCard()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
    }

    // MARK: Run screen

    private var runView: some View {
        VStack(spacing: 18) {
            HStack {
                Button {
                    model.backToLessons()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(HT.textLight)
                        .padding(10)
                        .background(Circle().fill(Color.white.opacity(0.08)))
                }
                Spacer()
                if let lesson = model.lesson {
                    Text(lesson.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(HT.textLight)
                }
                Spacer()
                Color.clear.frame(width: 38, height: 38)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            if let lesson = model.lesson {
                ProgressView(value: Double(min(model.lineIndex, lesson.lines.count)), total: Double(lesson.lines.count))
                    .tint(HT.gold)
                    .padding(.horizontal, 20)
                Text("Line \(min(model.lineIndex + 1, lesson.lines.count)) of \(lesson.lines.count)")
                    .font(.caption)
                    .foregroundStyle(HT.textDim)
            }

            Spacer()

            if let line = model.currentLine {
                Text(line.text)
                    .font(.system(.title3, design: .serif))
                    .foregroundStyle(HT.textLight)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
                if let focus = line.focusPhrase {
                    Text("Focus: \(focus)")
                        .font(.caption)
                        .foregroundStyle(HT.gold)
                }
            }

            OrbView(level: model.phase == .recording ? 0.5 : 0.2, aiSpeaking: model.phase == .playingModel)
                .frame(height: 170)

            statusBadge

            Spacer()

            controls
                .padding(.bottom, 20)

            if let error = model.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(HT.orange)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 8)
            }
        }
    }

    private var statusBadge: some View {
        Group {
            switch model.phase {
            case .ready:
                Text("Ready — tap Start to begin")
            case .playingModel:
                Label("Listen…", systemImage: "speaker.wave.2.fill")
            case let .gap(s):
                Text("Get ready… \(s)")
            case .recording:
                Label("Your turn — repeat the line", systemImage: "mic.fill")
            case .processing:
                Text("Scoring…")
            default:
                Text(" ")
            }
        }
        .font(.callout.weight(.semibold))
        .foregroundStyle(model.phase == .recording ? HT.teal : HT.textDim)
        .animation(.snappy, value: model.phase)
    }

    private var controls: some View {
        HStack(spacing: 14) {
            if model.phase == .ready {
                Button {
                    Task { await model.startRun() }
                } label: {
                    Label("Start", systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 16).fill(HT.teal))
                        .foregroundStyle(HT.navy)
                }
            } else {
                if model.phase == .recording {
                    Button {
                        model.finishRecordingEarly()
                    } label: {
                        Label("Done", systemImage: "checkmark")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RoundedRectangle(cornerRadius: 16).fill(HT.gold))
                            .foregroundStyle(HT.navy)
                    }
                }
                Button {
                    model.stopRun()
                } label: {
                    Label("Stop", systemImage: "stop.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.1)))
                        .foregroundStyle(HT.textLight)
                }
            }
        }
        .padding(.horizontal, 20)
    }
}

// MARK: - Results

struct ShadowingResultsView: View {
    var model: ShadowingViewModel
    @State private var player = ConversationPlayer()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("Session results")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .foregroundStyle(HT.textLight)
                    .padding(.top, 18)

                if model.transcribing > 0 {
                    HStack(spacing: 8) {
                        ProgressView().tint(HT.teal)
                        Text("Scoring \(model.transcribing) line(s)…")
                            .font(.footnote)
                            .foregroundStyle(HT.textDim)
                    }
                }

                VStack(spacing: 4) {
                    Text("\(Int((model.averageAccuracy * 100).rounded()))%")
                        .font(.system(size: 52, weight: .bold, design: .rounded))
                        .foregroundStyle(HT.gold)
                    Text("average accuracy")
                        .font(.caption)
                        .foregroundStyle(HT.textDim)
                }
                .frame(maxWidth: .infinity)
                .htCard(padding: 20)

                ForEach(model.results) { result in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .top, spacing: 8) {
                            Text(result.target)
                                .font(.callout.weight(.medium))
                                .foregroundStyle(HT.textLight)
                            Spacer(minLength: 0)
                            if let audioFile = result.audioFile, AudioStore.exists(audioFile) {
                                Button {
                                    var turn = ConversationTurn(speaker: "You", role: .user, text: result.transcript)
                                    turn.id = result.lineId
                                    turn.audioFile = audioFile
                                    player.toggle(turn)
                                } label: {
                                    Image(systemName: player.playingTurnId == result.lineId ? "stop.circle.fill" : "play.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(HT.teal)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        if result.captureFailed {
                            Text(result.captureError ?? "Capture failed")
                                .font(.caption)
                                .foregroundStyle(HT.orange)
                        } else {
                            HStack(spacing: 10) {
                                Text("\(Int((result.accuracy * 100).rounded()))%")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(result.accuracy >= 0.8 ? HT.teal : HT.gold)
                                Text(result.pace.label)
                                    .font(.caption)
                                    .foregroundStyle(HT.textDim)
                            }
                            if !result.transcript.isEmpty {
                                Text("You said: \(result.transcript)")
                                    .font(.caption)
                                    .foregroundStyle(HT.textDim)
                            }
                            if !result.missingWords.isEmpty {
                                Text("Missing: \(result.missingWords.joined(separator: ", "))")
                                    .font(.caption)
                                    .foregroundStyle(HT.orange.opacity(0.85))
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .htCard()
                }

                HStack(spacing: 12) {
                    Button {
                        Task { await model.startRun() }
                    } label: {
                        Label("Repeat", systemImage: "arrow.counterclockwise")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RoundedRectangle(cornerRadius: 16).fill(HT.teal))
                            .foregroundStyle(HT.navy)
                    }
                    Button {
                        model.backToLessons()
                    } label: {
                        Text("Lessons")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.1)))
                            .foregroundStyle(HT.textLight)
                    }
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .onDisappear { player.stop() }
    }
}
