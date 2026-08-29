import UIKit

private final class NativeTimeZoneSelectorViewController: UIViewController,
    UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate {
    private let accent: UIColor
    private let onChange: () -> Void
    private let searchBar = UISearchBar()
    private let tableView = UITableView(frame: .zero, style: .plain)
    private var filteredEntries = NativeTimeZoneEntry.representative

    init(accent: UIColor, onChange: @escaping () -> Void) {
        self.accent = accent
        self.onChange = onChange
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(.label, for: .normal)
        cancel.titleLabel?.font = AlmidyDesignTokens.Font.title(18)
        cancel.backgroundColor = .secondarySystemBackground
        cancel.layer.cornerRadius = 22
        cancel.addTarget(self, action: #selector(close), for: .touchUpInside)

        let title = UILabel()
        title.text = "Select Time Zone"
        title.font = AlmidyDesignTokens.Font.semibold(22)
        title.textAlignment = .center

        searchBar.placeholder = "Search"
        searchBar.searchBarStyle = .minimal
        searchBar.delegate = self
        searchBar.autocapitalizationType = .none
        searchBar.autocorrectionType = .no
        searchBar.accessibilityIdentifier = "timeZoneSearchField"

        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowHeight = 58
        tableView.estimatedRowHeight = 58
        tableView.keyboardDismissMode = .interactive

        [cancel, title, searchBar, tableView].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }
        view.addSubview(cancel)
        view.addSubview(title)
        view.addSubview(searchBar)
        view.addSubview(tableView)
        NSLayoutConstraint.activate([
            cancel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            cancel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cancel.widthAnchor.constraint(equalToConstant: 96),
            cancel.heightAnchor.constraint(equalToConstant: 44),
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: cancel.centerYAnchor),
            searchBar.topAnchor.constraint(equalTo: cancel.bottomAnchor, constant: 14),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            searchBar.heightAnchor.constraint(equalToConstant: 54),
            tableView.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 12),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    func numberOfSections(in tableView: UITableView) -> Int { 1 }
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        filteredEntries.count + 1
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "TimeZone")
            ?? UITableViewCell(style: .value1, reuseIdentifier: "TimeZone")
        if indexPath.row == 0 {
            cell.textLabel?.text = "Automatic"
            cell.detailTextLabel?.text = "Device Time Zone"
            cell.accessibilityValue = "Use Device Time Zone"
            cell.accessoryType = NativeTimeZonePreference.selectedIdentifier == nil ? .checkmark : .none
        } else {
            let entry = filteredEntries[indexPath.row - 1]
            cell.textLabel?.text = entry.displayName
            cell.detailTextLabel?.text = entry.offsetText()
            cell.accessibilityValue = "\(entry.offsetText()), \(entry.identifier)"
            cell.accessoryType = NativeTimeZonePreference.selectedIdentifier == entry.identifier ? .checkmark : .none
        }
        cell.textLabel?.font = AlmidyDesignTokens.Font.body(17)
        cell.textLabel?.textColor = .label
        cell.textLabel?.lineBreakMode = .byTruncatingTail
        cell.detailTextLabel?.font = AlmidyDesignTokens.Font.body(16)
        cell.detailTextLabel?.textColor = accent
        cell.detailTextLabel?.setContentCompressionResistancePriority(.required, for: .horizontal)
        cell.tintColor = accent
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        NativeTimeZonePreference.select(indexPath.row == 0 ? nil : filteredEntries[indexPath.row - 1].identifier)
        dismiss(animated: true) { self.onChange() }
    }

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).folding(
            options: [.caseInsensitive, .diacriticInsensitive], locale: .current
        )
        filteredEntries = query.isEmpty
            ? NativeTimeZoneEntry.representative
            : NativeTimeZoneEntry.representative.filter { $0.searchText.contains(query) }
        tableView.reloadData()
    }

    @objc private func close() { dismiss(animated: true) }
}

final class NativeFlightTimeInputViewController: UIViewController {
    static var sheetConfiguration: AlmidySheetConfiguration {
        .editor.overriding(
            grabberVisible: false,
            scrollingExpandsWhenScrolledToEdge: true
        )
    }
    private let accent: UIColor
    private let onSave: (Date?) -> Void
    private var selectedDate: Date
    private let subtitleLabel = UILabel()
    private let timePicker = UIDatePicker()
    private let timeZoneButton = UIButton(type: .system)

    init(date: Date, accent: UIColor, onSave: @escaping (Date?) -> Void) {
        selectedDate = date
        self.accent = accent
        self.onSave = onSave
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
        cancelButton.titleLabel?.font = AlmidyDesignTokens.Font.title(16)
        cancelButton.backgroundColor = .secondarySystemBackground
        cancelButton.layer.cornerRadius = 18
        cancelButton.accessibilityIdentifier = "native-flight-time-cancel"
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let titleLabel = UILabel()
        titleLabel.text = "Change Date"
        titleLabel.font = AlmidyDesignTokens.Font.semibold(18)
        titleLabel.textAlignment = .center

        subtitleLabel.font = AlmidyDesignTokens.Font.body(14)
        subtitleLabel.textColor = accent
        subtitleLabel.textAlignment = .center
        updateSubtitle()

        let saveButton = UIButton(type: .system)
        saveButton.setTitle("Save", for: .normal)
        saveButton.setTitleColor(.white, for: .normal)
        saveButton.titleLabel?.font = AlmidyDesignTokens.Font.semibold(16)
        saveButton.backgroundColor = accent
        saveButton.layer.cornerRadius = 18
        saveButton.accessibilityIdentifier = "native-flight-time-save"
        saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)

