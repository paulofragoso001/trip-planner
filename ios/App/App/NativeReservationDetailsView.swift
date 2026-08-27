import UIKit

final class NativeReservationDetailsView: UIView {
    static let rowHeight: CGFloat = 52
    static let labelWidth: CGFloat = 138
    static let rowSpacing: CGFloat = 18
    static let separatorHeight: CGFloat = 0.5
    static let contentMargins = UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16)

    let fields: [String: UITextField]

    init(rows: [(label: String, placeholder: String)], onChange: @escaping () -> Void) {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 0
        stack.backgroundColor = .systemBackground
        stack.layer.cornerRadius = 18
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = Self.contentMargins

        var fields: [String: UITextField] = [:]
        for (index, row) in rows.enumerated() {
            let label = UILabel()
            label.text = row.label
            label.font = .systemFont(ofSize: 17, weight: .regular)
            label.setContentCompressionResistancePriority(.required, for: .horizontal)

            let value = NativeReservationTextField(onChange: onChange)
            value.placeholder = row.placeholder
            value.font = .systemFont(ofSize: 17, weight: .regular)
            value.textAlignment = .left
            value.accessibilityLabel = row.label
            value.accessibilityIdentifier = "native-reservation-\(Self.identifierComponent(row.label))"
            if row.label.contains("Airport Code") {
                value.autocapitalizationType = .allCharacters
                value.autocorrectionType = .no
            }
            fields[row.label] = value

            let line = UIStackView(arrangedSubviews: [label, value])
            line.axis = .horizontal
            line.alignment = .center
            line.spacing = Self.rowSpacing
            line.heightAnchor.constraint(equalToConstant: Self.rowHeight).isActive = true
            label.widthAnchor.constraint(equalToConstant: Self.labelWidth).isActive = true
            stack.addArrangedSubview(line)
            if index < rows.count - 1 {
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
        accessibilityIdentifier = "native-reservation-details"
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private static func identifierComponent(_ label: String) -> String {
        label.lowercased().replacingOccurrences(of: " ", with: "-")
    }
}

private final class NativeReservationTextField: UITextField {
    private let onChange: () -> Void

    init(onChange: @escaping () -> Void) {
        self.onChange = onChange
        super.init(frame: .zero)
        addTarget(self, action: #selector(valueChanged), for: .editingChanged)
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    @objc private func valueChanged() { onChange() }
}
