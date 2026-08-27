import UIKit

class AlmidyListRow: UIControl {
    enum Style { case standard, compact, action, destructive }

    let iconView = UIImageView()
    let titleLabel = UILabel()
    let subtitleLabel = UILabel()
    let valueLabel = UILabel()
    let chevronView = UIImageView()
    let semanticStyle: Style
    let semanticHeight: CGFloat

    init(
        title: String,
        subtitle: String? = nil,
        symbol: String? = nil,
        value: String? = nil,
        showsChevron: Bool = false,
        style: Style = .standard
    ) {
        semanticStyle = style
        semanticHeight = style == .compact
            ? AlmidyDesignTokens.Size.minimumTarget
            : (style == .action ? AlmidyDesignTokens.Size.rowAction : AlmidyDesignTokens.Size.rowStandard)
        super.init(frame: .zero)

        titleLabel.text = title
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle == nil
        valueLabel.text = value
        valueLabel.isHidden = value == nil
        iconView.image = symbol.flatMap {
            UIImage(systemName: $0, withConfiguration: UIImage.SymbolConfiguration(pointSize: AlmidyDesignTokens.Size.iconStandard))
        }
        iconView.isHidden = symbol == nil
        chevronView.image = UIImage(systemName: "chevron.right")
        chevronView.isHidden = !showsChevron

        AlmidyDesignTokens.Typography.body.apply(to: titleLabel)
        AlmidyDesignTokens.Typography.bodyCompact.apply(to: subtitleLabel)
        AlmidyDesignTokens.Typography.bodyCompact.apply(to: valueLabel)
        titleLabel.textColor = style == .destructive ? AlmidyDesignTokens.Color.danger : AlmidyDesignTokens.Color.textPrimary
        subtitleLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        valueLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        iconView.tintColor = style == .destructive ? AlmidyDesignTokens.Color.danger : AlmidyDesignTokens.Color.accentText
        chevronView.tintColor = AlmidyDesignTokens.Color.textTertiary
        [iconView, chevronView].forEach { $0.contentMode = .scaleAspectFit }

        let labels = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        labels.axis = .vertical
        labels.spacing = AlmidyDesignTokens.Spacing.xxs
        let stack = UIStackView(arrangedSubviews: [iconView, labels, valueLabel, chevronView])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = AlmidyDesignTokens.Spacing.sm
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: semanticHeight),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: AlmidyDesignTokens.Spacing.md),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -AlmidyDesignTokens.Spacing.md),
            stack.topAnchor.constraint(greaterThanOrEqualTo: topAnchor, constant: AlmidyDesignTokens.Spacing.xs),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -AlmidyDesignTokens.Spacing.xs),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.Size.iconControl),
            iconView.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.Size.iconControl),
            chevronView.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.Size.iconSmall)
        ])
        accessibilityLabel = [title, subtitle, value].compactMap { $0 }.joined(separator: ", ")
        accessibilityTraits = [.button]
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var isEnabled: Bool {
        didSet {
            alpha = isEnabled ? 1 : 0.46
            accessibilityTraits = isEnabled ? [.button] : [.button, .notEnabled]
        }
    }

    override var isSelected: Bool {
        didSet {
            backgroundColor = isSelected ? AlmidyDesignTokens.Color.accentMutedSurface : .clear
            accessibilityTraits = isSelected ? [.button, .selected] : [.button]
        }
    }
}
