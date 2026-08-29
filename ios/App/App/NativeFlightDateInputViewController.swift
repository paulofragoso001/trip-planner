import UIKit

final class NativeFlightDateInputViewController: UIViewController {
    static var sheetConfiguration: AlmidySheetConfiguration {
        .editor.overriding(
            grabberVisible: false,
            scrollingExpandsWhenScrolledToEdge: true
        )
    }

    private let accent: UIColor
    private let onSave: (Date?) -> Void
    private var selectedDate: Date?
    private let datePicker = UIDatePicker()
    private let saveButton = UIButton(type: .system)
    private let selectedDateLabel = UILabel()

    init(accent: UIColor, onSave: @escaping (Date?) -> Void) {
        self.accent = accent
        self.onSave = onSave
        selectedDate = Calendar.current.startOfDay(for: Date())
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(accent, for: .normal)
        cancelButton.titleLabel?.font = AlmidyDesignTokens.Font.title(17)
        cancelButton.backgroundColor = .secondarySystemBackground
        cancelButton.layer.cornerRadius = 22
        cancelButton.accessibilityIdentifier = "native-flight-date-cancel"
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let titleLabel = UILabel()
        titleLabel.text = "Change Date"
        titleLabel.font = AlmidyDesignTokens.Font.semibold(20)
        titleLabel.textAlignment = .center

        selectedDateLabel.font = AlmidyDesignTokens.Font.body(15)
        selectedDateLabel.textColor = accent
        selectedDateLabel.textAlignment = .center
        selectedDateLabel.accessibilityIdentifier = "native-flight-date-selection"
        updateSelectedDateLabel()

        saveButton.setTitle("Save", for: .normal)
        saveButton.setTitleColor(.white, for: .normal)
        saveButton.titleLabel?.font = AlmidyDesignTokens.Font.semibold(17)
        saveButton.backgroundColor = accent
        saveButton.layer.cornerRadius = 22
        saveButton.accessibilityIdentifier = "native-flight-date-save"
        saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)

        let separator = UIView()
        separator.backgroundColor = .separator

