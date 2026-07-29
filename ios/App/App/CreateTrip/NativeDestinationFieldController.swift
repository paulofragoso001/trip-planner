import MapKit

final class NativeDestinationFieldController {
    private var activeSearch: MKLocalSearch?
    private var revision = 0

    deinit {
        cancel()
    }

    func resolve(
        completion: MKLocalSearchCompletion,
        handler: @escaping (Result<NativeResolvedDestination, Error>) -> Void
    ) {
        cancel()
        revision += 1
        let requestRevision = revision
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = [completion.title, completion.subtitle]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        let search = MKLocalSearch(request: request)
        activeSearch = search
        search.start { [weak self] response, error in
            guard let self, requestRevision == revision else { return }
            activeSearch = nil
            if let error {
                handler(.failure(error))
                return
            }
            guard let item = response?.mapItems.first else {
                handler(.failure(NativeDestinationResolutionError.noResult))
                return
            }
            handler(.success(NativeResolvedDestination(
                title: completion.title,
                coordinate: item.placemark.coordinate
            )))
        }
    }

    func cancel() {
        revision += 1
        activeSearch?.cancel()
        activeSearch = nil
    }
}

enum NativeDestinationResolutionError: Error {
    case noResult
}
