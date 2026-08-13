import MapKit
import UIKit

final class NativeCreateTripViewController: UIViewController,
    MKLocalSearchCompleterDelegate,
    UITextFieldDelegate
{
    private let onCreate: (NativeTripDraft, @escaping (Result<NativeMapTrip, Error>) -> Void) -> Void
    let existingTrip: NativeMapTrip?
    let backgroundContext: NativeCreateTripBackgroundContext
    let dateContext: NativeCreateTripDateContext
    let layoutContext = NativeCreateTripLayoutContext()

    private let completer = MKLocalSearchCompleter()
    private let destinationController = NativeDestinationFieldController()
    private var destinationLookupWorkItem: DispatchWorkItem?
    private var activeDestinationQuery = ""
    private var resolvingDestinationQuery: String?
    var tripState = NativeCreateTripState(tripName: "", resolvedLocation: nil)

    let nameField = UITextField()
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
        NotificationCenter.default.removeObserver(self)
        destinationLookupWorkItem?.cancel()
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
        observeKeyboardFrameChanges()
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

    private func observeKeyboardFrameChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardFrameWillChange(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardFrameWillChange(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
    }

    @objc private func keyboardFrameWillChange(_ notification: Notification) {
        guard let screenFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }

        let keyboardFrame = view.convert(screenFrame, from: nil)
        let safeAreaBottom = view.bounds.maxY - view.safeAreaInsets.bottom
        let keyboardOverlap = max(0, safeAreaBottom - keyboardFrame.minY)
        layoutContext.fieldsBottomConstraint?.constant = -(20 + keyboardOverlap)

        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveValue = (notification.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber)?.uintValue ?? 7
        let options = UIView.AnimationOptions(rawValue: curveValue << 16)
        UIView.animate(
            withDuration: duration,
            delay: 0,
            options: [options, .beginFromCurrentState, .allowUserInteraction]
        ) {
            self.view.layoutIfNeeded()
        }
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
        let rawDestination = nameField.text ?? ""
        tripState.updateTripName(rawDestination)
        destinationController.cancel()
        cancelBackgroundWork()
        setLocationStatus(nil)
        updateCreateState()
        let query = rawDestination.trimmingCharacters(in: .whitespacesAndNewlines)
        nativeImageryDebug("Destination input raw=\(rawDestination) normalized=\(query)")
        destinationLookupWorkItem?.cancel()
        activeDestinationQuery = query
        resolvingDestinationQuery = nil
        guard query.count >= 2 else { return }

        let workItem = DispatchWorkItem { [weak self] in
            guard let self, self.activeDestinationQuery == query else { return }
            self.completer.queryFragment = query
        }
        destinationLookupWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55, execute: workItem)
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let query = activeDestinationQuery
        guard query.count >= 2,
              resolvingDestinationQuery != query,
              let bestMatch = completer.results.first else { return }
        resolvingDestinationQuery = query
        setLocationStatus("Finding destination…")
        destinationController.resolve(completion: bestMatch) { [weak self] result in
            DispatchQueue.main.async {
                guard let self, self.activeDestinationQuery == query else { return }
                guard case .success(let destination) = result else {
                    nativeImageryDebug("Destination resolution failed query=\(query) category=mapkit_resolution")
                    self.resolvingDestinationQuery = nil
                    self.setLocationStatus("Keep typing to identify a destination.")
                    self.updateCreateState()
                    return
                }
                self.tripState.confirmLocation(destination)
                nativeImageryDebug("Destination confirmed query=\(query) resolved=\(destination.title)")
                self.setLocationStatus(nil)
                self.updateCreateState()
                self.scheduleDestinationBackgroundUpdate()
            }
        }
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        resolvingDestinationQuery = nil
        setLocationStatus("Keep typing to identify a destination.")
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
            endDate: dates.endDate,
            imageURL: backgroundContext.controller?.selectedImageURL
                ?? existingTrip?.imageUrl.flatMap(URL.init(string:))
        )
        onCreate(draft) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success(let trip):
                    if self.backgroundContext.controller?.state.selectionMode != .automaticGeneric,
                       let image = self.backgroundContext.imageView.image {
                        NativeTripBackgroundImageCache.shared.store(image, for: trip)
                    }
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
