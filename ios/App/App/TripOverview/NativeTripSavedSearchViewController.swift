import UIKit

struct NativeTripSavedSearchItem: Equatable {
    enum Kind: Equatable { case activity, document }

    let id: String
    let title: String
    let detail: String
    let url: URL
    let kind: Kind
}

enum NativeTripSavedSearchProjection {
    static func items(from overview: NativeTripOverview) -> [NativeTripSavedSearchItem] {
        var seen = Set<String>()
        let activities = overview.recentItems.items.compactMap { item -> NativeTripSavedSearchItem? in
            guard seen.insert(item.url.absoluteString).inserted else { return nil }
            return .init(id: item.id, title: item.title, detail: item.category, url: item.url, kind: .activity)
        }
        let documents = overview.documents.items.compactMap { item -> NativeTripSavedSearchItem? in
            guard seen.insert(item.url.absoluteString).inserted else { return nil }
            return .init(id: item.id, title: item.title, detail: item.type, url: item.url, kind: .document)
        }
        return activities + documents
    }

    static func filtered(_ items: [NativeTripSavedSearchItem], query: String) -> [NativeTripSavedSearchItem] {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return items }
        return items.filter {
            $0.title.localizedCaseInsensitiveContains(value)
                || $0.detail.localizedCaseInsensitiveContains(value)
        }
    }
}

final class NativeTripSavedSearchViewController: UIViewController,
                                                       UISearchTextFieldDelegate,
                                                       UITableViewDataSource,
                                                       UITableViewDelegate {
    private enum Typography {
        static let search = scaledFont(size: 17, weight: .regular, textStyle: .body)
        static let cancel = scaledFont(size: 17, weight: .regular, textStyle: .body)
        static let emptyTitle = scaledFont(size: 23, weight: .bold, textStyle: .title2)
        static let emptyBody = scaledFont(size: 17, weight: .regular, textStyle: .body)
        static let emptyAction = scaledFont(size: 17, weight: .semibold, textStyle: .headline)

        private static func scaledFont(
            size: CGFloat,
            weight: UIFont.Weight,
            textStyle: UIFont.TextStyle
        ) -> UIFont {
            UIFontMetrics(forTextStyle: textStyle).scaledFont(
                for: .systemFont(ofSize: size, weight: weight)
            )
        }
    }

    private let tripID: String
    private let allItems: [NativeTripSavedSearchItem]
    private let onOpenItem: (URL) -> Void
    private let onAddActivity: () -> Void

    private let searchField = UISearchTextField()
    private let cancelButton = UIButton(type: .system)
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let emptyState = UIStackView()
    private let iconCluster = NativeTripSavedSearchIconCluster()
    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let addButton = UIButton(type: .system)
    private var visibleItems: [NativeTripSavedSearchItem] = []

    init(
        tripID: String,
        overview: NativeTripOverview,
        onOpenItem: @escaping (URL) -> Void,
        onAddActivity: @escaping () -> Void
    ) {
        self.tripID = tripID
        allItems = NativeTripSavedSearchProjection.items(from: overview)
        self.onOpenItem = onOpenItem
        self.onAddActivity = onAddActivity
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        applyFilter()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if searchField.isEnabled {
            searchField.becomeFirstResponder()
            UIAccessibility.post(notification: .screenChanged, argument: searchField)
        } else {
            UIAccessibility.post(notification: .screenChanged, argument: titleLabel)
        }
    }

    private func configureView() {
        view.backgroundColor = AlmidyDesignTokens.Color.surface
        view.accessibilityIdentifier = "trip-saved-search-\(tripID)"

        searchField.placeholder = "Search saved activities and documents"
        searchField.font = Typography.search
        searchField.adjustsFontForContentSizeCategory = true
        searchField.returnKeyType = .search
        searchField.clearButtonMode = .whileEditing
        searchField.delegate = self
        searchField.backgroundColor = AlmidyDesignTokens.Color.inputSurface
        searchField.layer.cornerRadius = 22
        searchField.layer.cornerCurve = .continuous
        searchField.accessibilityIdentifier = "trip-saved-search-field"
        searchField.isEnabled = !allItems.isEmpty
        searchField.accessibilityHint = allItems.isEmpty
            ? "Search becomes available after an activity or document is saved to this trip"
            : "Searches activities and documents saved to this trip"
        searchField.addTarget(self, action: #selector(searchChanged), for: .editingChanged)

        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = Typography.cancel
        cancelButton.titleLabel?.adjustsFontForContentSizeCategory = true
        cancelButton.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        cancelButton.accessibilityHint = "Closes saved activity and document search"
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        cancelButton.setContentCompressionResistancePriority(.required, for: .horizontal)

        tableView.backgroundColor = .clear
        tableView.separatorInset = UIEdgeInsets(top: 0, left: 68, bottom: 0, right: 24)
        tableView.keyboardDismissMode = .onDrag
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "SavedItem")
        tableView.accessibilityIdentifier = "trip-saved-search-results"

        emptyState.axis = .vertical
        emptyState.alignment = .center
        emptyState.spacing = 14
        emptyState.accessibilityIdentifier = "trip-saved-search-empty-state"

        titleLabel.text = "No activities or documents saved"
        titleLabel.font = Typography.emptyTitle
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.textColor = AlmidyDesignTokens.Color.textPrimary
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 2

        bodyLabel.text = "Save any kind of activity, such as flights, accommodations, locations, routes, and documents, and they will all appear here."
        bodyLabel.font = Typography.emptyBody
        bodyLabel.adjustsFontForContentSizeCategory = true
        bodyLabel.textColor = AlmidyDesignTokens.Color.searchEmptyState
        bodyLabel.textAlignment = .center
        bodyLabel.numberOfLines = 0

        addButton.setTitle("Add Activity", for: .normal)
        addButton.titleLabel?.font = Typography.emptyAction
        addButton.titleLabel?.adjustsFontForContentSizeCategory = true
        addButton.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        addButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        addButton.accessibilityHint = "Adds an activity to this trip"
        addButton.addTarget(self, action: #selector(addActivity), for: .touchUpInside)

        [iconCluster, titleLabel, bodyLabel, addButton].forEach(emptyState.addArrangedSubview)
        view.addSubview(searchField)
        view.addSubview(cancelButton)
        view.addSubview(tableView)
        view.addSubview(emptyState)
        [searchField, cancelButton, tableView, emptyState].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }

        NSLayoutConstraint.activate([
            searchField.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            searchField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            searchField.heightAnchor.constraint(equalToConstant: 48),
            cancelButton.leadingAnchor.constraint(equalTo: searchField.trailingAnchor, constant: 14),
            cancelButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            cancelButton.centerYAnchor.constraint(equalTo: searchField.centerYAnchor),
            cancelButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),

            tableView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 12),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            emptyState.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyState.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 28),
            emptyState.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 38),
            emptyState.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -38),
            iconCluster.widthAnchor.constraint(equalToConstant: 172),
            iconCluster.heightAnchor.constraint(equalToConstant: 54),
            titleLabel.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -72),
            bodyLabel.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -76)
        ])
    }

    @objc private func searchChanged() { applyFilter() }

    private func applyFilter() {
        visibleItems = NativeTripSavedSearchProjection.filtered(allItems, query: searchField.text ?? "")
        let showsEmptyState = visibleItems.isEmpty
        emptyState.isHidden = !showsEmptyState
        tableView.isHidden = showsEmptyState
        titleLabel.text = allItems.isEmpty
            ? "No activities or documents saved"
            : "No matching activities or documents"
        bodyLabel.text = allItems.isEmpty
            ? "Save any kind of activity, such as flights, accommodations, locations, routes, and documents, and they will all appear here."
            : "Try another search, or add a new activity to this trip."
        tableView.reloadData()
    }

    @objc private func cancel() { dismiss(animated: true) }

    @objc private func addActivity() {
        dismiss(animated: true, completion: onAddActivity)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { visibleItems.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let item = visibleItems[indexPath.row]
        let cell = tableView.dequeueReusableCell(withIdentifier: "SavedItem", for: indexPath)
        var content = cell.defaultContentConfiguration()
        content.text = item.title
        content.secondaryText = item.detail
        content.image = UIImage(systemName: item.kind == .document ? "doc.text.fill" : "calendar.badge.clock")
        content.imageProperties.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        content.textProperties.font = .preferredFont(forTextStyle: .headline)
        content.secondaryTextProperties.color = AlmidyDesignTokens.Color.textSecondary
        cell.contentConfiguration = content
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let item = visibleItems[indexPath.row]
        tableView.deselectRow(at: indexPath, animated: true)
        dismiss(animated: true) { [onOpenItem] in onOpenItem(item.url) }
    }
}

