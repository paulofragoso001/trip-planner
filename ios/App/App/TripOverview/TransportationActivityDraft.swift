import Foundation

/// The editable, persistence-neutral value shared by every transportation form.
/// API request models should be derived from this draft instead of coupling UI
/// controls directly to the `trip_segments` wire contract.
struct TransportationActivityDraft: Codable, Equatable {
    enum Kind: String, Codable, CaseIterable {
        case flight
        case car
        case train
        case carRental = "car_rental"
        case transfer
        case cruise
        case walk
        case bus
        case bike
        case ferry
        case motorcycle

        init?(categoryName: String) {
            switch categoryName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            case "flight", "flights": self = .flight
            case "car": self = .car
            case "train": self = .train
            case "car rental": self = .carRental
            case "transfer": self = .transfer
            case "cruise": self = .cruise
            case "walk": self = .walk
            case "bus": self = .bus
            case "bike": self = .bike
            case "ferry": self = .ferry
            case "motorcycle": self = .motorcycle
            default: return nil
            }
        }
    }

    struct Location: Codable, Equatable {
        var name: String
        var address: String?
        var latitude: Double?
        var longitude: Double?
        var streetAddress: String?
        var addressLocality: String?
        var addressRegion: String?
        var postalCode: String?
        var addressCountry: String?

        init(
            name: String,
            address: String? = nil,
            latitude: Double? = nil,
            longitude: Double? = nil,
            streetAddress: String? = nil,
            addressLocality: String? = nil,
            addressRegion: String? = nil,
            postalCode: String? = nil,
            addressCountry: String? = nil
        ) {
            self.name = name
            self.address = address
            self.latitude = latitude
            self.longitude = longitude
            self.streetAddress = streetAddress
            self.addressLocality = addressLocality
            self.addressRegion = addressRegion
            self.postalCode = postalCode
            self.addressCountry = addressCountry
        }

        var hasCoordinate: Bool { latitude != nil && longitude != nil }
    }

    /// Canonical flight data aligned with Apple's Flight event-suggestion
    /// vocabulary. Dates are absolute instants; the time-zone identifiers
    /// preserve the airport-local values the traveler entered.
    struct FlightDetails: Codable, Equatable {
        struct Airline: Codable, Equatable {
            var name: String
            var iataCode: String
        }

        struct Airport: Codable, Equatable {
            struct PostalAddress: Codable, Equatable {
                var streetAddress: String?
                var addressLocality: String?
                var addressRegion: String?
                var postalCode: String?
                var addressCountry: String?
            }

            var iataCode: String
            var name: String?
            var address: PostalAddress?
            var location: Location
            var timeZoneIdentifier: String
        }

        var provider: Airline
        var flightNumber: String
        var departureAirport: Airport
        var arrivalAirport: Airport
        var departureTime: Date
        var arrivalTime: Date
        var departureTerminal: String?
        var departureGate: String?
        var arrivalTerminal: String?
        var arrivalGate: String?
    }

    struct ReservationDetails: Codable, Equatable {
        var confirmationCode: String?
        var seat: String?
        var seatClass: String?
        var coachNumber: String?
        var vehicle: String?
        var serviceType: String?
        var phone: String?
        var website: URL?

        static let empty = ReservationDetails()
    }

    struct Money: Codable, Equatable {
        var amount: Decimal
        var currency: String

        init(amount: Decimal, currency: String) {
            self.amount = amount
            self.currency = currency.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        }
    }

    struct Attachment: Codable, Equatable, Identifiable {
        enum Kind: String, Codable {
            case file
            case photo
            case link
        }

        var id: UUID
        var kind: Kind
        var displayName: String
        /// A local file URL before upload or the canonical remote URL afterward.
        var sourceURL: URL
        var mimeType: String?

        init(
            id: UUID = UUID(),
            kind: Kind,
            displayName: String,
            sourceURL: URL,
            mimeType: String? = nil
        ) {
            self.id = id
            self.kind = kind
            self.displayName = displayName
            self.sourceURL = sourceURL
            self.mimeType = mimeType
        }
    }

    var tripID: String
    var kind: Kind
    var title: String
    var company: String?
    var transportNumber: String?
    var departure: Location?
    var arrival: Location?
    var startAt: Date?
    var endAt: Date?
    var reservation: ReservationDetails
    var cost: Money?
    var note: String?
    var attachments: [Attachment]
    var flight: FlightDetails?

    init(
        tripID: String,
        kind: Kind,
        title: String = "",
        company: String? = nil,
        transportNumber: String? = nil,
        departure: Location? = nil,
        arrival: Location? = nil,
        startAt: Date? = nil,
        endAt: Date? = nil,
        reservation: ReservationDetails = .empty,
        cost: Money? = nil,
        note: String? = nil,
        attachments: [Attachment] = [],
        flight: FlightDetails? = nil
    ) {
        self.tripID = tripID
        self.kind = kind
        self.title = title
        self.company = company
        self.transportNumber = transportNumber
        self.departure = departure
        self.arrival = arrival
        self.startAt = startAt
        self.endAt = endAt
        self.reservation = reservation
        self.cost = cost
        self.note = note
        self.attachments = attachments
        self.flight = flight
    }
}

