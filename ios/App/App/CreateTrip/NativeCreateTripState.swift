import CoreLocation
import Foundation

struct NativeResolvedDestination: Equatable {
    let title: String
    let coordinate: CLLocationCoordinate2D

    static func == (lhs: NativeResolvedDestination, rhs: NativeResolvedDestination) -> Bool {
        lhs.title == rhs.title
            && lhs.coordinate.latitude == rhs.coordinate.latitude
            && lhs.coordinate.longitude == rhs.coordinate.longitude
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
