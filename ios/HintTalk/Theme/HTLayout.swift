import SwiftUI

/// Responsive layout tokens for iPhone vs iPad (e.g. iPad Pro 11").
enum HTLayout {
    static let setupMaxWidth: CGFloat = 760
    static let listMaxWidth: CGFloat = 820
    static let sessionMaxWidth: CGFloat = 1040
    static let settingsMaxWidth: CGFloat = 640
    static let transcriptBubbleMaxWidth: CGFloat = 520

    static func pagePadding(_ sizeClass: UserInterfaceSizeClass?) -> CGFloat {
        sizeClass == .regular ? 32 : 18
    }

    static func isRegularWidth(_ sizeClass: UserInterfaceSizeClass?) -> Bool {
        sizeClass == .regular
    }
}

// MARK: - View modifiers

private struct HTReadableWidth: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var maxWidth: CGFloat

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: HTLayout.isRegularWidth(horizontalSizeClass) ? maxWidth : .infinity)
            .frame(maxWidth: .infinity)
    }
}

private struct HTPagePadding: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var edges: Edge.Set

    func body(content: Content) -> some View {
        content.padding(edges, HTLayout.pagePadding(horizontalSizeClass))
    }
}

extension View {
    /// Centers content and caps width on iPad so forms don't stretch edge-to-edge.
    func htReadableWidth(_ maxWidth: CGFloat = HTLayout.setupMaxWidth) -> some View {
        modifier(HTReadableWidth(maxWidth: maxWidth))
    }

    func htPagePadding(_ edges: Edge.Set = .horizontal) -> some View {
        modifier(HTPagePadding(edges: edges))
    }
}
