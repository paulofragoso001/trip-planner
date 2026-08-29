import UIKit

final class NativeLocationCategoryView: UIView {
    static let height: CGFloat = 76
    static let iconSize: CGFloat = 48
    static let contentMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)

    init(category: String, accent: UIColor, onChangeCategory: @escaping () -> Void) {
        super.init(frame: .zero)
        let iconContainer = UIView()
        iconContainer.backgroundColor = accent.withAlphaComponent(0.12)
        iconContainer.layer.cornerRadius = Self.iconSize / 2
        iconContainer.widthAnchor.constraint(equalToConstant: Self.iconSize).isActive = true
        iconContainer.heightAnchor.constraint(equalToConstant: Self.iconSize).isActive = true

        let icon = UIImageView(image: UIImage(systemName: "mappin"))
        icon.tintColor = accent
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.isAccessibilityElement = false
        iconContainer.addSubview(icon)
        NSLayoutConstraint.activate([
            icon.centerXAnchor.constraint(equalTo: iconContainer.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconContainer.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24)
        ])

        let title = UILabel()
        title.text = category
        title.textColor = .label
        title.font = AlmidyDesignTokens.Font.semibold(18)
        let change = UILabel()
        change.text = "Change Category"
        change.textColor = accent
        change.font = AlmidyDesignTokens.Font.body(17)
        let labels = UIStackView(arrangedSubviews: [title, change])
        labels.axis = .vertical
        labels.spacing = 2

        let row = NativeLocationCategoryRow(
            arrangedSubviews: [iconContainer, labels, UIView()],
            onActivate: onChangeCategory
        )
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 14
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = Self.contentMargins
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.heightAnchor.constraint(equalToConstant: Self.height)
        ])

        row.accessibilityTraits = .button
        row.accessibilityLabel = "Location, Change Category"
        row.accessibilityIdentifier = "native-location-category"
    }

    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

final class NativeLocationScheduleView: UIView {
    static let height: CGFloat = 64
    static let minimumControlWidth: CGFloat = 60
    static let contentMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)

    let dateButton = UIButton(type: .system)
    let timeButton = UIButton(type: .system)

    init(title: String, onDate: @escaping () -> Void, onTime: @escaping () -> Void) {
        super.init(frame: .zero)
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.textColor = .secondaryLabel
        titleLabel.font = AlmidyDesignTokens.Font.semibold(18)

        Self.configure(dateButton, title: "Date")
        Self.configure(timeButton, title: "Time")
        dateButton.addAction(UIAction { _ in onDate() }, for: .touchUpInside)
        timeButton.addAction(UIAction { _ in onTime() }, for: .touchUpInside)
        dateButton.accessibilityIdentifier = "native-location-\(title.lowercased())-date"
        timeButton.accessibilityIdentifier = "native-location-\(title.lowercased())-time"

        let row = UIStackView(arrangedSubviews: [titleLabel, UIView(), dateButton, timeButton])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 4
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = Self.contentMargins
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.heightAnchor.constraint(equalToConstant: Self.height)
        ])
        accessibilityIdentifier = "native-location-\(title.lowercased())-schedule"
    }

    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private static func configure(_ button: UIButton, title: String) {
        button.setTitle(title, for: .normal)
        button.tintColor = .label
        button.backgroundColor = .secondarySystemFill
        button.layer.cornerRadius = 8
        button.contentEdgeInsets = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
        button.widthAnchor.constraint(greaterThanOrEqualToConstant: minimumControlWidth).isActive = true
    }
}

final class NativeLocationDetailsView: UIView {
    static let rows = [
        (label: "Phone", placeholder: "(XXX) XXX-XXXX"),
        (label: "Website", placeholder: "https://almidy.app"),
        (label: "Reservation Code", placeholder: "ABC123")
    ]
    static let rowHeight: CGFloat = 52
    static let labelWidth: CGFloat = 138
    static let rowSpacing: CGFloat = 18
    static let separatorHeight: CGFloat = 0.5
    static let contentMargins = UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16)

    let fields: [String: UITextField]

    init(onChange: @escaping () -> Void) {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 0
        stack.backgroundColor = .systemBackground
        stack.layer.cornerRadius = 18
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = Self.contentMargins

        var fields: [String: UITextField] = [:]
        for (index, row) in Self.rows.enumerated() {
            let label = UILabel()
            label.text = row.label
            label.font = AlmidyDesignTokens.Font.body(17)
            label.setContentCompressionResistancePriority(.required, for: .horizontal)
            let value = NativeLocationTextField(onChange: onChange)
            value.placeholder = row.placeholder
            value.font = AlmidyDesignTokens.Font.body(17)
            value.textAlignment = .left
            value.accessibilityLabel = row.label
            value.accessibilityIdentifier = "native-location-\(row.label.lowercased().replacingOccurrences(of: " ", with: "-"))"
            fields[row.label] = value
            let line = UIStackView(arrangedSubviews: [label, value])
            line.axis = .horizontal
            line.alignment = .center
            line.spacing = Self.rowSpacing
            line.heightAnchor.constraint(equalToConstant: Self.rowHeight).isActive = true
            label.widthAnchor.constraint(equalToConstant: Self.labelWidth).isActive = true
            stack.addArrangedSubview(line)
            if index < Self.rows.count - 1 {
                let separator = UIView()
                separator.backgroundColor = .separator
                separator.heightAnchor.constraint(equalToConstant: Self.separatorHeight).isActive = true
                stack.addArrangedSubview(separator)
            }
        }
        self.fields = fields
        super.init(frame: .zero)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        accessibilityIdentifier = "native-location-details"
    }

    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeLocationCategoryRow: UIStackView {
    private let onActivate: () -> Void

    init(arrangedSubviews: [UIView], onActivate: @escaping () -> Void) {
        self.onActivate = onActivate
        super.init(frame: .zero)
        arrangedSubviews.forEach(addArrangedSubview)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(activate)))
        isUserInteractionEnabled = true
    }

    @available(*, unavailable) required init(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func accessibilityActivate() -> Bool {
        onActivate()
        return true
    }

    @objc private func activate() { onActivate() }
}

private final class NativeLocationTextField: UITextField {
    private let onChange: () -> Void

    init(onChange: @escaping () -> Void) {
        self.onChange = onChange
        super.init(frame: .zero)
        addTarget(self, action: #selector(valueChanged), for: .editingChanged)
    }

    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    @objc private func valueChanged() { onChange() }
}
