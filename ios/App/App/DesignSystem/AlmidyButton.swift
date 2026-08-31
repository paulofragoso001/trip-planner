import UIKit

final class AlmidyButton: UIButton {
    enum Style { case primary, secondary, tertiary, destructive }
    enum Size { case compact, standard }

    let semanticStyle: Style
    let semanticSize: Size
    let semanticHeight: CGFloat
    private(set) var isLoading = false

    private let spinner = UIActivityIndicatorView(style: .medium)
    private var normalTitle: String?

    init(title: String, style: Style = .primary, size: Size = .standard) {
        semanticStyle = style
        semanticSize = size
        semanticHeight = size == .compact
            ? AlmidyDesignTokens.Size.buttonCompact
            : AlmidyDesignTokens.Size.buttonStandard
        super.init(frame: .zero)

        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(greaterThanOrEqualToConstant: semanticHeight).isActive = true
        contentEdgeInsets = UIEdgeInsets(
            top: AlmidyDesignTokens.Spacing.sm,
            left: AlmidyDesignTokens.Spacing.lg,
            bottom: AlmidyDesignTokens.Spacing.sm,
            right: AlmidyDesignTokens.Spacing.lg
        )
        normalTitle = title
        setTitle(title, for: .normal)
        AlmidyDesignTokens.Typography.action.apply(to: self)
        titleLabel?.numberOfLines = 0
        titleLabel?.textAlignment = .center
        layer.cornerRadius = AlmidyDesignTokens.Radius.control
        accessibilityTraits.insert(.button)

        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.hidesWhenStopped = true
        addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
        applyStyle()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.hasDifferentColorAppearance(comparedTo: traitCollection) == true { applyStyle() }
    }

    override var isHighlighted: Bool {
        didSet { alpha = isHighlighted ? 0.78 : 1 }
    }

    override var isEnabled: Bool {
        didSet { applyStyle() }
    }

    func setLoading(_ loading: Bool) {
        guard isLoading != loading else { return }
        isLoading = loading
        isUserInteractionEnabled = !loading
        setTitle(loading ? nil : normalTitle, for: .normal)
        loading ? spinner.startAnimating() : spinner.stopAnimating()
        accessibilityValue = loading ? "Loading" : nil
    }

    private func applyStyle() {
        if !isEnabled {
            backgroundColor = AlmidyDesignTokens.Color.stateDisabledFill
            setTitleColor(AlmidyDesignTokens.Color.stateDisabledText, for: .normal)
            layer.borderWidth = 0
            return
        }

        switch semanticStyle {
        case .primary:
            backgroundColor = AlmidyDesignTokens.Color.accent
            setTitleColor(AlmidyDesignTokens.Color.textPrimary, for: .normal)
            layer.borderWidth = 0
        case .secondary:
            backgroundColor = AlmidyDesignTokens.Color.surface
            setTitleColor(AlmidyDesignTokens.Color.textPrimary, for: .normal)
            AlmidyDesignTokens.Border.outline.apply(to: self)
        case .tertiary:
            backgroundColor = .clear
            setTitleColor(AlmidyDesignTokens.Color.accentText, for: .normal)
            layer.borderWidth = 0
        case .destructive:
            backgroundColor = AlmidyDesignTokens.Color.danger
            setTitleColor(AlmidyDesignTokens.Color.onMediaPrimary, for: .normal)
            layer.borderWidth = 0
        }
    }
}
