import UIKit

final class AlmidyBadge: UILabel {
    enum Style { case neutral, accent, success, danger }

    let semanticStyle: Style
    let contentInsets = UIEdgeInsets(
        top: AlmidyDesignTokens.Spacing.xxs,
        left: AlmidyDesignTokens.Spacing.xs,
        bottom: AlmidyDesignTokens.Spacing.xxs,
        right: AlmidyDesignTokens.Spacing.xs
    )

    init(text: String, style: Style = .neutral) {
        semanticStyle = style
        super.init(frame: .zero)
        self.text = text
        textAlignment = .center
        AlmidyDesignTokens.Typography.badge.apply(to: self)
        isAccessibilityElement = true
        accessibilityLabel = text
        layer.cornerRadius = AlmidyDesignTokens.Radius.small
        layer.masksToBounds = true
        applyStyle()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: contentInsets))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(
            width: size.width + contentInsets.left + contentInsets.right,
            height: size.height + contentInsets.top + contentInsets.bottom
        )
    }

    private func applyStyle() {
        switch semanticStyle {
        case .neutral:
            backgroundColor = AlmidyDesignTokens.Color.surfaceNeutral
            textColor = AlmidyDesignTokens.Color.textSecondary
        case .accent:
            backgroundColor = AlmidyDesignTokens.Color.accentMutedSurface
            textColor = AlmidyDesignTokens.Color.accentText
        case .success:
            backgroundColor = AlmidyDesignTokens.Color.success.withAlphaComponent(0.12)
            textColor = AlmidyDesignTokens.Color.success
        case .danger:
            backgroundColor = AlmidyDesignTokens.Color.danger.withAlphaComponent(0.12)
            textColor = AlmidyDesignTokens.Color.danger
        }
    }
}
