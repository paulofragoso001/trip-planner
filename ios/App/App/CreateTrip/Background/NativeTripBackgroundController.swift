import UIKit

protocol NativeTripBackgroundTask: AnyObject {
    func resume()
    func cancel()
}

extension URLSessionDataTask: NativeTripBackgroundTask {}

final class NativeTripBackgroundController {
    typealias HeroResolver = (String, @escaping (URL?) -> Void) -> Void
    typealias HeroDownloader = (
        URL,
        @escaping (Data?, URLResponse?, Error?) -> Void
    ) -> NativeTripBackgroundTask

    private let resolver: HeroResolver
    private let downloader: HeroDownloader
    private let genericSelection: NativeTripTravelImageSelection
    private let fallbackImage: UIImage?
    private var debounceWorkItem: DispatchWorkItem?
    private var heroImageTask: NativeTripBackgroundTask?
    private var revision = 0
    private(set) var isManualSelection = false
    private(set) var state: NativeTripBackgroundState

    init(
        resolver: @escaping HeroResolver,
        fallbackImage: UIImage?,
        genericSelection: NativeTripTravelImageSelection? = nil,
        downloader: @escaping HeroDownloader = NativeTripBackgroundController.liveDownloader
    ) {
        self.resolver = resolver
        self.fallbackImage = fallbackImage
        self.genericSelection = genericSelection ?? NativeTripTravelImageSelection(
            identifier: nil,
            image: fallbackImage,
            isUsingGlobeFallback: true
        )
        self.downloader = downloader
        self.state = NativeTripBackgroundState(
            genericImageIdentifier: genericSelection?.identifier,
            isUsingGlobeFallback: genericSelection?.isUsingGlobeFallback ?? true,
            selectionMode: .automaticGeneric
        )
    }

    deinit {
        cancelAll()
    }

    func schedule(
        destination: NativeResolvedDestination?,
        debounce: TimeInterval = 0.55,
        loading: @escaping (Bool) -> Void,
        completion: @escaping (UIImage?) -> Void
    ) {
        guard !isManualSelection else { return }
        cancelAutomaticWork()
        guard let query = destination?.title.trimmingCharacters(in: .whitespacesAndNewlines),
              query.count >= 3 else {
            restoreGenericBackground(completion: completion)
            return
        }
        let requestRevision = revision
        let workItem = DispatchWorkItem { [weak self] in
            guard let self, requestRevision == revision else { return }
            loading(true)
            resolver(query) { [weak self] url in
                DispatchQueue.main.async {
                    guard let self, requestRevision == self.revision else { return }
                    guard let url else {
                        loading(false)
                        self.restoreDestinationFallback(completion: completion)
                        return
                    }
                    self.downloadHero(
                        from: url,
                        revision: requestRevision,
                        loading: loading,
                        completion: completion
                    )
                }
            }
        }
        debounceWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + debounce, execute: workItem)
    }

    func selectManualImage(_ image: UIImage, completion: (UIImage) -> Void) {
        isManualSelection = true
        cancelAutomaticWork()
        state.selectionMode = .manual
        state.isUsingGlobeFallback = false
        completion(image)
    }

    func resumeAutomaticSelection() {
        isManualSelection = false
        state.selectionMode = .automaticGeneric
        state.isUsingGlobeFallback = genericSelection.isUsingGlobeFallback
    }

    func prepareForDestinationLookup(completion: (UIImage?) -> Void) {
        guard !isManualSelection else { return }
        cancelAutomaticWork()
        restoreDestinationFallback(completion: completion)
    }

    func cancelAll() {
        cancelAutomaticWork()
    }

    static func transitionDuration(reduceMotionEnabled: Bool) -> TimeInterval {
        reduceMotionEnabled ? 0 : 0.45
    }

    private func cancelAutomaticWork() {
        revision += 1
        debounceWorkItem?.cancel()
        debounceWorkItem = nil
        heroImageTask?.cancel()
        heroImageTask = nil
    }

    private func downloadHero(
        from url: URL,
        revision requestRevision: Int,
        loading: @escaping (Bool) -> Void,
        completion: @escaping (UIImage?) -> Void
    ) {
        heroImageTask?.cancel()
        heroImageTask = downloader(url) { [weak self] data, response, _ in
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let image = statusCode == 0 || (200...299).contains(statusCode)
                ? data.flatMap(UIImage.init(data:))
                : nil
            DispatchQueue.main.async {
                guard let self, requestRevision == self.revision else { return }
                self.heroImageTask = nil
                loading(false)
                guard let image else {
                    self.restoreDestinationFallback(completion: completion)
                    return
                }
                self.state.selectionMode = .automaticDestination
                self.state.isUsingGlobeFallback = false
                completion(image)
            }
        }
        heroImageTask?.resume()
    }

    private static func liveDownloader(
        url: URL,
        completion: @escaping (Data?, URLResponse?, Error?) -> Void
    ) -> NativeTripBackgroundTask {
        URLSession.shared.dataTask(with: url, completionHandler: completion)
    }

    private func restoreGenericBackground(completion: (UIImage?) -> Void) {
        state.selectionMode = .automaticGeneric
        state.isUsingGlobeFallback = genericSelection.isUsingGlobeFallback
        completion(genericSelection.image ?? fallbackImage)
    }

    private func restoreDestinationFallback(completion: (UIImage?) -> Void) {
        state.selectionMode = .automaticGeneric
        state.isUsingGlobeFallback = true
        completion(fallbackImage)
    }
}
