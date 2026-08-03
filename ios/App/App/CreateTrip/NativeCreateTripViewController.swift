import MapKit
import UIKit

final class NativeCreateTripViewController: UIViewController,
    MKLocalSearchCompleterDelegate,
    UITableViewDataSource,
    UITableViewDelegate,
    UITextFieldDelegate
{
    private let onCreate: (NativeTripDraft, @escaping (Result<NativeMapTrip, Error>) -> Void) -> Void
    let existingTrip: NativeMapTrip?
    let backgroundContext: NativeCreateTripBackgroundContext
    let dateContext: NativeCreateTripDateContext
    let layoutContext = NativeCreateTripLayoutContext()

    private let completer = MKLocalSearchCompleter()
    private let destinationController = NativeDestinationFieldController()
    private var completions: [MKLocalSearchCompletion] = []
    var tripState = NativeCreateTripState(tripName: "", resolvedLocation: nil)

    let nameField = UITextField()
    let suggestionTable = UITableView(frame: .zero, style: .plain)
    let createButton = UIButton(type: .system)
    let locationStatus = UILabel()

    init(
        existingTrip: NativeMapTrip? = nil,
        onResolveBackground: ((String, @escaping (URL?) -> Void) -> Void)? = nil,
        onResolveBackgroundBank: ((String, @escaping ([NativeDestinationImageChoice]) -> Void) -> Void)? = nil,
        onCreate: @escaping (NativeTripDraft, @escaping (Result<NativeMapTrip, Error>) -> Void) -> Void
    ) {
        self.onCreate = onCreate
        self.existingTrip = existingTrip
        backgroundContext = NativeCreateTripBackgroundContext(
            resolver: onResolveBackground,
            imageBankResolver: onResolveBackgroundBank
        )
        dateContext = NativeCreateTripDateContext(existingTrip: existingTrip)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        destinationController.cancel()
        cancelBackgroundWork()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.mapSurface
        completer.delegate = self
        configureCoreState()
        configureBackgroundPresentation()
        configureFormLayout()
        if existingTrip == nil {
            DispatchQueue.main.async { [weak self] in
                self?.nameField.becomeFirstResponder()
            }
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateCreateTripLayout()
    }

    private func configureCoreState() {
        nameField.text = existingTrip?.displayName
        tripState = NativeCreateTripState(
            tripName: existingTrip?.displayName ?? "",
            resolvedLocation: nil
        )
        if let existingTrip, let coordinate = existingTrip.coordinate {
            tripState.confirmLocation(NativeResolvedDestination(
                title: existingTrip.destination ?? existingTrip.displayName,
                coordinate: coordinate
            ))
        }
        nameField.addTarget(self, action: #selector(nameChanged), for: .editingChanged)
    }

    func configureNameField() {
        nameField.placeholder = "Trip name"
        nameField.font = AlmidyDesignTokens.Font.display(42)
        nameField.textColor = .white
        nameField.tintColor = AlmidyDesignTokens.Color.gold
        nameField.textAlignment = .center
        nameField.backgroundColor = .clear
        nameField.borderStyle = .none
        nameField.attributedPlaceholder = NSAttributedString(
            string: "Trip name",
            attributes: [.foregroundColor: AlmidyDesignTokens.Color.overlayPlaceholderText]
        )
        nameField.clearButtonMode = .whileEditing
        nameField.returnKeyType = .next
        nameField.delegate = self
        nameField.accessibilityLabel = "Trip name"
        nameField.accessibilityHint = "Enter a place name, then select a location suggestion."
    }

    func setLocationStatus(_ message: String?, announce: Bool = false) {
        locationStatus.text = message
        locationStatus.isHidden = message?.isEmpty ?? true
        if announce, let message {
            UIAccessibility.post(notification: .announcement, argument: message)
        }
    }

    @objc private func nameChanged() {
        tripState.updateTripName(nameField.text ?? "")
        destinationController.cancel()
        cancelBackgroundWork()
        setLocationStatus(nil)
        updateCreateState()
        let query = nameField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        completer.queryFragment = query
        suggestionTable.isHidden = query.count < 2
        if query.count < 2 {
            completions = []
            suggestionTable.reloadData()
        }
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(4))
        suggestionTable.isHidden = completions.isEmpty
        suggestionTable.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        suggestionTable.isHidden = true
        setLocationStatus("Could not load destination suggestions.", announce: true)
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
        nameField.resignFirstResponder()
        suggestionTable.isHidden = true
        setLocationStatus("Finding \(completion.title)…")

        destinationController.resolve(completion: completion) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                guard case .success(let destination) = result else {
                    self.setLocationStatus(
                        "Could not resolve that location. Choose another suggestion.",
                        announce: true
                    )
                    self.updateCreateState()
                    return
                }
                self.nameField.text = destination.title
                self.tripState.updateTripName(destination.title)
                self.tripState.confirmLocation(destination)
                self.setLocationStatus(nil)
                self.updateCreateState()
                self.scheduleDestinationBackgroundUpdate()
            }
        }
    }

    func updateCreateState() {
        tripState.updateTripName(nameField.text ?? "")
        createButton.isEnabled = (try? NativeCreateTripValidator.validate(tripState).get()) != nil
        var configuration = createButton.configuration
        configuration?.baseBackgroundColor = AlmidyDesignTokens.Color.gold
        configuration?.baseForegroundColor = .white
        createButton.configuration = configuration
    }

    @objc func create() {
        tripState.updateTripName(nameField.text ?? "")
        guard case .success(let selectedLocation) = NativeCreateTripValidator.validate(tripState) else {
            let error: NativeCreateTripValidationError =
                tripState.tripName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? .missingName
                : .missingResolvedLocation
            setLocationStatus(error.accessibilityMessage, announce: true)
            return
        }
        createButton.isEnabled = false
        saveTrip(
            name: tripState.tripName.trimmingCharacters(in: .whitespacesAndNewlines),
            selectedLocation: selectedLocation
        )
    }

    private func saveTrip(
        name: String,
        selectedLocation: NativeResolvedDestination
    ) {
        setLocationStatus("Saving trip…")
        let dates = submissionDateValues()
        let draft = NativeTripDraft(
            name: name,
            destination: selectedLocation.title,
            coordinate: selectedLocation.coordinate,
            startDate: dates.startDate,
            endDate: dates.endDate
        )
        onCreate(draft) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success:
                    self.dismiss(animated: true)
                case .failure(let error):
                    self.setLocationStatus(error.localizedDescription, announce: true)
                    self.updateCreateState()
                }
            }
        }
    }

    @objc func cancel() {
        dismiss(animated: true)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}
