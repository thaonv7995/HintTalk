import SwiftUI

struct HistoryView: View {
    @State private var store = SessionStore.shared
    @State private var searchText = ""
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable {
        case all = "All"
        case roleplay = "Role-play"
        case shadowing = "Shadowing"
    }

    private var filteredSessions: [PracticeSession] {
        let query = searchText.trimmed.lowercased()
        return store.sessions.filter { session in
            switch filter {
            case .all: break
            case .roleplay: if session.isShadowing { return false }
            case .shadowing: if !session.isShadowing { return false }
            }
            guard !query.isEmpty else { return true }
            return session.scenarioTitle.lowercased().contains(query)
                || session.turns.contains { $0.text.lowercased().contains(query) }
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if store.sessions.isEmpty {
                    ContentUnavailableView(
                        "No sessions yet",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Finished live-voice conversations appear here when “Save transcripts” is on.")
                    )
                } else {
                    List {
                        Section {
                            ForEach(filteredSessions) { session in
                                NavigationLink {
                                    SessionDetailView(session: session)
                                } label: {
                                    sessionRow(session)
                                }
                                .listRowBackground(Color.white.opacity(0.04))
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        store.delete(session)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }
                        } header: {
                            filterChips
                                .textCase(nil)
                                .listRowInsets(EdgeInsets())
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .searchable(text: $searchText, prompt: "Search topics or lines")
                    .overlay {
                        if filteredSessions.isEmpty {
                            ContentUnavailableView.search(text: searchText)
                                .background(.clear)
                        }
                    }
                }
            }
            .background(HT.pageGradient.ignoresSafeArea())
            .navigationTitle("History")
            .htReadableWidth(HTLayout.listMaxWidth)
        }
    }

    private func sessionRow(_ session: PracticeSession) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: session.isShadowing ? "repeat.circle" : "waveform.and.person.filled")
                    .font(.caption)
                    .foregroundStyle(session.isShadowing ? HT.gold : HT.teal)
                Text(session.scenarioTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(HT.textLight)
                if session.turns.contains(where: { AudioStore.exists($0.audioFile) }) {
                    Image(systemName: "waveform")
                        .font(.caption2)
                        .foregroundStyle(HT.teal)
                }
            }
            Text("\(session.startedAt.formatted(date: .abbreviated, time: .shortened)) · \(session.turns.count) lines · \(session.level.label)")
                .font(.caption)
                .foregroundStyle(HT.textDim)
        }
    }

    private var filterChips: some View {
        HStack(spacing: 8) {
            ForEach(Filter.allCases, id: \.self) { item in
                Button {
                    filter = item
                } label: {
                    Text(item.rawValue)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(filter == item ? HT.teal.opacity(0.22) : Color.white.opacity(0.06)))
                        .foregroundStyle(filter == item ? HT.teal : HT.textDim)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.bottom, 8)
    }
}

/// Chat-style transcript with per-line audio playback for speaking review.
struct SessionDetailView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let session: PracticeSession
    @State private var player = ConversationPlayer()

    private var hasAnyAudio: Bool {
        session.turns.contains { AudioStore.exists($0.audioFile) }
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 10) {
                    Text("\(session.userRole) ↔ \(session.aiRole)")
                        .font(.footnote)
                        .foregroundStyle(HT.textDim)
                        .padding(.top, 10)

                    ForEach(session.turns) { turn in
                        bubble(for: turn)
                            .id(turn.id)
                    }
                }
                .htPagePadding()
                .padding(.bottom, 24)
            }
            .htReadableWidth(HTLayout.listMaxWidth)
            .onChange(of: player.playingTurnId) { _, turnId in
                if let turnId, player.isPlayingAll {
                    withAnimation { proxy.scrollTo(turnId, anchor: .center) }
                }
            }
        }
        .background(HT.pageGradient.ignoresSafeArea())
        .navigationTitle(session.scenarioTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if hasAnyAudio {
                    Menu {
                        ForEach([1.0, 1.25, 1.5], id: \.self) { rate in
                            Button {
                                player.playbackRate = rate
                            } label: {
                                if player.playbackRate == rate {
                                    Label(rateLabel(rate), systemImage: "checkmark")
                                } else {
                                    Text(rateLabel(rate))
                                }
                            }
                        }
                    } label: {
                        Text(rateLabel(player.playbackRate))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(HT.teal)
                    }
                    Button {
                        if player.isPlayingAll {
                            player.stop()
                        } else {
                            player.playAll(session.turns)
                        }
                    } label: {
                        Image(systemName: player.isPlayingAll ? "stop.circle.fill" : "play.circle.fill")
                            .foregroundStyle(HT.teal)
                    }
                }
                ShareLink(item: transcriptText) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
        .onDisappear { player.releaseAudioSession() }
    }

    @ViewBuilder
    private func bubble(for turn: ConversationTurn) -> some View {
        let isUser = turn.role == .user
        let isPlaying = player.playingTurnId == turn.id
        let hasAudio = AudioStore.exists(turn.audioFile)

        HStack(alignment: .bottom, spacing: 8) {
            if isUser { Spacer(minLength: HTLayout.isRegularWidth(horizontalSizeClass) ? 80 : 40) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(turn.speaker)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(isUser ? HT.gold : HT.teal)
                    if let accuracy = turn.accuracy {
                        Text("\(Int((accuracy * 100).rounded()))%")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(accuracy >= 0.8 ? HT.teal : HT.gold)
                    }
                }

                HStack(alignment: .center, spacing: 8) {
                    if isUser, hasAudio { playButton(turn, isPlaying: isPlaying) }

                    Text(turn.text)
                        .font(.callout)
                        .foregroundStyle(HT.textLight)
                        .fixedSize(horizontal: false, vertical: true)

                    if !isUser, hasAudio { playButton(turn, isPlaying: isPlaying) }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(isUser ? HT.gold.opacity(0.13) : Color.white.opacity(0.06))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(
                                    isPlaying
                                        ? (isUser ? HT.gold : HT.teal).opacity(0.8)
                                        : (isUser ? HT.gold : HT.teal).opacity(0.22),
                                    lineWidth: isPlaying ? 1.5 : 1
                                )
                        )
                )
            }
            .frame(maxWidth: HTLayout.transcriptBubbleMaxWidth, alignment: isUser ? .trailing : .leading)

            if !isUser { Spacer(minLength: HTLayout.isRegularWidth(horizontalSizeClass) ? 80 : 40) }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }

    private func playButton(_ turn: ConversationTurn, isPlaying: Bool) -> some View {
        Button {
            player.toggle(turn)
        } label: {
            Image(systemName: isPlaying ? "stop.circle.fill" : "play.circle.fill")
                .font(.title3)
                .foregroundStyle(turn.role == .user ? HT.gold : HT.teal)
                .symbolEffect(.pulse, isActive: isPlaying)
        }
        .buttonStyle(.plain)
    }

    private func rateLabel(_ rate: Double) -> String {
        rate == 1.0 ? "1x" : String(format: "%.2gx", rate)
    }

    private var transcriptText: String {
        session.turns.map { "\($0.speaker): \($0.text)" }.joined(separator: "\n")
    }
}
