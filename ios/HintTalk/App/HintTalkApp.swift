import SwiftUI

@main
struct HintTalkApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
                .tint(HT.teal)
        }
    }
}

struct RootView: View {
    @State private var liveVoiceModel = LiveVoiceViewModel()
    // Launch-time tab override for UI checks (e.g. simctl launch with HT_TAB=2).
    @State private var selectedTab = Int(ProcessInfo.processInfo.environment["HT_TAB"] ?? "") ?? 0

    var body: some View {
        TabView(selection: $selectedTab) {
            LiveVoiceView(model: liveVoiceModel)
                .tabItem { Label("Role-play", systemImage: "waveform.and.person.filled") }
                .tag(0)

            ShadowingView()
                .tabItem { Label("Shadowing", systemImage: "repeat.circle") }
                .tag(1)

            HistoryView()
                .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }
                .tag(2)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(3)
        }
    }
}
