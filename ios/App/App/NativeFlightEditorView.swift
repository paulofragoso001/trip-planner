import UIKit

struct NativeFlightEditorConfiguration: Equatable {
    let title = "Flight Route"
    let primaryFields = ["Flight Number", "Airline", "Airline IATA Code"]
    let departureTitle = "Add Departure Location"
    let arrivalTitle = "Add Arrival Location"
    let detailRows: [(label: String, placeholder: String)] = [
        ("Departure Airport Code", "IATA"),
        ("Departure Terminal", "Terminal"),
        ("Departure Gate", "Gate"),
        ("Arrival Airport Code", "IATA"),
        ("Arrival Terminal", "Terminal"),
        ("Arrival Gate", "Gate"),
        ("Reservation Code", "ABC123"),
        ("Seat", "3B"),
        ("Seat Class", "Economy Premium")
    ]

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.title == rhs.title && lhs.primaryFields == rhs.primaryFields &&
            lhs.departureTitle == rhs.departureTitle && lhs.arrivalTitle == rhs.arrivalTitle &&
            lhs.detailRows.map(\.label) == rhs.detailRows.map(\.label) &&
            lhs.detailRows.map(\.placeholder) == rhs.detailRows.map(\.placeholder)
    }
}

final class NativeFlightEditorView: UIView {
    static let sectionSpacing: CGFloat = 14

    let primaryFields: [String: UITextField]
    let detailFields: [String: UITextField]

    init(
        configuration: NativeFlightEditorConfiguration = .init(),
        initialAirline: String?,
        initialAirlineIATACode: String?,
        initialFlightNumber: String?,
        routeSections: [UIView],
        costAction: UIView,
        noteAction: UIView,
        attachmentAction: UIView,
        onChange: @escaping () -> Void
    ) {
        let primary = NativeFlightPrimaryFieldsView(
            initialAirline: initialAirline,
            initialAirlineIATACode: initialAirlineIATACode,
            initialFlightNumber: initialFlightNumber,
            onChange: onChange
        )
        let details = NativeReservationDetailsView(rows: configuration.detailRows, onChange: onChange)
        primaryFields = primary.fields
        detailFields = details.fields
        super.init(frame: .zero)

        let stack = UIStackView(arrangedSubviews:
            [primary] + routeSections + [details, costAction, noteAction, attachmentAction]
        )
        stack.axis = .vertical
        stack.spacing = Self.sectionSpacing
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        accessibilityIdentifier = "native-flight-editor-content"
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class NativeFlightPrimaryFieldsView: UIView {
    let fields: [String: UITextField]

    init(
        initialAirline: String?,
        initialAirlineIATACode: String?,
        initialFlightNumber: String?,
        onChange: @escaping () -> Void
    ) {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 0
        stack.backgroundColor = .systemBackground
        stack.layer.cornerRadius = 18
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16)
        let initialValues = [
            "Flight Number": initialFlightNumber,
            "Airline": initialAirline,
            "Airline IATA Code": initialAirlineIATACode
        ]
        var fields: [String: UITextField] = [:]
        for (index, name) in NativeFlightEditorConfiguration().primaryFields.enumerated() {
            let field = NativeFlightTextField(onChange: onChange)
            field.placeholder = name
            field.text = initialValues[name] ?? nil
            field.font = AlmidyDesignTokens.Font.body(17)
            field.heightAnchor.constraint(equalToConstant: 48).isActive = true
            field.accessibilityLabel = name
            field.accessibilityIdentifier = "native-flight-\(name.lowercased().replacingOccurrences(of: " ", with: "-"))"
            if name == "Airline IATA Code" {
                field.autocapitalizationType = .allCharacters
                field.autocorrectionType = .no
            }
            fields[name] = field
            stack.addArrangedSubview(field)
            if index < NativeFlightEditorConfiguration().primaryFields.count - 1 {
                let divider = UIView()
                divider.backgroundColor = .separator
                divider.heightAnchor.constraint(equalToConstant: 0.5).isActive = true
                stack.addArrangedSubview(divider)
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
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class NativeFlightTextField: UITextField {
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
