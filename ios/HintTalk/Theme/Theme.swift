import SwiftUI

/// HintTalk brand palette — mirrors web `mock-theme.css`.
enum HT {
    static let navy = Color(hex: 0x11231F)
    static let navy2 = Color(hex: 0x18322D)
    static let teal = Color(hex: 0x3FB7C8)
    static let tealDark = Color(hex: 0x1E7885)
    static let mint = Color(hex: 0xDFF4E8)
    static let gold = Color(hex: 0xF3D36C)
    static let goldSoft = Color(hex: 0xFFF4C9)
    static let orange = Color(hex: 0xEC8D5A)
    static let textLight = Color(hex: 0xEFF8F3)

    static let textDim = textLight.opacity(0.62)
    static let cardStroke = teal.opacity(0.28)
    static let cardFill = Color.white.opacity(0.05)

    static var pageGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: 0x0C1A17), navy, navy2],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

// MARK: - Shared card style

struct HTCard: ViewModifier {
    var padding: CGFloat = 14

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(HT.cardFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(HT.cardStroke, lineWidth: 1)
                    )
            )
    }
}

extension View {
    func htCard(padding: CGFloat = 14) -> some View {
        modifier(HTCard(padding: padding))
    }
}
