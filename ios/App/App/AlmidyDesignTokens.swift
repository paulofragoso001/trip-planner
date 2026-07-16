import UIKit

/// Native Almidy visual language. Keep product behavior in the controllers; keep visual decisions here.
enum AlmidyDesignTokens {
    enum Color {
        // Native sheets use the same airy white-and-mist foundation as Settings.
        static let background = UIColor.white
        static let surface = UIColor.white
        static let card = UIColor(hex: 0xF2F3F6)
        static let line = UIColor.black.withAlphaComponent(0.10)
        static let textPrimary = UIColor(hex: 0x050505)
        static let textSecondary = UIColor(hex: 0x7D7D84)
        static let textTertiary = UIColor(hex: 0xA2A2A8)
        static let darkInput = UIColor(hex: 0xF5F5F7)
        static let darkInputBorder = UIColor.black.withAlphaComponent(0.12)
        static let darkPlaceholder = UIColor.black.withAlphaComponent(0.44)
        static let disabledActionBackground = UIColor.black.withAlphaComponent(0.06)
        static let disabledActionText = UIColor.black.withAlphaComponent(0.38)
        static let disabledActionBorder = UIColor.black.withAlphaComponent(0.12)

        // Champagne gold signals elevated action and progress without reading as warning orange.
        static let gold = UIColor(hex: 0xD6A84F)
        static let goldDeep = UIColor(hex: 0xB88A2E)
        static let goldDark = UIColor(hex: 0x8C641E)
        // Text accents sit on light surfaces, so use the contrast-safe dark gold.
        static let goldSoft = goldDark

        // Settings is intentionally light and uses the darker gold variants for contrast.
        static let settingsBackground = UIColor(hex: 0xF2F3F6)
        static let settingsCard = UIColor.white
        static let settingsText = UIColor(hex: 0x050505)
        static let settingsSecondary = UIColor(hex: 0x8B8B92)
        static let settingsLine = UIColor.black.withAlphaComponent(0.08)
        static let settingsGold = goldDark
        static let settingsIcon = goldDark
        static let settingsRowBackground = settingsCard
        static let searchEmptyState = textSecondary

        static let success = UIColor(hex: 0x3C8F5A)
        static let danger = UIColor(hex: 0xC2413A)
        static let info = UIColor(hex: 0x6D86A8)
        static let mapSurface = UIColor(hex: 0x030406)

        // Compatibility aliases: existing visual call sites can migrate without changing behavior.
        static let brandOrange = gold
        static let brandOrangeStrong = goldDeep
        static let authSurface = surface
        static let walletSurface = surface
        static let borderSoft = line
    }

    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
        static let content = lg
        static let safeTop: CGFloat = 14
        static let safeBottom = lg
        static let section = xl
    }

    enum Radius {
        static let sheet: CGFloat = 36
        static let card: CGFloat = 24
        static let control: CGFloat = 18
        static let capsule: CGFloat = 999
    }

    enum Control {
        static let buttonHeight: CGFloat = 60
        static let compactButtonHeight: CGFloat = 48
        static let iconButton: CGFloat = 56
        static let mapControl: CGFloat = 56
    }

    enum Shadow {
        static let opacity: Float = 0.22
        static let radius: CGFloat = 22
        static let offset = CGSize(width: 0, height: -8)
    }

    enum Font {
        static func display(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .regular) }
        static func title(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func section(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func body(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .regular) }
        static func button(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func semibold(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .semibold) }
        static func regular(_ size: CGFloat) -> UIFont { body(size) }
        static func medium(_ size: CGFloat) -> UIFont { title(size) }
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
