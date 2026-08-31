import UIKit

struct AlmidySurfaceStyle {
    let backgroundColor: UIColor
    let cornerRadius: CGFloat
    let border: AlmidyDesignTokens.Border.Configuration?
    let elevation: AlmidyDesignTokens.Elevation.Configuration?

    static let canvas = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.canvas,
        cornerRadius: 0,
        border: nil,
        elevation: nil
    )
    static let grouped = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.canvasGrouped,
        cornerRadius: 0,
        border: nil,
        elevation: nil
    )
    static let groupedCard = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.surface,
        cornerRadius: AlmidyDesignTokens.Radius.card,
        border: AlmidyDesignTokens.Border.Configuration(
            width: 1,
            color: AlmidyDesignTokens.Color.dividerSubtle
        ),
        elevation: nil
    )
    static let card = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.surface,
        cornerRadius: AlmidyDesignTokens.Radius.card,
        border: AlmidyDesignTokens.Border.outline,
        elevation: nil
    )
    static let cardLarge = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.surface,
        cornerRadius: AlmidyDesignTokens.Radius.cardLarge,
        border: nil,
        elevation: AlmidyDesignTokens.Elevation.cardRaised
    )
    static let neutral = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.surfaceNeutral,
        cornerRadius: AlmidyDesignTokens.Radius.card,
        border: nil,
        elevation: nil
    )
    static let onMedia = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.overlayScrim,
        cornerRadius: AlmidyDesignTokens.Radius.control,
        border: AlmidyDesignTokens.Border.onMedia,
        elevation: AlmidyDesignTokens.Elevation.controlSubtle
    )

    func apply(to view: UIView, traits: UITraitCollection? = nil) {
        view.backgroundColor = backgroundColor
        view.layer.cornerRadius = cornerRadius
        view.layer.borderWidth = 0
        view.layer.borderColor = nil
        view.layer.shadowColor = nil
        view.layer.shadowOpacity = 0
        view.layer.shadowRadius = 0
        view.layer.shadowOffset = .zero
        border?.apply(to: view, traits: traits)
        elevation?.apply(to: view, traits: traits)
    }
}
