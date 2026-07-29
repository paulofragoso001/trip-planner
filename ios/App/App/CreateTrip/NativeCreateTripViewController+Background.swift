import PhotosUI
import UIKit

final class NativeCreateTripBackgroundContext {
    let resolveImageBank: ((String, @escaping ([NativeDestinationImageChoice]) -> Void) -> Void)?
    let genericSelection: NativeTripTravelImageSelection
    let controller: NativeTripBackgroundController?
    let imageView = UIImageView()
    let fallbackImage = UIImage(named: "AlmidyOfflineGlobe")
    let gradient = CAGradientLayer()
    let loadingIndicator = UIActivityIndicatorView(style: .large)

    init(
        resolver: ((String, @escaping (URL?) -> Void) -> Void)?,
        imageBankResolver: ((String, @escaping ([NativeDestinationImageChoice]) -> Void) -> Void)?
    ) {
        let selection = NativeTripTravelImageBank.shared.selectForPresentation()
        genericSelection = selection
        resolveImageBank = imageBankResolver
        controller = resolver.map {
            NativeTripBackgroundController(
                resolver: $0,
                fallbackImage: UIImage(named: "AlmidyOfflineGlobe"),
                genericSelection: selection
            )
        }
    }
}

extension NativeCreateTripViewController: PHPickerViewControllerDelegate {
    func configureBackgroundPresentation() {
        let context = backgroundContext
        context.imageView.translatesAutoresizingMaskIntoConstraints = false
        context.imageView.contentMode = .scaleAspectFill
        context.imageView.clipsToBounds = true
        context.imageView.image = context.genericSelection.image ?? context.fallbackImage
        view.addSubview(context.imageView)

        context.gradient.colors = [
            UIColor.black.withAlphaComponent(0.08).cgColor,
            UIColor.black.withAlphaComponent(0.22).cgColor,
            UIColor.black.withAlphaComponent(0.76).cgColor
        ]
        context.gradient.locations = [0, 0.48, 1]
        view.layer.insertSublayer(context.gradient, above: context.imageView.layer)

        NSLayoutConstraint.activate([
            context.imageView.topAnchor.constraint(equalTo: view.topAnchor),
            context.imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            context.imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            context.imageView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        context.loadingIndicator.color = UIColor.white.withAlphaComponent(0.72)
        context.loadingIndicator.hidesWhenStopped = true
        context.loadingIndicator.isAccessibilityElement = true
        context.loadingIndicator.accessibilityLabel = "Loading destination background"
        context.loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(context.loadingIndicator)
        NSLayoutConstraint.activate([
            context.loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            context.loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -92)
        ])

        if let imageUrl = existingTrip?.imageUrl, let url = URL(string: imageUrl) {
            URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                DispatchQueue.main.async { self?.transitionToBackgroundImage(image) }
            }.resume()
        }
    }

    func updateBackgroundLayout() {
        backgroundContext.gradient.frame = view.bounds
    }

    func cancelBackgroundWork() {
        backgroundContext.controller?.cancelAll()
        backgroundContext.loadingIndicator.stopAnimating()
    }

    @objc func selectBackground() {
        guard let resolveImageBank = backgroundContext.resolveImageBank else { return }
        nameField.resignFirstResponder()
        let picker = NativeTripBackgroundPickerViewController(
            query: destinationBackgroundQuery,
            resolveImageBank: resolveImageBank
        ) { [weak self] image in
            guard let self else { return }
            self.cancelBackgroundWork()
            self.backgroundContext.controller?.selectManualImage(image) { [weak self] image in
                self?.transitionToBackgroundImage(image)
            }
            self.setLocationStatus(nil)
            UIAccessibility.post(notification: .announcement, argument: "Trip background selected")
        }
        picker.modalPresentationStyle = .pageSheet
        if let sheet = picker.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.selectedDetentIdentifier = .large
            sheet.prefersGrabberVisible = false
            sheet.preferredCornerRadius = 32
        }
        present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider,
              provider.canLoadObject(ofClass: UIImage.self) else { return }
        provider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
            guard let image = object as? UIImage else { return }
            DispatchQueue.main.async {
                guard let self else { return }
                self.cancelBackgroundWork()
                self.backgroundContext.controller?.selectManualImage(image) { [weak self] image in
                    self?.transitionToBackgroundImage(image)
                }
                self.setLocationStatus(nil)
                UIAccessibility.post(notification: .announcement, argument: "Trip background selected")
            }
        }
    }

    func scheduleDestinationBackgroundUpdate() {
        backgroundContext.controller?.schedule(
            destination: tripState.resolvedLocation,
            loading: { [weak self] isLoading in
                guard let self else { return }
                isLoading
                    ? self.backgroundContext.loadingIndicator.startAnimating()
                    : self.backgroundContext.loadingIndicator.stopAnimating()
            },
            completion: { [weak self] image in
                guard let self else { return }
                if image != nil || self.existingTrip == nil {
                    self.transitionToBackgroundImage(image)
                }
            }
        )
    }

    var destinationBackgroundQuery: String {
        tripState.resolvedLocation?.title.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    func transitionToBackgroundImage(_ image: UIImage?) {
        let imageView = backgroundContext.imageView
        guard imageView.image !== image else { return }
        UIView.transition(
            with: imageView,
            duration: NativeTripBackgroundController.transitionDuration(
                reduceMotionEnabled: UIAccessibility.isReduceMotionEnabled
            ),
            options: [.transitionCrossDissolve, .allowAnimatedContent, .beginFromCurrentState],
            animations: { imageView.image = image }
        )
    }
}
