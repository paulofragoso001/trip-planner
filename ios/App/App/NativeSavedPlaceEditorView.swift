import UIKit

final class NativeSavedPlaceEditorView: UIView {
    static let sectionSpacing: CGFloat = 14

    let primaryFields: [String: UITextField]
    let detailFields: [String: UITextField]
    let checkInDateButton: UIButton
    let checkInTimeButton: UIButton
    let checkOutDateButton: UIButton
    let checkOutTimeButton: UIButton

    init(
        category: String,
        accent: UIColor,
        costAction: UIView,
        noteAction: UIView,
        attachmentAction: UIView,
        onChangeCategory: @escaping () -> Void,
        onChange: @escaping () -> Void,
        onCheckInDate: @escaping () -> Void,
        onCheckInTime: @escaping () -> Void,
        onCheckOutDate: @escaping () -> Void,
        onCheckOutTime: @escaping () -> Void
    ) {
        let categoryView = NativeLocationCategoryView(
            category: category,
            accent: accent,
            onChangeCategory: onChangeCategory
        )
        let primary = NativeSavedPlacePrimaryFieldsView(onChange: onChange)
        let checkIn = NativeLocationScheduleView(
            title: "Check-in",
            onDate: onCheckInDate,
            onTime: onCheckInTime
        )
        let checkOut = NativeLocationScheduleView(
            title: "Check-out",
            onDate: onCheckOutDate,
            onTime: onCheckOutTime
        )
        let details = NativeLocationDetailsView(onChange: onChange)
        primaryFields = primary.fields
        detailFields = details.fields
        checkInDateButton = checkIn.dateButton
        checkInTimeButton = checkIn.timeButton
        checkOutDateButton = checkOut.dateButton
        checkOutTimeButton = checkOut.timeButton
        super.init(frame: .zero)

        let stack = UIStackView(arrangedSubviews: [
            categoryView,
            primary,
            checkIn,
            checkOut,
            details,
            costAction,
            noteAction,
            attachmentAction
        ])
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
        accessibilityIdentifier = "native-saved-place-editor-content"
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

final class NativeSavedPlaceAutosaveGeneration {
    private(set) var current = 0

    @discardableResult
    func advance() -> Int {
        current += 1
        return current
    }

    func isCurrent(_ generation: Int) -> Bool {
        generation == current
    }
}

private final class NativeSavedPlacePrimaryFieldsView: UIView {
    let fields: [String: UITextField]

    init(onChange: @escaping () -> Void) {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 0
        stack.backgroundColor = .systemBackground
        stack.layer.cornerRadius = 18
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16)

        var fields: [String: UITextField] = [:]
        for (index, name) in ["Name", "Address"].enumerated() {
            let field = NativeSavedPlaceTextField(onChange: onChange)
            field.placeholder = name
            field.font = .systemFont(ofSize: 17)
            field.heightAnchor.constraint(equalToConstant: 48).isActive = true
            field.accessibilityLabel = name
            field.accessibilityIdentifier = "native-flight-\(name.lowercased())"
            fields[name] = field
            stack.addArrangedSubview(field)
            if index == 0 {
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
        accessibilityIdentifier = "native-saved-place-primary-fields"
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class NativeSavedPlaceTextField: UITextField {
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
