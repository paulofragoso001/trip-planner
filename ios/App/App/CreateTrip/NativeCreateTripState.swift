import CoreLocation
import Foundation

struct NativeResolvedDestination: Equatable {
    let title: String
    let coordinate: CLLocationCoordinate2D
    let locality: String?
    let administrativeArea: String?
    let country: String?

    init(
        title: String,
        coordinate: CLLocationCoordinate2D,
        locality: String? = nil,
        administrativeArea: String? = nil,
        country: String? = nil
    ) {
        self.title = title
        self.coordinate = coordinate
        self.locality = locality
        self.administrativeArea = administrativeArea
        self.country = country
    }

    static func == (lhs: NativeResolvedDestination, rhs: NativeResolvedDestination) -> Bool {
        lhs.title == rhs.title
            && lhs.coordinate.latitude == rhs.coordinate.latitude
            && lhs.coordinate.longitude == rhs.coordinate.longitude
            && lhs.locality == rhs.locality
            && lhs.administrativeArea == rhs.administrativeArea
            && lhs.country == rhs.country
    }
}

struct NativeCreateTripState {
    var tripName: String
    var resolvedLocation: NativeResolvedDestination?

    mutating func updateTripName(_ value: String) {
        let previousValue = tripName.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        tripName = value
        guard previousValue != nextValue else {
            return
        }
        resolvedLocation = nil
    }

    mutating func confirmLocation(_ destination: NativeResolvedDestination) {
        resolvedLocation = destination
    }
}
