import UIKit

final class AlmidyCard: UIView {
    enum Style { case standard, compact, actionable, large, onMedia }

    let contentView = UIView()
    let semanticStyle: Style
    let contentInsets: UIEdgeInsets

    init(style: Style = .standard, contentInsets: UIEdgeInsets? = nil) {
        semanticStyle = style
        let defaultInset: CGFloat = style == .compact
            ? AlmidyDesignTokens.Spacing.sm
            : AlmidyDesignTokens.Spacing.md
        self.contentInsets = contentInsets ?? UIEdgeInsets(
            top: defaultInset, left: defaultInset, bottom: defaultInset, right: defaultInset
        )
        super.init(frame: .zero)

        surfaceStyle.apply(to: self)
        contentView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(contentView)
        NSLayoutConstraint.activate([
            contentView.topAnchor.constraint(equalTo: topAnchor, constant: self.contentInsets.top),
            contentView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: self.contentInsets.left),
            contentView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -self.contentInsets.right),
            contentView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -self.contentInsets.bottom)
        ])
        layer.masksToBounds = style != .large
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private var surfaceStyle: AlmidySurfaceStyle {
        switch semanticStyle {
        case .standard, .compact: return .card
        case .actionable: return .neutral
        case .large: return .cardLarge
        case .onMedia: return .onMedia
        }
    }
}
