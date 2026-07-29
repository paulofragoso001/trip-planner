import Foundation

enum NativeCreateTripValidationError: Error, Equatable {
    case missingName
    case missingResolvedLocation

    var accessibilityMessage: String {
        switch self {
        case .missingName:
            return "Enter a trip name before creating this trip."
        case .missingResolvedLocation:
            return "Select a location for this trip name before creating this trip."
        }
    }
}

enum NativeCreateTripValidator {
    static func validate(_ state: NativeCreateTripState) -> Result<NativeResolvedDestination, NativeCreateTripValidationError> {
        guard !state.tripName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .failure(.missingName)
        }
        guard let destination = state.resolvedLocation else {
            return .failure(.missingResolvedLocation)
        }
        return .success(destination)
    }
}
