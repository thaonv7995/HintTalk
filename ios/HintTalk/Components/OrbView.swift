import SwiftUI

/// Teal particle sphere — native port of the web's Three.js `LiveParticleOrb`.
/// Rendered with `Canvas` inside `TimelineView` (GPU-backed, no per-frame view diffing).
struct OrbView: View {
    /// 0...1 — drives pulse scale (mic input or AI output level).
    var level: Float
    /// Tint shifts when the AI is speaking.
    var aiSpeaking: Bool
    var idle: Bool = false

    private static let particles: [SIMD3<Double>] = {
        // Fibonacci sphere — stable, evenly distributed points.
        let count = 230
        var points: [SIMD3<Double>] = []
        points.reserveCapacity(count)
        let golden = Double.pi * (3 - sqrt(5))
        for i in 0 ..< count {
            let y = 1 - (Double(i) / Double(count - 1)) * 2
            let radius = sqrt(max(0, 1 - y * y))
            let theta = golden * Double(i)
            points.append(SIMD3(cos(theta) * radius, y, sin(theta) * radius))
        }
        return points
    }()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                let pulse = 1 + CGFloat(min(level, 1)) * 0.22 + CGFloat(sin(t * 1.4)) * 0.015
                let baseRadius = min(size.width, size.height) * 0.36 * pulse
                let rotY = t * 0.35
                let rotX = sin(t * 0.21) * 0.35

                let tint: Color = aiSpeaking ? Color(hex: 0x9D8CFF) : HT.teal
                let glow = Path(ellipseIn: CGRect(
                    x: center.x - baseRadius * 1.25,
                    y: center.y - baseRadius * 1.25,
                    width: baseRadius * 2.5,
                    height: baseRadius * 2.5
                ))
                context.fill(glow, with: .radialGradient(
                    Gradient(colors: [tint.opacity(idle ? 0.10 : 0.20), .clear]),
                    center: center,
                    startRadius: 0,
                    endRadius: baseRadius * 1.3
                ))

                let cosY = cos(rotY), sinY = sin(rotY)
                let cosX = cos(rotX), sinX = sin(rotX)

                for p in Self.particles {
                    // Rotate around Y then X.
                    let x1 = p.x * cosY + p.z * sinY
                    let z1 = -p.x * sinY + p.z * cosY
                    let y2 = p.y * cosX - z1 * sinX
                    let z2 = p.y * sinX + z1 * cosX

                    let depth = (z2 + 1) / 2 // 0 back, 1 front
                    let px = center.x + CGFloat(x1) * baseRadius
                    let py = center.y + CGFloat(y2) * baseRadius
                    let dotSize = 1.2 + CGFloat(depth) * 2.4
                    let opacity = (idle ? 0.25 : 0.32) + depth * 0.55

                    let rect = CGRect(x: px - dotSize / 2, y: py - dotSize / 2, width: dotSize, height: dotSize)
                    context.fill(Path(ellipseIn: rect), with: .color(tint.opacity(opacity)))
                }
            }
        }
        .drawingGroup()
    }
}
