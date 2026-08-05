import PhotosUI
import CoreImage
import UIKit

final class NativeTripBackgroundImageCache {
    static let shared = NativeTripBackgroundImageCache()
    private let cacheVersion = "destination-only-sharp-hd-v6"

    private let memory = NSCache<NSString, UIImage>()
    private let writeQueue = DispatchQueue(label: "app.almidy.trip-background-cache", qos: .utility)
    private let directory: URL

    private init(fileManager: FileManager = .default) {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? fileManager.temporaryDirectory
        directory = caches.appendingPathComponent("TripBackgrounds", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func image(for trip: NativeMapTrip) -> UIImage? {
        image(forKey: "\(cacheVersion):trip:\(trip.id)")
            ?? trip.destination.flatMap { image(forDestination: $0) }
    }

    func image(forDestination destination: String) -> UIImage? {
        image(forKey: "\(cacheVersion):destination:\(normalized(destination))")
    }

    func store(_ image: UIImage, for trip: NativeMapTrip) {
        store(image, forKey: "\(cacheVersion):trip:\(trip.id)")
        if let destination = trip.destination { store(image, forDestination: destination) }
    }

    func store(_ image: UIImage, forDestination destination: String) {
        store(image, forKey: "\(cacheVersion):destination:\(normalized(destination))")
    }

    private func image(forKey key: String) -> UIImage? {
        let cacheKey = key as NSString
        if let image = memory.object(forKey: cacheKey) { return image }
        guard let image = UIImage(contentsOfFile: fileURL(for: key).path) else { return nil }
        memory.setObject(image, forKey: cacheKey)
        return image
    }

    private func store(_ image: UIImage, forKey key: String) {
        memory.setObject(image, forKey: key as NSString)
        let url = fileURL(for: key)
        writeQueue.async {
            guard let data = image.jpegData(compressionQuality: 0.92) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }

    private func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func fileURL(for key: String) -> URL {
        var hash: UInt64 = 14_695_981_039_346_656_037
        for byte in key.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1_099_511_628_211
        }
        return directory.appendingPathComponent(String(hash, radix: 16)).appendingPathExtension("jpg")
    }
}

final class NativeCreateTripBackgroundContext {
    let resolveImageBank: ((String, @escaping ([NativeDestinationImageChoice]) -> Void) -> Void)?
    let genericSelection: NativeTripTravelImageSelection
    let controller: NativeTripBackgroundController?
    let imageView = UIImageView()
    let imageMask = CAGradientLayer()
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
        let offlineFallback = UIImage(named: "AlmidyOfflineGlobe")
        controller = resolver.map {
            NativeTripBackgroundController(
                resolver: $0,
                fallbackImage: offlineFallback,
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
        context.imageView.backgroundColor = AlmidyDesignTokens.Color.mapSurface
        context.imageView.image = existingTrip.flatMap(NativeTripBackgroundImageCache.shared.image(for:))
            ?? (existingTrip == nil ? context.genericSelection.image : nil)
        if let initialImage = context.imageView.image {
            view.backgroundColor = destinationSurfaceColor(from: initialImage)
        }
        context.imageMask.colors = [
            UIColor.black.cgColor,
            UIColor.black.cgColor,
            UIColor.clear.cgColor
        ]
        context.imageMask.locations = [0, 0.70, 1]
        context.imageView.layer.mask = context.imageMask
        view.addSubview(context.imageView)

        context.gradient.colors = [
            UIColor.black.withAlphaComponent(0.04).cgColor,
            UIColor.black.withAlphaComponent(0.10).cgColor,
            UIColor.black.withAlphaComponent(0.24).cgColor
        ]
        context.gradient.locations = [0, 0.40, 1]
        view.layer.insertSublayer(context.gradient, above: context.imageView.layer)

        NSLayoutConstraint.activate([
            context.imageView.topAnchor.constraint(equalTo: view.topAnchor),
            context.imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            context.imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            context.imageView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.43)
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

        loadExistingTripBackgroundIfNeeded()
    }

    private func loadExistingTripBackgroundIfNeeded() {
        guard let existingTrip else { return }
        if NativeTripBackgroundImageCache.shared.image(for: existingTrip) != nil { return }
        guard let imageUrl = existingTrip.imageUrl,
              let url = URL(string: imageUrl) else {
            scheduleDestinationBackgroundUpdate()
            return
        }
        URLSession.shared.dataTask(with: url) { [weak self] data, response, _ in
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let image = (statusCode == 0 || (200...299).contains(statusCode))
                ? data.flatMap(UIImage.init(data:))
                : nil
            DispatchQueue.main.async {
                guard let self else { return }
                self.backgroundContext.loadingIndicator.stopAnimating()
                if let image {
                    NativeTripBackgroundImageCache.shared.store(image, for: existingTrip)
                    self.transitionToBackgroundImage(image)
                } else {
                    self.scheduleDestinationBackgroundUpdate()
                }
            }
        }.resume()
    }

    func updateBackgroundLayout() {
        backgroundContext.gradient.frame = view.bounds
        backgroundContext.imageMask.frame = backgroundContext.imageView.bounds
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
                self?.cacheSelectedBackground(image)
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
                    self?.cacheSelectedBackground(image)
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
                if !isLoading {
                    self.backgroundContext.loadingIndicator.stopAnimating()
                }
            },
            completion: { [weak self] image in
                guard let self else { return }
                if self.backgroundContext.controller?.state.selectionMode == .automaticDestination,
                   let image {
                    self.cacheSelectedBackground(image)
                    self.transitionToBackgroundImage(image)
                }
            }
        )
    }

    var destinationBackgroundQuery: String {
        tripState.resolvedLocation?.title.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private func cacheSelectedBackground(_ image: UIImage) {
        if let existingTrip {
            NativeTripBackgroundImageCache.shared.store(image, for: existingTrip)
        }
        if let destination = tripState.resolvedLocation?.title {
            NativeTripBackgroundImageCache.shared.store(image, forDestination: destination)
        }
    }

    func transitionToBackgroundImage(_ image: UIImage?) {
        let imageView = backgroundContext.imageView
        guard imageView.image !== image else { return }
        if let image {
            view.backgroundColor = destinationSurfaceColor(from: image)
        }
        UIView.transition(
            with: imageView,
            duration: NativeTripBackgroundController.transitionDuration(
                reduceMotionEnabled: UIAccessibility.isReduceMotionEnabled
            ),
            options: [.transitionCrossDissolve, .allowAnimatedContent, .beginFromCurrentState],
            animations: { imageView.image = image }
        )
    }

    private func destinationSurfaceColor(from image: UIImage) -> UIColor {
        guard let input = CIImage(image: image), !input.extent.isEmpty,
              let filter = CIFilter(name: "CIAreaAverage") else {
            return AlmidyDesignTokens.Color.mapSurface
        }
        filter.setValue(input, forKey: kCIInputImageKey)
        // Sample the lower visual band—the portion that actually fades into
        // the form panel—instead of averaging sky, landmarks, and foreground
        // into an unrelated gray.
        let transitionBand = CGRect(
            x: input.extent.minX,
            y: input.extent.minY,
            width: input.extent.width,
            height: input.extent.height * 0.34
        )
        filter.setValue(CIVector(cgRect: transitionBand), forKey: kCIInputExtentKey)
        guard let output = filter.outputImage else {
            return AlmidyDesignTokens.Color.mapSurface
        }
        var rgba = [UInt8](repeating: 0, count: 4)
        CIContext(options: [.workingColorSpace: NSNull()]).render(
            output,
            toBitmap: &rgba,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )
        let sampledColor = UIColor(
            red: CGFloat(rgba[0]) / 255,
            green: CGFloat(rgba[1]) / 255,
            blue: CGFloat(rgba[2]) / 255,
            alpha: 1
        )
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        guard sampledColor.getHue(
            &hue,
            saturation: &saturation,
            brightness: &brightness,
            alpha: nil
        ) else { return AlmidyDesignTokens.Color.mapSurface }

        // Preserve enough of the image hue to read as a continuation of the
        // photo, while bounding brightness for white-control contrast.
        return UIColor(
            hue: hue,
            saturation: min(max(saturation * 1.30, 0.22), 0.62),
            brightness: min(max(brightness * 0.72, 0.24), 0.46),
            alpha: 1
        )
    }
}