        let separator = UIView()
        separator.backgroundColor = .separator

        timePicker.datePickerMode = .time
        timePicker.preferredDatePickerStyle = .wheels
        timePicker.date = selectedDate
        timePicker.minuteInterval = 1
        timePicker.addTarget(self, action: #selector(timeChanged), for: .valueChanged)
        timePicker.accessibilityIdentifier = "flightTimePicker"

        timeZoneButton.setTitleColor(accent, for: .normal)
        timeZoneButton.titleLabel?.font = AlmidyDesignTokens.Font.semibold(16)
        timeZoneButton.backgroundColor = accent.withAlphaComponent(0.12)
        timeZoneButton.layer.cornerRadius = 14
        timeZoneButton.clipsToBounds = true
        timeZoneButton.accessibilityIdentifier = "native-flight-time-zone"
        timeZoneButton.addTarget(self, action: #selector(selectTimeZone), for: .touchUpInside)
        updateTimeZoneButton()

        let clearButton = UIButton(type: .system)
        clearButton.setTitle("Clear Time", for: .normal)
        clearButton.setTitleColor(.systemRed, for: .normal)
        clearButton.titleLabel?.font = AlmidyDesignTokens.Font.semibold(17)
        clearButton.backgroundColor = UIColor.systemRed.withAlphaComponent(0.1)
        clearButton.layer.cornerRadius = 14
        clearButton.accessibilityIdentifier = "native-flight-time-clear"
        clearButton.addTarget(self, action: #selector(clearTime), for: .touchUpInside)

        [cancelButton, titleLabel, subtitleLabel, saveButton, separator, timePicker, timeZoneButton, clearButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }
        view.addSubview(cancelButton)
        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)
        view.addSubview(saveButton)
        view.addSubview(separator)
        view.addSubview(timePicker)
        view.addSubview(timeZoneButton)
        view.addSubview(clearButton)

        let timeGapOne = UILayoutGuide()
        let timeGapTwo = UILayoutGuide()
        let timeGapThree = UILayoutGuide()
        view.addLayoutGuide(timeGapOne)
        view.addLayoutGuide(timeGapTwo)
        view.addLayoutGuide(timeGapThree)

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cancelButton.widthAnchor.constraint(equalToConstant: 78),
            cancelButton.heightAnchor.constraint(equalToConstant: 36),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor, constant: -6),
            subtitleLabel.centerXAnchor.constraint(equalTo: titleLabel.centerXAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: -1),
            saveButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            saveButton.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor),
            saveButton.widthAnchor.constraint(equalToConstant: 64),
            saveButton.heightAnchor.constraint(equalToConstant: 36),
            separator.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 10),
            separator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            separator.heightAnchor.constraint(equalToConstant: 0.5),
            timePicker.topAnchor.constraint(equalTo: separator.bottomAnchor, constant: 10),
            timePicker.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            timePicker.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 52),
            timePicker.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -52),
            timePicker.heightAnchor.constraint(equalToConstant: 190),
            timeGapOne.topAnchor.constraint(equalTo: timePicker.bottomAnchor),
            timeGapOne.bottomAnchor.constraint(equalTo: timeZoneButton.topAnchor),
            timeZoneButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            timeZoneButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            timeZoneButton.heightAnchor.constraint(equalToConstant: 42),
            timeGapTwo.topAnchor.constraint(equalTo: timeZoneButton.bottomAnchor),
            timeGapTwo.bottomAnchor.constraint(equalTo: clearButton.topAnchor),
            clearButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            clearButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            clearButton.heightAnchor.constraint(equalToConstant: 42),
            timeGapThree.topAnchor.constraint(equalTo: clearButton.bottomAnchor),
            timeGapThree.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            timeGapOne.heightAnchor.constraint(equalTo: timeGapThree.heightAnchor),
            timeGapTwo.heightAnchor.constraint(equalToConstant: 10),
            timeGapOne.heightAnchor.constraint(greaterThanOrEqualToConstant: 4)
        ])
    }

    private func updateSubtitle() {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d 'at' h:mm a"
        formatter.timeZone = NativeTimeZonePreference.timeZone
        subtitleLabel.text = formatter.string(from: selectedDate)
    }

    private func updateTimeZoneButton() {
        let value = NativeTimeZonePreference.selectedIdentifier ?? "Automatic"
        timeZoneButton.setTitle("Time Zone: \(value)", for: .normal)
        timePicker.timeZone = NativeTimeZonePreference.timeZone
        updateSubtitle()
    }

    @objc private func selectTimeZone() {
        let controller = NativeTimeZoneSelectorViewController(accent: accent) { [weak self] in
            self?.updateTimeZoneButton()
        }
        Self.sheetConfiguration.apply(to: controller)
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
        }
        present(controller, animated: true)
    }

    @objc private func timeChanged() {
        let calendar = Calendar.current
        let time = calendar.dateComponents([.hour, .minute], from: timePicker.date)
        selectedDate = calendar.date(bySettingHour: time.hour ?? 0, minute: time.minute ?? 0, second: 0, of: selectedDate) ?? timePicker.date
        updateSubtitle()
    }

    @objc private func cancel() { dismiss(animated: true) }
    @objc private func save() {
        let value = selectedDate
        dismiss(animated: true) { self.onSave(value) }
    }
    @objc private func clearTime() {
        dismiss(animated: true) { self.onSave(nil) }
    }
}
