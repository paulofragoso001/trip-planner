import CoreLocation
import MapKit
import UIKit

final class NativeCreateTripViewController: UIViewController, MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate, UITextFieldDelegate {
    private let onCreate: (NativeTripDraft, @escaping (Result<NativeMapTrip, Error>) -> Void) -> Void
    private let existingTrip: NativeMapTrip?
    private let completer = MKLocalSearchCompleter()
    private var completions: [MKLocalSearchCompletion] = []
    private var selectedLocation: (title: String, coordinate: CLLocationCoordinate2D)?

    private let nameField = UITextField()
    private let destinationField = UITextField()
    private let suggestionTable = UITableView(frame: .zero, style: .plain)
    private let createButton = UIButton(type: .system)
    private let locationStatus = UILabel()
    private let scrollView = UIScrollView()
    private let contentView = UIView()

    init(
        existingTrip: NativeMapTrip? = nil,
        onCreate: @escaping (NativeTripDraft, @escaping (Result<NativeMapTrip, Error>) -> Void) -> Void
    ) {
        self.onCreate = onCreate
        self.existingTrip = existingTrip
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.surface
        completer.delegate = self
        configureForm()
    }

    private func configureForm() {
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(contentView)

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Cancel", for: .normal)
        closeButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        closeButton.setTitleColor(AlmidyDesignTokens.Color.goldSoft, for: .normal)
        closeButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        closeButton.accessibilityLabel = "Cancel trip editing"

        let title = UILabel()
        title.text = existingTrip == nil ? "Create Trip" : "Edit Trip"
        title.font = AlmidyDesignTokens.Font.display(30)
        title.textColor = AlmidyDesignTokens.Color.textPrimary

        let subtitle = UILabel()
        subtitle.text = "Add one destination to your trip."
        subtitle.font = AlmidyDesignTokens.Font.body(17)
        subtitle.textColor = AlmidyDesignTokens.Color.textSecondary

        configureField(nameField, placeholder: "Trip name")
        configureField(destinationField, placeholder: "Destination")
        nameField.text = existingTrip?.displayName
        destinationField.text = existingTrip?.destination
        if let existingTrip, let coordinate = existingTrip.coordinate {
            selectedLocation = (existingTrip.destination ?? existingTrip.displayName, coordinate)
            locationStatus.text = "Destination selected"
        }
        nameField.addTarget(self, action: #selector(nameChanged), for: .editingChanged)
        destinationField.addTarget(self, action: #selector(destinationChanged), for: .editingChanged)

        locationStatus.font = .systemFont(ofSize: 14, weight: .medium)
        locationStatus.textColor = AlmidyDesignTokens.Color.textSecondary
        locationStatus.numberOfLines = 0
        locationStatus.isAccessibilityElement = true

        suggestionTable.register(UITableViewCell.self, forCellReuseIdentifier: "suggestion")
        suggestionTable.dataSource = self
        suggestionTable.delegate = self
        suggestionTable.isHidden = true
        suggestionTable.backgroundColor = AlmidyDesignTokens.Color.card
        suggestionTable.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        suggestionTable.layer.borderWidth = 1
        suggestionTable.layer.borderColor = AlmidyDesignTokens.Color.line.cgColor
        suggestionTable.rowHeight = 68

        createButton.setTitle(existingTrip == nil ? "Create Trip" : "Save Changes", for: .normal)
        createButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        createButton.setTitleColor(AlmidyDesignTokens.Color.settingsText, for: .normal)
        createButton.setTitleColor(AlmidyDesignTokens.Color.disabledActionText, for: .disabled)
        createButton.backgroundColor = AlmidyDesignTokens.Color.disabledActionBackground
        createButton.layer.cornerRadius = AlmidyDesignTokens.Radius.capsule
        createButton.isEnabled = existingTrip != nil && selectedLocation != nil
        createButton.addTarget(self, action: #selector(create), for: .touchUpInside)
        createButton.accessibilityLabel = existingTrip == nil ? "Create trip" : "Save trip changes"
        updateCreateState()

        let fields = UIStackView(arrangedSubviews: [nameField, destinationField, locationStatus, suggestionTable, createButton])
        fields.axis = .vertical
        fields.spacing = 12
        fields.translatesAutoresizingMaskIntoConstraints = false

        contentView.addSubview(closeButton)
        contentView.addSubview(title)
        contentView.addSubview(subtitle)
        contentView.addSubview(fields)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        title.translatesAutoresizingMaskIntoConstraints = false
        subtitle.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            closeButton.topAnchor.constraint(equalTo: contentView.safeAreaLayoutGuide.topAnchor, constant: 10),
            closeButton.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            closeButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            title.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 22),
            title.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            title.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -24),
            title.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.formMaxWidth),
            NativeAdaptiveLayout.preferredWidth(title, equalTo: contentView.widthAnchor, constant: -48),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 5),
            subtitle.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            subtitle.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            fields.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 24),
            fields.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            fields.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            fields.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20),
            nameField.heightAnchor.constraint(equalToConstant: 54),
            destinationField.heightAnchor.constraint(equalToConstant: 54),
            suggestionTable.heightAnchor.constraint(equalToConstant: 272),
            createButton.heightAnchor.constraint(equalToConstant: 54)
        ])
    }

    private func configureField(_ field: UITextField, placeholder: String) {
        field.placeholder = placeholder
        field.font = AlmidyDesignTokens.Font.body(18)
        field.textColor = AlmidyDesignTokens.Color.textPrimary
        field.backgroundColor = AlmidyDesignTokens.Color.darkInput
        field.borderStyle = .none
        field.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        field.layer.borderWidth = 1
        field.layer.borderColor = AlmidyDesignTokens.Color.darkInputBorder.cgColor
        field.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: AlmidyDesignTokens.Color.darkPlaceholder]
        )
        field.setPadding(16)
        field.clearButtonMode = .whileEditing
        field.returnKeyType = .next
        field.delegate = self
    }

    @objc private func destinationChanged() {
        selectedLocation = nil
        updateCreateState()
        let query = destinationField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        completer.queryFragment = query
        suggestionTable.isHidden = query.count < 2
        if query.count < 2 {
            completions = []
            suggestionTable.reloadData()
        }
    }

    @objc private func nameChanged() {
        updateCreateState()
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(4))
        suggestionTable.isHidden = completions.isEmpty
        suggestionTable.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        suggestionTable.isHidden = true
        locationStatus.text = "Could not load destination suggestions."
        UIAccessibility.post(notification: .announcement, argument: locationStatus.text)
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        completions.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "suggestion", for: indexPath)
        let completion = completions[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = completion.title
        content.secondaryText = completion.subtitle
        content.textProperties.font = AlmidyDesignTokens.Font.body(16)
        content.textProperties.color = AlmidyDesignTokens.Color.textPrimary
        content.secondaryTextProperties.font = AlmidyDesignTokens.Font.body(13)
        content.secondaryTextProperties.color = AlmidyDesignTokens.Color.textSecondary
        content.textProperties.numberOfLines = 1
        content.secondaryTextProperties.numberOfLines = 1
        cell.contentConfiguration = content
        cell.backgroundColor = AlmidyDesignTokens.Color.card
        cell.tintColor = AlmidyDesignTokens.Color.goldSoft
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let completion = completions[indexPath.row]
        destinationField.text = completion.title
        destinationField.resignFirstResponder()
        suggestionTable.isHidden = true
        locationStatus.text = "Finding \(completion.title)…"

        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = [completion.title, completion.subtitle]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        MKLocalSearch(request: request).start { [weak self] response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                guard let item = response?.mapItems.first, error == nil else {
                    self.locationStatus.text = "Could not resolve that destination."
                    UIAccessibility.post(notification: .announcement, argument: self.locationStatus.text)
                    self.selectedLocation = nil
                    self.updateCreateState()
                    return
                }
                self.selectedLocation = (completion.title, item.placemark.coordinate)
                self.locationStatus.text = item.placemark.title ?? "Destination selected"
                self.updateCreateState()
            }
        }
    }

    private func updateCreateState() {
        let hasName = !(nameField.text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        let enabled = hasName && selectedLocation != nil
        createButton.isEnabled = enabled
        createButton.alpha = 1
        createButton.backgroundColor = enabled
            ? AlmidyDesignTokens.Color.gold
            : AlmidyDesignTokens.Color.disabledActionBackground
    }

    @objc private func create() {
        guard let selectedLocation,
              let name = nameField.text?.trimmingCharacters(in: .whitespacesAndNewlines),
              !name.isEmpty else { return }
        createButton.isEnabled = false
        locationStatus.text = "Saving trip…"
        let draft = NativeTripDraft(
            name: name,
            destination: selectedLocation.title,
            coordinate: selectedLocation.coordinate
        )
        onCreate(draft) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success:
                    self.dismiss(animated: true)
                case .failure(let error):
                    self.locationStatus.text = error.localizedDescription
                    UIAccessibility.post(notification: .announcement, argument: self.locationStatus.text)
                    self.updateCreateState()
                }
            }
        }
    }

    @objc private func cancel() {
        dismiss(animated: true)
    }
}