protocol NativeTransportationActivitySaving {
    func save(
        _ draft: TransportationActivityDraft,
        completion: @escaping (Result<Void, Error>) -> Void
    )
}

protocol NativeTransportationActivityUpdating {
    func update(
        _ draft: TransportationActivityDraft,
        itemID: String,
        completion: @escaping (Result<Void, Error>) -> Void
    )
}

final class NativeTransportationActivityAPIClient: NativeTransportationActivitySaving, NativeTransportationActivityUpdating {
    private struct Payload: Encodable {
        struct Location: Encodable {
            let name: String
            let address: String?
            let latitude: Double?
            let longitude: Double?
        }

        struct Reservation: Encodable {
            let confirmationCode: String?
            let seat: String?
            let seatClass: String?
            let coachNumber: String?
            let vehicle: String?
            let serviceType: String?
            let phone: String?
            let website: URL?
        }

        struct Cost: Encodable {
            let amount: Decimal
            let currency: String
        }

        struct Attachment: Encodable {
            let kind: String
            let displayName: String
            let url: URL
            let mimeType: String?
        }

        struct Flight: Encodable {
            struct Airline: Encodable {
                let type = "Airline"
                let iataCode: String
                let name: String

                enum CodingKeys: String, CodingKey {
                    case type = "@type"
                    case iataCode, name
                }
            }

            struct Airport: Encodable {
                struct PostalAddress: Encodable {
                    let type = "PostalAddress"
                    let streetAddress: String?
                    let addressLocality: String?
                    let addressRegion: String?
                    let postalCode: String?
                    let addressCountry: String?

                    enum CodingKeys: String, CodingKey {
                        case type = "@type"
                        case streetAddress, addressLocality, addressRegion, postalCode, addressCountry
                    }
                }

                let type = "Airport"
                let iataCode: String
                let name: String?
                let address: PostalAddress?
                let latitude: Double?
                let longitude: Double?
                let timeZoneIdentifier: String

                enum CodingKeys: String, CodingKey {
                    case type = "@type"
                    case iataCode, name, address, latitude, longitude, timeZoneIdentifier
                }
            }

            let type = "Flight"
            let provider: Airline
            let flightNumber: String
            let departureAirport: Airport
            let arrivalAirport: Airport
            let departureTime: String
            let arrivalTime: String
            let departureTerminal: String?
            let departureGate: String?
            let arrivalTerminal: String?
            let arrivalGate: String?

            enum CodingKeys: String, CodingKey {
                case type = "@type"
                case provider, flightNumber, departureAirport, arrivalAirport
                case departureTime, arrivalTime, departureTerminal, departureGate
                case arrivalTerminal, arrivalGate
            }
        }

        let tripID: String
        let kind: String
        let title: String
        let company: String?
        let transportNumber: String?
        let departure: Location?
        let arrival: Location?
        let startAt: String?
        let endAt: String?
        let reservation: Reservation
        let cost: Cost?
        let note: String?
        let attachments: [Attachment]
        let flight: Flight?

