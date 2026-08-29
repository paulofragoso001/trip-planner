import CoreLocation
import MapKit
import UIKit

final class NativeMapSearchViewController: UIViewController, MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate, UITextFieldDelegate {
    static var sheetConfiguration: AlmidySheetConfiguration {
        .utility.overriding(detents: [.medium(), .large()])
    }

    private let purpose: NativeActivityPurpose?
    private let onSelect: (CLLocationCoordinate2D) -> Void
    private let completer = MKLocalSearchCompleter()
    private var completions: [MKLocalSearchCompletion] = []

    private let queryField = UITextField()
    private let suggestionTable = UITableView(frame: .zero, style: .plain)
    private let emptyState: AlmidyEmptyState

    init(purpose: NativeActivityPurpose? = nil, onSelect: @escaping (CLLocationCoordinate2D) -> Void) {
        self.purpose = purpose
        self.onSelect = onSelect
        self.emptyState = AlmidyEmptyState(
            style: .empty,
            presentation: .messageOnly,
            title: "",
            message: purpose.map { "Start typing to search for \($0.canonicalName.lowercased())." }
                ?? "Start typing to search the globe."
        )
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.surface
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest, .query]
        configureSearch()
    }

    private var initialStatusText: String {
        guard let purpose else { return "Start typing to search the globe." }
        return "Start typing to search for \(purpose.canonicalName.lowercased())."
    }

    private func configureSearch() {
        let searchPlaceholder = purpose?.searchPlaceholder ?? "Search a city or place"
        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        cancelButton.setTitleColor(AlmidyDesignTokens.Color.goldSoft, for: .normal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        cancelButton.accessibilityLabel = "Close globe search"

        let title = UILabel()
        title.text = purpose.map { "Find \($0.canonicalName)" } ?? "Search the globe"
        title.font = AlmidyDesignTokens.Font.display(30)
        title.textColor = AlmidyDesignTokens.Color.textPrimary

        let subtitle = UILabel()
        subtitle.text = purpose.map { "Search places for \($0.canonicalName.lowercased()) on the globe." }
            ?? "Find a place and move the globe there."
        subtitle.font = AlmidyDesignTokens.Font.body(17)
        subtitle.textColor = AlmidyDesignTokens.Color.textSecondary

        queryField.placeholder = searchPlaceholder
        AlmidyInputStyle.search.apply(to: queryField)
        // Compatibility: Search's measured 18pt input predates the canonical
        // body role and remains fixed during migration-before-normalization.
        queryField.font = AlmidyDesignTokens.Font.body(18)
        queryField.adjustsFontForContentSizeCategory = false
        queryField.setPadding(16)
        queryField.clearButtonMode = .whileEditing
        queryField.returnKeyType = .search
        queryField.delegate = self
        queryField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)
        queryField.accessibilityLabel = searchPlaceholder

        emptyState.messageLabel.font = AlmidyDesignTokens.Font.body(16)
        emptyState.messageLabel.adjustsFontForContentSizeCategory = false
        emptyState.messageLabel.textColor = AlmidyDesignTokens.Color.searchEmptyState

        suggestionTable.register(UITableViewCell.self, forCellReuseIdentifier: "map-search-suggestion")
        suggestionTable.dataSource = self
        suggestionTable.delegate = self
        suggestionTable.isHidden = true
        suggestionTable.rowHeight = 68
        AlmidySurfaceStyle(
            backgroundColor: AlmidyDesignTokens.Color.card,
            cornerRadius: AlmidyDesignTokens.Radius.control,
            border: .init(width: 1, color: AlmidyDesignTokens.Color.line),
            elevation: nil
        ).apply(to: suggestionTable)

        [cancelButton, title, subtitle, queryField, emptyState, suggestionTable].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            cancelButton.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            cancelButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            title.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 22),
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            title.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
            title.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.formMaxWidth),
            NativeAdaptiveLayout.preferredWidth(title, equalTo: view.widthAnchor, constant: -48),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 5),
            subtitle.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            subtitle.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            queryField.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 24),
            queryField.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            queryField.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            queryField.heightAnchor.constraint(equalToConstant: 54),
            emptyState.topAnchor.constraint(equalTo: queryField.bottomAnchor, constant: 10),
            emptyState.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            emptyState.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            suggestionTable.topAnchor.constraint(equalTo: emptyState.bottomAnchor, constant: 10),
            suggestionTable.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            suggestionTable.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            suggestionTable.heightAnchor.constraint(equalToConstant: 272),
            suggestionTable.bottomAnchor.constraint(lessThanOrEqualTo: view.keyboardLayoutGuide.topAnchor, constant: -20)
        ])

        queryField.becomeFirstResponder()
    }

    @objc private func cancel() { dismiss(animated: true) }

    @objc private func queryChanged() {
        let query = queryField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        completions = []
        suggestionTable.reloadData()
        suggestionTable.isHidden = query.count < 2
        emptyState.setMessage(query.count < 2 ? initialStatusText : "Searching…", style: query.count < 2 ? .empty : .loading)
        if query.count >= 2 {
            let purposeTerm = purpose?.queryTerms.first ?? purpose?.searchToken ?? ""
            completer.queryFragment = purposeTerm.isEmpty ? query : "\(purposeTerm) \(query)"
        }
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(4))
        suggestionTable.isHidden = completions.isEmpty
        emptyState.setMessage(completions.isEmpty ? "No places found yet." : "", style: .empty)
        suggestionTable.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        suggestionTable.isHidden = true
        emptyState.setMessage("Could not load search suggestions.", style: .error)
        UIAccessibility.post(notification: .announcement, argument: emptyState.messageLabel.text)
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { completions.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "map-search-suggestion", for: indexPath)
        let completion = completions[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = completion.title
        content.secondaryText = completion.subtitle
        content.textProperties.font = AlmidyDesignTokens.Font.body(16)
        content.secondaryTextProperties.font = AlmidyDesignTokens.Font.body(13)
        content.textProperties.color = AlmidyDesignTokens.Color.textPrimary
        content.secondaryTextProperties.color = AlmidyDesignTokens.Color.textSecondary
        content.textProperties.numberOfLines = 1
        content.secondaryTextProperties.numberOfLines = 1
        cell.contentConfiguration = content
        cell.backgroundColor = AlmidyDesignTokens.Color.card
        cell.tintColor = AlmidyDesignTokens.Color.gold
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let completion = completions[indexPath.row]
        queryField.resignFirstResponder()
        suggestionTable.isHidden = true
        emptyState.setMessage("Finding \(completion.title)…", style: .loading)

        NativeCoordinatePlace.resolveAddress(completion.subtitle, commonName: completion.title) { [weak self] mapItem in
            guard let self else { return }
            guard let coordinate = mapItem?.placemark.coordinate else {
                self.emptyState.setMessage("Could not resolve that place.", style: .error)
                UIAccessibility.post(notification: .announcement, argument: self.emptyState.messageLabel.text)
                return
            }
            self.onSelect(coordinate)
            self.dismiss(animated: true)
        }
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        guard !completions.isEmpty else { return false }
        tableView(suggestionTable, didSelectRowAt: IndexPath(row: 0, section: 0))
        return true
    }
}