        datePicker.datePickerMode = .date
        datePicker.preferredDatePickerStyle = .inline
        datePicker.tintColor = accent
        datePicker.date = selectedDate ?? Date()
        datePicker.addTarget(self, action: #selector(dateChanged), for: .valueChanged)
        datePicker.accessibilityIdentifier = "flightDatePicker"

        let today = shortcutButton(title: "Today", date: Date())
        today.accessibilityIdentifier = "native-flight-date-today"
        let tomorrowDate = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        let tomorrow = shortcutButton(title: "Tomorrow", date: tomorrowDate)
        tomorrow.accessibilityIdentifier = "native-flight-date-tomorrow"
        let shortcuts = UIStackView(arrangedSubviews: [today, tomorrow])
        shortcuts.axis = .horizontal
        shortcuts.distribution = .fillEqually
        shortcuts.spacing = 10

        let clearButton = UIButton(type: .system)
        clearButton.setTitle("Clear Date & Time", for: .normal)
        clearButton.setTitleColor(.systemRed, for: .normal)
        clearButton.titleLabel?.font = AlmidyDesignTokens.Font.semibold(18)
        clearButton.backgroundColor = UIColor.systemRed.withAlphaComponent(0.1)
        clearButton.layer.cornerRadius = 14
        clearButton.accessibilityIdentifier = "native-flight-date-clear"
        clearButton.addTarget(self, action: #selector(clearDate), for: .touchUpInside)

        [cancelButton, titleLabel, selectedDateLabel, saveButton, separator, datePicker, shortcuts, clearButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }
        view.addSubview(cancelButton)
        view.addSubview(titleLabel)
        view.addSubview(selectedDateLabel)
        view.addSubview(saveButton)
        view.addSubview(separator)
        view.addSubview(datePicker)
        view.addSubview(shortcuts)
        view.addSubview(clearButton)

        let dateGapOne = UILayoutGuide()
        let dateGapTwo = UILayoutGuide()
        let dateGapThree = UILayoutGuide()
        view.addLayoutGuide(dateGapOne)
        view.addLayoutGuide(dateGapTwo)
        view.addLayoutGuide(dateGapThree)

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cancelButton.widthAnchor.constraint(equalToConstant: 82),
            cancelButton.heightAnchor.constraint(equalToConstant: 40),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor, constant: -6),
            selectedDateLabel.centerXAnchor.constraint(equalTo: titleLabel.centerXAnchor),
            selectedDateLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: -1),
            saveButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            saveButton.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor),
            saveButton.widthAnchor.constraint(equalToConstant: 68),
            saveButton.heightAnchor.constraint(equalToConstant: 40),
            separator.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 12),
            separator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            separator.heightAnchor.constraint(equalToConstant: 0.5),
            datePicker.topAnchor.constraint(equalTo: separator.bottomAnchor, constant: 8),
            datePicker.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
            datePicker.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
            datePicker.heightAnchor.constraint(equalToConstant: 405),
            dateGapOne.topAnchor.constraint(equalTo: datePicker.bottomAnchor),
            dateGapOne.bottomAnchor.constraint(equalTo: shortcuts.topAnchor),
            shortcuts.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            shortcuts.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            shortcuts.heightAnchor.constraint(equalToConstant: 58),
            dateGapTwo.topAnchor.constraint(equalTo: shortcuts.bottomAnchor),
            dateGapTwo.bottomAnchor.constraint(equalTo: clearButton.topAnchor),
            clearButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            clearButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            clearButton.heightAnchor.constraint(equalToConstant: 48),
            dateGapThree.topAnchor.constraint(equalTo: clearButton.bottomAnchor),
            dateGapThree.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            dateGapOne.heightAnchor.constraint(equalTo: dateGapTwo.heightAnchor),
            dateGapTwo.heightAnchor.constraint(equalTo: dateGapThree.heightAnchor),
            dateGapOne.heightAnchor.constraint(greaterThanOrEqualToConstant: 4)
        ])
    }

    private func shortcutButton(title: String, date: Date) -> UIButton {
        let button = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.baseBackgroundColor = .secondarySystemBackground
        configuration.baseForegroundColor = .label
        configuration.cornerStyle = .medium
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        var attributedTitle = AttributedString("\(title)\n")
        attributedTitle.font = AlmidyDesignTokens.Font.semibold(16)
        var subtitle = AttributedString(formatter.string(from: date))
        subtitle.foregroundColor = .secondaryLabel
        subtitle.font = AlmidyDesignTokens.Font.body(15)
        attributedTitle.append(subtitle)
        configuration.attributedTitle = attributedTitle
        configuration.image = UIImage(systemName: "calendar.badge.plus")
        configuration.imagePadding = 10
        configuration.imagePlacement = .leading
        button.configuration = configuration
        button.contentHorizontalAlignment = .leading
        button.addAction(UIAction { [weak self] _ in self?.selectShortcut(date) }, for: .touchUpInside)
        return button
    }

    private func selectShortcut(_ date: Date) {
        let day = Calendar.current.startOfDay(for: date)
        selectedDate = day
        datePicker.setDate(day, animated: false)
        updateSelectedDateLabel()
        dismiss(animated: true) { self.onSave(day) }
    }

    private func updateSelectedDateLabel() {
        guard let selectedDate else {
            selectedDateLabel.text = nil
            return
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        selectedDateLabel.text = formatter.string(from: selectedDate)
    }

    @objc private func dateChanged() {
        selectedDate = datePicker.date
        updateSelectedDateLabel()
    }
    @objc private func clearDate() { selectedDate = nil; save() }
    @objc private func cancel() { dismiss(animated: true) }
    @objc private func save() {
        let value = selectedDate
        dismiss(animated: true) { self.onSave(value) }
    }
}