        init(draft: TransportationActivityDraft) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            tripID = draft.tripID
            kind = draft.kind.rawValue
            title = draft.title
            company = draft.company
            transportNumber = draft.transportNumber
            departure = draft.departure.map {
                Location(name: $0.name, address: $0.address, latitude: $0.latitude, longitude: $0.longitude)
            }
            arrival = draft.arrival.map {
                Location(name: $0.name, address: $0.address, latitude: $0.latitude, longitude: $0.longitude)
            }
            startAt = draft.startAt.map(formatter.string(from:))
            endAt = draft.endAt.map(formatter.string(from:))
            reservation = Reservation(
                confirmationCode: draft.reservation.confirmationCode,
                seat: draft.reservation.seat,
                seatClass: draft.reservation.seatClass,
                coachNumber: draft.reservation.coachNumber,
                vehicle: draft.reservation.vehicle,
                serviceType: draft.reservation.serviceType,
                phone: draft.reservation.phone,
                website: draft.reservation.website
            )
            cost = draft.cost.map { Cost(amount: $0.amount, currency: $0.currency) }
            note = draft.note
            // Binary files/photos must be uploaded through the Storage API first.
            // This first Flight slice submits canonical external link records.
            attachments = draft.attachments.compactMap { attachment in
                guard attachment.kind == .link,
                      ["http", "https"].contains(attachment.sourceURL.scheme?.lowercased()) else { return nil }
                return Attachment(
                    kind: attachment.kind.rawValue,
                    displayName: attachment.displayName,
                    url: attachment.sourceURL,
                    mimeType: attachment.mimeType
                )
            }
            flight = draft.flight.map { details in
                func airport(_ value: TransportationActivityDraft.FlightDetails.Airport) -> Flight.Airport {
                    Flight.Airport(
                        iataCode: value.iataCode,
                        name: value.name,
                        address: value.address.map {
                            Flight.Airport.PostalAddress(
                                streetAddress: $0.streetAddress,
                                addressLocality: $0.addressLocality,
                                addressRegion: $0.addressRegion,
                                postalCode: $0.postalCode,
                                addressCountry: $0.addressCountry
                            )
                        },
                        latitude: value.location.latitude,
                        longitude: value.location.longitude,
                        timeZoneIdentifier: value.timeZoneIdentifier
                    )
                }
                return Flight(
                    provider: Flight.Airline(
                        iataCode: details.provider.iataCode,
                        name: details.provider.name
                    ),
                    flightNumber: details.flightNumber,
                    departureAirport: airport(details.departureAirport),
                    arrivalAirport: airport(details.arrivalAirport),
                    departureTime: formatter.string(from: details.departureTime),
                    arrivalTime: formatter.string(from: details.arrivalTime),
                    departureTerminal: details.departureTerminal,
                    departureGate: details.departureGate,
                    arrivalTerminal: details.arrivalTerminal,
                    arrivalGate: details.arrivalGate
                )
            }
        }
    }

    private let client: NativeAuthenticatedHTTPClient
    private let encoder: JSONEncoder

    init(
        webView: AnyObject? = nil,
        baseURL: URL = NativeServiceConfiguration.appBaseURL,
        session: URLSession = .shared
    ) {
        client = NativeAuthenticatedHTTPClient(webView: webView, baseURL: baseURL, session: session)
        encoder = JSONEncoder()
    }

    func save(
        _ draft: TransportationActivityDraft,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        let body: Data
        do {
            body = try encoder.encode(Payload(draft: draft))
        } catch {
            completion(.failure(error))
            return
        }
        client.request(path: "/api/itinerary", method: "POST", body: body) { result in
            completion(result.map { _ in () })
        }
    }

    func update(
        _ draft: TransportationActivityDraft,
        itemID: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        let body: Data
        do { body = try encoder.encode(Payload(draft: draft)) }
        catch { completion(.failure(error)); return }
        let encodedID = itemID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? itemID
        client.request(path: "/api/trip-segments/\(encodedID)", method: "PATCH", body: body) { result in
            completion(result.map { _ in () })
        }
    }
}
