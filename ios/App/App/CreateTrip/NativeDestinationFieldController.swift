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
            let placemark = item.placemark
            let canonicalTitle = Self.canonicalDestinationTitle(
                fallback: completion.title,
                placemark: placemark
            )
            handler(.success(NativeResolvedDestination(
                title: canonicalTitle,
                coordinate: placemark.coordinate
            )))
        }
    }

    private static func canonicalDestinationTitle(
        fallback: String,
        placemark: MKPlacemark
    ) -> String {
        let locality = placemark.locality?.trimmingCharacters(in: .whitespacesAndNewlines)
        let region = placemark.administrativeArea?.trimmingCharacters(in: .whitespacesAndNewlines)
        let country = placemark.country?.trimmingCharacters(in: .whitespacesAndNewlines)
        let place = [locality, region, placemark.name]
            .compactMap { $0 }
            .first { !$0.isEmpty }
            ?? fallback.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let country, !country.isEmpty,
              place.localizedCaseInsensitiveCompare(country) != .orderedSame else {
            return place
        }
        return "\(place), \(country)"
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
