import UIKit

struct NativeTransportationEditorConfiguration: Equatable {
    let kind: TransportationActivityDraft.Kind
    let title: String
    let primaryFields: [String]
    let departureTitle: String
    let arrivalTitle: String
    let detailRows: [(label: String, placeholder: String)]

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.kind == rhs.kind && lhs.title == rhs.title &&
            lhs.primaryFields == rhs.primaryFields &&
            lhs.departureTitle == rhs.departureTitle &&
            lhs.arrivalTitle == rhs.arrivalTitle &&
            lhs.detailRows.map(\.label) == rhs.detailRows.map(\.label) &&
            lhs.detailRows.map(\.placeholder) == rhs.detailRows.map(\.placeholder)
    }

    init?(kind: TransportationActivityDraft.Kind) {
        guard kind != .flight else { return nil }
        self.kind = kind
        switch kind {
        case .flight:
            return nil
        case .car:
            title = "Car Route"
            primaryFields = ["Route Name", "Company"]
            departureTitle = "Add Departure Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails + [("Vehicle", "Vehicle model")]
        case .train:
            title = "Train Route"
            primaryFields = ["Route Name", "Transport Number", "Company"]
            departureTitle = "Add Departure Station"
            arrivalTitle = "Add Arrival Station"
            detailRows = Self.standardDetails + [
                ("Coach Number", "1A"), ("Seat", "3B"),
                ("Seat Class", "Economy Premium"), ("Train Type", "Intercity")
            ]
        case .carRental:
            title = "Car Rental"
            primaryFields = ["Name", "Company"]
            departureTitle = "Add Pick-up Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails + [("Vehicle", "Vehicle model")]
        case .transfer:
            title = "Transfer Route"
            primaryFields = ["Route Name", "Company"]
            departureTitle = "Add Departure Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails + [("Vehicle", "Vehicle model")]
        case .cruise:
            title = "Cruise Route"
            primaryFields = ["Route Name", "Transport Number", "Company"]
            departureTitle = "Add Departure Port"
            arrivalTitle = "Add Arrival Port"
            detailRows = Self.standardDetails + [("Seat", "3B")]
        case .walk:
            title = "Walk Route"
            primaryFields = ["Route Name"]
            departureTitle = "Add Departure Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails
        case .bus:
            title = "Bus Route"
            primaryFields = ["Route Name", "Transport Number", "Company"]
            departureTitle = "Add Departure Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails + [("Seat", "3B"), ("Seat Class", "Economy Premium")]
        case .bike:
            title = "Bike Route"
            primaryFields = ["Route Name"]
            departureTitle = "Add Departure Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails + [("Vehicle", "Bike model")]
        case .ferry:
            title = "Ferry Route"
            primaryFields = ["Route Name", "Transport Number", "Company"]
            departureTitle = "Add Departure Port"
            arrivalTitle = "Add Arrival Port"
            detailRows = Self.standardDetails + [("Seat", "3B")]
        case .motorcycle:
            title = "Motorcycle Route"
            primaryFields = ["Route Name"]
            departureTitle = "Add Departure Location"
            arrivalTitle = "Add Arrival Location"
            detailRows = Self.standardDetails + [("Vehicle", "Motorcycle model")]
        }
    }

    private static let standardDetails: [(String, String)] = [
        ("Phone", "(XXX) XXX-XXXX"),
        ("Website", "https://almidy.app"),
        ("Reservation Code", "ABC123")
    ]
}

final class NativeTransportationEditorView: UIView {
    static let sectionSpacing: CGFloat = 14

    let primaryFields: [String: UITextField]
    let detailFields: [String: UITextField]

    init(
        configuration: NativeTransportationEditorConfiguration,
        routeSections: [UIView],
        costAction: UIView,
        noteAction: UIView,
        attachmentAction: UIView,
        onChange: @escaping () -> Void
    ) {
        let primary = NativeTransportationPrimaryFieldsView(
            fields: configuration.primaryFields,
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
        accessibilityIdentifier = "native-transportation-editor-content"
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class NativeTransportationPrimaryFieldsView: UIView {
    let fields: [String: UITextField]

    init(fields names: [String], onChange: @escaping () -> Void) {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 0
        stack.backgroundColor = .systemBackground
        stack.layer.cornerRadius = 18
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16)
        var fields: [String: UITextField] = [:]
        for (index, name) in names.enumerated() {
            let field = NativeTransportationTextField(onChange: onChange)
            field.placeholder = name
            field.font = AlmidyDesignTokens.Font.body(17)
            field.heightAnchor.constraint(equalToConstant: 48).isActive = true
            field.accessibilityLabel = name
            field.accessibilityIdentifier = "native-flight-\(name.lowercased().replacingOccurrences(of: " ", with: "-"))"
            fields[name] = field
            stack.addArrangedSubview(field)
            if index < names.count - 1 {
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

private final class NativeTransportationTextField: UITextField {
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
