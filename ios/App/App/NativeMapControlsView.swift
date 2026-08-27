import UIKit

final class NativeMapControlsView: UIStackView {
    static let controlSize: CGFloat = 48
    static let clusterSpacing: CGFloat = 8
    static let groupedSpacing: CGFloat = 1
    static let separatorSize = CGSize(width: 30, height: 1)

    let mapStyleButton: AlmidyIconButton
    let locationButton: AlmidyIconButton
    let orientationButton: AlmidyIconButton

    init(
        onMapStyle: @escaping () -> Void,
        onLocation: @escaping () -> Void,
        onOrientation: @escaping () -> Void
    ) {
        mapStyleButton = Self.makeButton(
            symbol: "globe.americas.fill",
            label: "Change map style",
            hint: "Opens map appearance and route preferences",
            action: onMapStyle
        )
        locationButton = Self.makeButton(
            symbol: "location.fill",
            label: "Recenter on current location",
            hint: "Moves the globe to your current location",
            action: onLocation
        )
        orientationButton = Self.makeButton(
            symbol: "scope",
            label: "Reset map orientation",
            hint: "Points north while preserving the current location and zoom",
            action: onOrientation
        )
        super.init(frame: .zero)

        axis = .vertical
        alignment = .center
        spacing = Self.clusterSpacing
        backgroundColor = .clear
        clipsToBounds = false

        let separator = AlmidyDivider(color: UIColor.black.withAlphaComponent(0.18))
        NSLayoutConstraint.activate([
            separator.widthAnchor.constraint(equalToConstant: Self.separatorSize.width),
            separator.heightAnchor.constraint(equalToConstant: Self.separatorSize.height)
        ])
        let grouped = UIStackView(arrangedSubviews: [mapStyleButton, separator, locationButton])
        grouped.axis = .vertical
        grouped.alignment = .center
        grouped.spacing = Self.groupedSpacing
        grouped.backgroundColor = UIColor(white: 0.82, alpha: 0.86)
        grouped.layer.cornerRadius = Self.controlSize / 2
        grouped.layer.borderWidth = 0.75
        grouped.layer.borderColor = UIColor.white.withAlphaComponent(0.58).cgColor
        grouped.clipsToBounds = true

        orientationButton.backgroundColor = UIColor(white: 0.68, alpha: 0.88)
        orientationButton.layer.borderWidth = 0.75
        orientationButton.layer.borderColor = UIColor.white.withAlphaComponent(0.50).cgColor

        addArrangedSubview(grouped)
        addArrangedSubview(orientationButton)
        widthAnchor.constraint(equalToConstant: Self.controlSize).isActive = true
        accessibilityElements = [mapStyleButton, locationButton, orientationButton]
        accessibilityIdentifier = "native-map-control-cluster"
    }

    @available(*, unavailable) required init(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private static func makeButton(
        symbol: String,
        label: String,
        hint: String,
        action: @escaping () -> Void
    ) -> AlmidyIconButton {
        let button = AlmidyIconButton(
            symbol: symbol,
            style: .floating,
            accessibilityLabel: label,
            overrides: .init(
                diameter: Self.controlSize,
                foregroundColor: .black,
                backgroundColor: .clear
            )
        )
        // The enclosing map surfaces own the existing border and elevation.
        button.layer.shadowOpacity = 0
        button.accessibilityHint = hint
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }
}
