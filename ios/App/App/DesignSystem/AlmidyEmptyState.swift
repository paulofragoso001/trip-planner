import UIKit

final class AlmidyEmptyState: UIView {
    enum Style: Equatable { case empty, error, offline, loading }
    enum Presentation { case illustrated, messageOnly }

    let imageView = UIImageView()
    let titleLabel = UILabel()
    let messageLabel = UILabel()
    private(set) var semanticStyle: Style

    init(
        style: Style = .empty,
        presentation: Presentation = .illustrated,
        symbol: String? = nil,
        image: UIImage? = nil,
        title: String,
        message: String,
        primaryAction: AlmidyButton? = nil,
        secondaryAction: AlmidyButton? = nil
    ) {
        semanticStyle = style
        super.init(frame: .zero)
        imageView.image = image ?? UIImage(systemName: symbol ?? Self.defaultSymbol(for: style))
        imageView.tintColor = style == .error ? AlmidyDesignTokens.Color.danger : AlmidyDesignTokens.Color.accentText
        imageView.contentMode = .scaleAspectFit
        imageView.isAccessibilityElement = false
        imageView.isHidden = presentation == .messageOnly

        titleLabel.text = title
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        titleLabel.textColor = AlmidyDesignTokens.Color.textPrimary
        AlmidyDesignTokens.Typography.sectionTitle.apply(to: titleLabel)
        titleLabel.accessibilityTraits = [.header]
        titleLabel.isHidden = presentation == .messageOnly

        messageLabel.text = message
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        messageLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        AlmidyDesignTokens.Typography.body.apply(to: messageLabel)

        let stack = UIStackView(arrangedSubviews: [imageView, titleLabel, messageLabel])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = AlmidyDesignTokens.Spacing.sm
        if let primaryAction { stack.addArrangedSubview(primaryAction) }
        if let secondaryAction { stack.addArrangedSubview(secondaryAction) }
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            imageView.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.Size.iconHero),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setMessage(_ message: String, style: Style? = nil) {
        messageLabel.text = message
        guard let style else { return }
        semanticStyle = style
        imageView.image = UIImage(systemName: Self.defaultSymbol(for: style))
        imageView.tintColor = style == .error
            ? AlmidyDesignTokens.Color.danger
            : AlmidyDesignTokens.Color.accentText
    }

    private static func defaultSymbol(for style: Style) -> String {
        switch style {
        case .empty: return "tray"
        case .error: return "exclamationmark.triangle"
        case .offline: return "wifi.slash"
        case .loading: return "hourglass"
        }
    }
}
