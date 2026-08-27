import UIKit

final class AlmidyIconButton: UIButton {
    enum Style {
        case standard
        case prominent
        case floating
        case onMedia
    }

    struct Overrides {
        var diameter: CGFloat?
        var symbolPointSize: CGFloat?
        var symbolWeight: UIImage.SymbolWeight?
        var foregroundColor: UIColor?
        var backgroundColor: UIColor?
        var border: AlmidyDesignTokens.Border.Configuration?
        var elevation: AlmidyDesignTokens.Elevation.Configuration?

        init(
            diameter: CGFloat? = nil,
            symbolPointSize: CGFloat? = nil,
            symbolWeight: UIImage.SymbolWeight? = nil,
            foregroundColor: UIColor? = nil,
            backgroundColor: UIColor? = nil,
            border: AlmidyDesignTokens.Border.Configuration? = nil,
            elevation: AlmidyDesignTokens.Elevation.Configuration? = nil
        ) {
            self.diameter = diameter
            self.symbolPointSize = symbolPointSize
            self.symbolWeight = symbolWeight
            self.foregroundColor = foregroundColor
            self.backgroundColor = backgroundColor
            self.border = border
            self.elevation = elevation
        }
    }

    let semanticStyle: Style
    let semanticDiameter: CGFloat
    let semanticSymbolPointSize: CGFloat
    let semanticSymbolWeight: UIImage.SymbolWeight
    let minimumHitTarget = CGSize(
        width: AlmidyDesignTokens.Size.minimumTarget,
        height: AlmidyDesignTokens.Size.minimumTarget
    )

    private let normalForegroundColor: UIColor
    private let normalBackgroundColor: UIColor
    private let disabledForegroundColor = AlmidyDesignTokens.Color.stateDisabledText
    private let disabledBackgroundColor = AlmidyDesignTokens.Color.stateDisabledFill

    init(
        symbol: String,
        style: Style = .standard,
        accessibilityLabel: String,
        overrides: Overrides = Overrides()
    ) {
        let defaults = Self.defaults(for: style)
        semanticStyle = style
        semanticDiameter = max(overrides.diameter ?? defaults.diameter, AlmidyDesignTokens.Size.minimumTarget)
        semanticSymbolPointSize = overrides.symbolPointSize ?? defaults.symbolPointSize
        semanticSymbolWeight = overrides.symbolWeight ?? defaults.symbolWeight
        normalForegroundColor = overrides.foregroundColor ?? defaults.foreground
        normalBackgroundColor = overrides.backgroundColor ?? defaults.background
        super.init(frame: .zero)

        translatesAutoresizingMaskIntoConstraints = false
        widthAnchor.constraint(equalToConstant: semanticDiameter).isActive = true
        heightAnchor.constraint(equalToConstant: semanticDiameter).isActive = true
        setImage(
            UIImage(
                systemName: symbol,
                withConfiguration: UIImage.SymbolConfiguration(
                    pointSize: semanticSymbolPointSize,
                    weight: semanticSymbolWeight
                )
            ),
            for: .normal
        )
        self.accessibilityLabel = accessibilityLabel
        accessibilityTraits.insert(.button)
        let border = overrides.border ?? defaults.border
        border?.apply(to: layer)
        let elevation = overrides.elevation ?? defaults.elevation
        elevation?.apply(to: layer)
        applyColors()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var isHighlighted: Bool {
        didSet {
            // Floating controls preserve UIButton's existing image-only pressed
            // treatment so the first Itinerary migration remains pixel-stable.
            guard semanticStyle != .floating else {
                alpha = 1
                transform = .identity
                return
            }
            alpha = isHighlighted ? 0.78 : 1
            transform = isHighlighted
                ? CGAffineTransform(scaleX: 0.96, y: 0.96)
                : .identity
        }
    }

    override var isEnabled: Bool {
        didSet { applyColors() }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = AlmidyDesignTokens.Shape.circle.cornerRadius(for: bounds)
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let horizontalExpansion = max(0, minimumHitTarget.width - bounds.width) / 2
        let verticalExpansion = max(0, minimumHitTarget.height - bounds.height) / 2
        return bounds.insetBy(dx: -horizontalExpansion, dy: -verticalExpansion).contains(point)
    }

    override func accessibilityActivate() -> Bool {
        guard isEnabled else { return false }
        sendActions(for: .touchUpInside)
        return true
    }

    private func applyColors() {
        tintColor = isEnabled ? normalForegroundColor : disabledForegroundColor
        backgroundColor = isEnabled ? normalBackgroundColor : disabledBackgroundColor
    }

    private struct Defaults {
        let diameter: CGFloat
        let symbolPointSize: CGFloat
        let symbolWeight: UIImage.SymbolWeight
        let foreground: UIColor
        let background: UIColor
        let border: AlmidyDesignTokens.Border.Configuration?
        let elevation: AlmidyDesignTokens.Elevation.Configuration?
    }

    private static func defaults(for style: Style) -> Defaults {
        switch style {
        case .standard:
            return Defaults(
                diameter: AlmidyDesignTokens.Size.headerControlStandard,
                symbolPointSize: AlmidyDesignTokens.Size.iconStandard,
                symbolWeight: .semibold,
                foreground: AlmidyDesignTokens.Color.textPrimary,
                background: AlmidyDesignTokens.Color.surface,
                border: AlmidyDesignTokens.Border.outline,
                elevation: nil
            )
        case .prominent:
            return Defaults(
                diameter: AlmidyDesignTokens.Size.headerControlProminent,
                symbolPointSize: AlmidyDesignTokens.Size.iconControl,
                symbolWeight: .semibold,
                foreground: AlmidyDesignTokens.Color.onMediaPrimary,
                background: AlmidyDesignTokens.Color.accent,
                border: nil,
                elevation: AlmidyDesignTokens.Elevation.controlRaised
            )
        case .floating:
            return Defaults(
                diameter: AlmidyDesignTokens.Size.mapControl,
                symbolPointSize: AlmidyDesignTokens.Size.iconStandard,
                symbolWeight: .semibold,
                foreground: AlmidyDesignTokens.Color.textPrimary,
                background: AlmidyDesignTokens.Color.surface,
                border: nil,
                elevation: AlmidyDesignTokens.Elevation.floating
            )
        case .onMedia:
            return Defaults(
                diameter: AlmidyDesignTokens.Size.headerControlProminent,
                symbolPointSize: AlmidyDesignTokens.Size.iconStandard,
                symbolWeight: .semibold,
                foreground: AlmidyDesignTokens.Color.onMediaPrimary,
                background: AlmidyDesignTokens.Color.overlayScrim,
                border: AlmidyDesignTokens.Border.onMedia,
                elevation: AlmidyDesignTokens.Elevation.controlSubtle
            )
        }
    }
}
