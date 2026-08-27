import UIKit

extension AlmidyDesignTokens {
    enum Typography {
        struct Style {
            let baseFont: UIFont
            let textStyle: UIFont.TextStyle

            func scaledFont(compatibleWith traits: UITraitCollection? = nil) -> UIFont {
                UIFontMetrics(forTextStyle: textStyle).scaledFont(
                    for: baseFont,
                    compatibleWith: traits
                )
            }

            func apply(to label: UILabel, compatibleWith traits: UITraitCollection? = nil) {
                label.font = scaledFont(compatibleWith: traits)
                label.adjustsFontForContentSizeCategory = true
            }

            func apply(to button: UIButton, compatibleWith traits: UITraitCollection? = nil) {
                button.titleLabel?.font = scaledFont(compatibleWith: traits)
                button.titleLabel?.adjustsFontForContentSizeCategory = true
            }
        }

        static let displayHero = Style(baseFont: .systemFont(ofSize: 52, weight: .regular), textStyle: .largeTitle)
        static let screenTitle = Style(baseFont: .systemFont(ofSize: 24, weight: .semibold), textStyle: .title2)
        static let sheetTitle = Style(baseFont: .systemFont(ofSize: 22, weight: .semibold), textStyle: .title2)
        static let sectionTitle = Style(baseFont: .systemFont(ofSize: 20, weight: .semibold), textStyle: .title3)
        static let cardTitle = Style(baseFont: .systemFont(ofSize: 17, weight: .semibold), textStyle: .headline)
        static let body = Style(baseFont: .systemFont(ofSize: 17, weight: .regular), textStyle: .body)
        static let bodyCompact = Style(baseFont: .systemFont(ofSize: 15, weight: .regular), textStyle: .subheadline)
        static let bodyEmphasized = Style(baseFont: .systemFont(ofSize: 17, weight: .semibold), textStyle: .body)
        static let action = Style(baseFont: .systemFont(ofSize: 17, weight: .semibold), textStyle: .headline)
        static let metadata = Style(baseFont: .systemFont(ofSize: 13, weight: .regular), textStyle: .caption1)
        static let metadataEmphasis = Style(baseFont: .systemFont(ofSize: 13, weight: .semibold), textStyle: .caption1)
        static let caption = Style(baseFont: .systemFont(ofSize: 12, weight: .regular), textStyle: .caption2)
        static let badge = Style(baseFont: .systemFont(ofSize: 11, weight: .bold), textStyle: .caption2)
    }

    enum Size {
        static let minimumTarget: CGFloat = 44
        static let headerControlStandard: CGFloat = 44
        static let headerControlProminent: CGFloat = 48
        static let buttonCompact: CGFloat = 48
        static let buttonStandard: CGFloat = 60
        static let rowStandard: CGFloat = 52
        static let rowAction: CGFloat = 64
        static let mapControl: CGFloat = 56
        static let iconSmall: CGFloat = 16
        static let iconStandard: CGFloat = 20
        static let iconControl: CGFloat = 24
        static let iconProminent: CGFloat = 28
        static let iconHero: CGFloat = 34
    }

    enum Shape {
        case circle
        case capsule

        func cornerRadius(for bounds: CGRect) -> CGFloat {
            switch self {
            case .circle: return min(bounds.width, bounds.height) / 2
            case .capsule: return bounds.height / 2
            }
        }

        func apply(to view: UIView) {
            view.layer.cornerRadius = cornerRadius(for: view.bounds)
            view.layer.masksToBounds = true
        }
    }

    enum Border {
        struct Configuration {
            let width: CGFloat
            let color: UIColor

            func apply(to layer: CALayer) {
                layer.borderWidth = width
                layer.borderColor = color.cgColor
            }
        }

        static var hairline: Configuration {
            Configuration(width: 1 / UIScreen.main.scale, color: Color.dividerSubtle)
        }
        static let outline = Configuration(width: 1, color: Color.borderSubtle)
        static let outlineStrong = Configuration(width: 1, color: Color.borderStrong)
        static let selected = Configuration(width: 2, color: Color.accentText)
        static let selectedProminent = Configuration(width: 3, color: Color.accent)
        static let onMedia = Configuration(width: 1, color: UIColor.white.withAlphaComponent(0.14))

        static func timeline(color: UIColor) -> Configuration {
            Configuration(width: 2, color: color)
        }
    }

    enum Elevation {
        struct Configuration {
            let color: UIColor
            let opacity: Float
            let radius: CGFloat
            let offset: CGSize

            func apply(to layer: CALayer) {
                layer.shadowColor = color.cgColor
                layer.shadowOpacity = opacity
                layer.shadowRadius = radius
                layer.shadowOffset = offset
            }

            func apply(to view: UIView) { apply(to: view.layer) }
        }

        static let controlSubtle = Configuration(color: .black, opacity: 0.08, radius: 10, offset: CGSize(width: 0, height: 4))
        static let controlRaised = Configuration(color: .black, opacity: 0.10, radius: 14, offset: CGSize(width: 0, height: 5))
        static let floating = Configuration(color: .black, opacity: 0.16, radius: 12, offset: CGSize(width: 0, height: 5))
        static let cardRaised = Configuration(color: .black, opacity: 0.18, radius: 24, offset: CGSize(width: 0, height: 12))
        static let sheet = Configuration(color: .black, opacity: 0.20, radius: 34, offset: CGSize(width: 0, height: -4))
        static let mapPin = Configuration(color: .black, opacity: 0.24, radius: 5, offset: CGSize(width: 0, height: 2))
        static let textOnMedia = Configuration(color: .black, opacity: 0.90, radius: 2.5, offset: .zero)
    }

    enum Motion {
        static let fast: TimeInterval = 0.16
        static let standard: TimeInterval = 0.24
        static let expressive: TimeInterval = 0.45

        static func resolvedDuration(
            _ duration: TimeInterval,
            reduceMotionEnabled: Bool = UIAccessibility.isReduceMotionEnabled
        ) -> TimeInterval {
            reduceMotionEnabled ? 0 : duration
        }

        enum TripOverview {
            static let duration: TimeInterval = 0.48
            static let damping: CGFloat = 0.84
            static let initialVelocity: CGFloat = 0.45
        }
    }

    enum Component {
        /// Compatibility bridge. The measured Trip Overview specification stays
        /// intact while new code gains the component-scoped semantic path.
        typealias TripOverview = AlmidyDesignTokens.TripOverview

        enum Map {
            /// Map camera, annotation, and route geometry remain in their owning
            /// components until repeated semantic intent is established.
            static let ownsPlatformSpecificGeometry = true
            static let globeSheetCornerRadius: CGFloat = 40
            static let globeSheetHorizontalInset: CGFloat = 8
            static let globeSheetBottomInset: CGFloat = 12
        }
    }
}