private final class NativeTripSavedSearchIconCluster: UIView {
    private struct Icon {
        let symbol: String
        let color: UIColor
        let surface: UIColor
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isAccessibilityElement = false
        accessibilityElementsHidden = true
        let icons = [
            Self.icon(symbol: "airplane", color: AlmidyDesignTokens.Color.info),
            Self.icon(symbol: "bed.double.fill", color: AlmidyDesignTokens.Color.generatedTripGradientStart),
            Self.icon(symbol: "fork.knife", color: AlmidyDesignTokens.Color.goldDeep),
            Self.icon(symbol: "folder.fill", color: AlmidyDesignTokens.Color.tripOverviewNeutralIcon)
        ]
        var previous: UIView?
        for icon in icons {
            let circle = UIView()
            circle.backgroundColor = icon.surface
            circle.layer.cornerRadius = 27
            let image = UIImageView(image: UIImage(systemName: icon.symbol))
            image.tintColor = icon.color
            image.contentMode = UIView.ContentMode.scaleAspectFit
            circle.addSubview(image)
            addSubview(circle)
            circle.translatesAutoresizingMaskIntoConstraints = false
            image.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                circle.widthAnchor.constraint(equalToConstant: 54),
                circle.heightAnchor.constraint(equalToConstant: 54),
                circle.centerYAnchor.constraint(equalTo: centerYAnchor),
                image.centerXAnchor.constraint(equalTo: circle.centerXAnchor),
                image.centerYAnchor.constraint(equalTo: circle.centerYAnchor),
                image.widthAnchor.constraint(equalToConstant: 28),
                image.heightAnchor.constraint(equalToConstant: 28)
            ])
            if let previous {
                circle.leadingAnchor.constraint(equalTo: previous.trailingAnchor, constant: -14).isActive = true
            } else {
                circle.leadingAnchor.constraint(equalTo: leadingAnchor).isActive = true
            }
            previous = circle
        }
        previous?.trailingAnchor.constraint(equalTo: trailingAnchor).isActive = true
    }

    private static func icon(symbol: String, color: UIColor) -> Icon {
        Icon(symbol: symbol, color: color, surface: color.withAlphaComponent(0.12))
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
