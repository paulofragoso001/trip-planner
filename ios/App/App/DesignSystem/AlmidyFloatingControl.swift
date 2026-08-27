import UIKit

final class AlmidyFloatingControl: UIView {
    enum Style { case neutral, accent, map }

    let button: AlmidyIconButton
    let semanticStyle: Style
    let semanticDiameter: CGFloat

    init(symbol: String, style: Style = .neutral, accessibilityLabel: String) {
        semanticStyle = style
        let configuration: (AlmidyIconButton.Style, AlmidyIconButton.Overrides)
        switch style {
        case .neutral:
            configuration = (.floating, .init(diameter: 50))
        case .accent:
            configuration = (.prominent, .init(diameter: 62, symbolPointSize: 27))
        case .map:
            configuration = (.floating, .init(diameter: AlmidyDesignTokens.Size.mapControl))
        }
        button = AlmidyIconButton(
            symbol: symbol,
            style: configuration.0,
            accessibilityLabel: accessibilityLabel,
            overrides: configuration.1
        )
        semanticDiameter = button.semanticDiameter
        super.init(frame: .zero)
        button.translatesAutoresizingMaskIntoConstraints = false
        addSubview(button)
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: semanticDiameter),
            heightAnchor.constraint(equalToConstant: semanticDiameter),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
