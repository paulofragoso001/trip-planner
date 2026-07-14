import UIKit

/// Semantic UIKit values mirrored by the web design-token contract.
enum AlmidyDesignTokens {
    enum Color {
        static let brandOrange = UIColor(red: 1.0, green: 0.478, blue: 0.165, alpha: 1.0)
        static let brandOrangeStrong = UIColor(red: 1.0, green: 0.420, blue: 0.102, alpha: 1.0)
        static let authSurface = UIColor(red: 1.0, green: 0.976, blue: 0.957, alpha: 1.0)
        static let walletSurface = UIColor.white
        static let textPrimary = UIColor(red: 0.043, green: 0.063, blue: 0.125, alpha: 1.0)
        static let textSecondary = UIColor(red: 0.553, green: 0.553, blue: 0.580, alpha: 1.0)
        static let borderSoft = UIColor(red: 0.898, green: 0.906, blue: 0.922, alpha: 1.0)
    }

    enum Spacing {
        static let content: CGFloat = 24
        static let safeTop: CGFloat = 14
        static let safeBottom: CGFloat = 24
        static let section: CGFloat = 32
    }

    enum Radius {
        static let sheet: CGFloat = 32
        static let card: CGFloat = 28
        static let control: CGFloat = 27
    }

    enum Control {
        static let buttonHeight: CGFloat = 64
        static let compactButtonHeight: CGFloat = 54
        static let iconButton: CGFloat = 58
    }

    enum Font {
        static func regular(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .regular) }
        static func medium(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func semibold(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .semibold) }
        static func bold(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .bold) }
    }
}
