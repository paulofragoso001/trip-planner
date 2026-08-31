import UIKit

final class NativePlaceTravelModesView: UIStackView {
    static let height: CGFloat = 44
    static let cornerRadius: CGFloat = 22
    static let selectedCornerRadius: CGFloat = 18
    static let contentMargins = UIEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
    static let symbols = ["figure.walk", "car.fill", "bus.fill", "bicycle"]

    private(set) var buttons: [UIButton] = []
    private let onSelect: (Int) -> Void
    private var durations: [String]
    private var selectedIndex: Int

    init(durations: [String], selectedIndex: Int, onSelect: @escaping (Int) -> Void) {
        self.onSelect = onSelect
        self.durations = durations
        self.selectedIndex = selectedIndex
        super.init(frame: .zero)
        axis = .horizontal
        distribution = .fillEqually
        backgroundColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface
        layer.cornerRadius = Self.cornerRadius
        isLayoutMarginsRelativeArrangement = true
        layoutMargins = Self.contentMargins
        heightAnchor.constraint(equalToConstant: Self.height).isActive = true

        buttons = Self.symbols.enumerated().map { index, symbol in
            let duration = durations.indices.contains(index) ? durations[index] : ""
            let button = UIButton(type: .system)
            button.tag = index
            button.configuration = Self.configuration(
                symbol: symbol,
                duration: duration,
                selected: index == selectedIndex,
                traits: traitCollection
            )
            button.titleLabel?.numberOfLines = 1
            button.titleLabel?.lineBreakMode = .byClipping
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.68
            button.accessibilityLabel = "\(duration) travel time"
            button.accessibilityTraits = index == selectedIndex ? [.button, .selected] : .button
            button.addAction(UIAction { [weak self] _ in self?.select(index) }, for: .touchUpInside)
            return button
        }
        buttons.forEach(addArrangedSubview)
        accessibilityElements = buttons
        accessibilityIdentifier = "native-place-travel-modes"
    }

    @available(*, unavailable) required init(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func update(durations: [String], selectedIndex: Int) {
        self.durations = durations
        self.selectedIndex = selectedIndex
        for (index, button) in buttons.enumerated() {
            let duration = durations.indices.contains(index) ? durations[index] : ""
            button.configuration = Self.configuration(
                symbol: Self.symbols[index],
                duration: duration,
                selected: index == selectedIndex,
                traits: traitCollection
            )
            button.accessibilityLabel = "\(duration) travel time"
            button.accessibilityTraits = index == selectedIndex ? [.button, .selected] : .button
        }
    }

    private func select(_ index: Int) {
        onSelect(index)
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        guard previousTraitCollection == nil
            || previousTraitCollection?.hasDifferentColorAppearance(comparedTo: traitCollection) == true
        else { return }
        update(durations: durations, selectedIndex: selectedIndex)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        update(durations: durations, selectedIndex: selectedIndex)
    }

    private static func configuration(
        symbol: String,
        duration: String,
        selected: Bool,
        traits: UITraitCollection
    ) -> UIButton.Configuration {
        var configuration = UIButton.Configuration.plain()
        configuration.image = UIImage(systemName: symbol)
        let foreground = UIColor.label.resolvedColor(with: traits)
        var titleAttributes = AttributeContainer()
        titleAttributes.font = AlmidyDesignTokens.Font.body(14)
        titleAttributes.foregroundColor = foreground
        configuration.attributedTitle = AttributedString(duration, attributes: titleAttributes)
        configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 14, weight: .regular)
        configuration.imagePadding = 3
        configuration.baseForegroundColor = foreground
        configuration.imageColorTransformer = UIConfigurationColorTransformer { _ in foreground }
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 2, bottom: 4, trailing: 2)
        configuration.titleLineBreakMode = .byClipping
        configuration.background.backgroundColor = selected
            ? AlmidyDesignTokens.Color.settingsCard.resolvedColor(with: traits)
            : .clear
        configuration.background.cornerRadius = Self.selectedCornerRadius
        return configuration
    }
}

final class NativePlaceAccessibleActionView: UIView {
    private let onActivate: () -> Void

    init(child: UIView, insets: UIEdgeInsets, onActivate: @escaping () -> Void) {
        self.onActivate = onActivate
        super.init(frame: .zero)
        child.translatesAutoresizingMaskIntoConstraints = false
        addSubview(child)
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo: topAnchor, constant: insets.top),
            child.leadingAnchor.constraint(equalTo: leadingAnchor, constant: insets.left),
            child.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -insets.right),
            child.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -insets.bottom)
        ])
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(activate)))
        isAccessibilityElement = true
        accessibilityTraits = .link
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func accessibilityActivate() -> Bool {
        onActivate()
        return true
    }

    @objc private func activate() { onActivate() }
}
