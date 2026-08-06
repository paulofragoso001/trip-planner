import Capacitor
import Foundation
import MapKit
import XCTest
@testable import App

@MainActor
final class NativeTravelImageConnectivityTests: XCTestCase {
    func testExactReleaseDestinationsReturnUsableAutomaticImageURLs() {
        let destinations = ["Tokyo", "Rio de Janeiro", "Brazil", "Italy", "Rome", "Paris", "Miami"]
        NativeTripStoreURLProtocol.handler = { request in
            let payload = try! XCTUnwrap(nativeRequestBodyData(request))
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
            let destination = try! XCTUnwrap(json["name"] as? String)
            let reference = destination
                .lowercased()
                .replacingOccurrences(of: " ", with: "-") + "-photo-reference"
            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
            return (response, """
            {"data":{"resolved":{"inventoryItem":{"imageUrl":"/api/travel-data/place-photo?photoReference=\(reference)&maxWidth=800"}}},"error":null}
            """.data(using: .utf8)!)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let store = nativeTripStore()
        let completions = destinations.map { destination in
            expectation(description: destination)
        }
        for (index, destination) in destinations.enumerated() {
            store.resolveDestinationHeroImage(query: destination) { imageURL in
                XCTAssertEqual(imageURL?.path, "/api/travel-data/place-photo")
                completions[index].fulfill()
            }
        }
        wait(for: completions, timeout: 3)
    }

    func testNativeTripStoreResolvesDestinationHeroThroughExistingPlacePhotoRoute() {
        NativeTripStoreURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/api/travel-data/resolve-place")
            let payload = try! XCTUnwrap(nativeRequestBodyData(request))
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
            XCTAssertEqual(json["name"] as? String, "Brazil")

            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
            let body = """
            {"data":{"resolved":{"inventoryItem":{"imageUrl":"/api/travel-data/place-photo?photoReference=brazil-photo-reference&maxWidth=800"}}},"error":null}
            """.data(using: .utf8)!
            return (response, body)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let expectation = expectation(description: "destination hero resolution")
        let store = nativeTripStore()
        store.resolveDestinationHeroImage(query: "Brazil") { imageURL in
            guard let imageURL else {
                XCTFail("Expected a destination-aware Place Photo URL")
                expectation.fulfill()
                return
            }
            XCTAssertEqual(imageURL.host, "almidy.app")
            XCTAssertEqual(imageURL.path, "/api/travel-data/place-photo")
            XCTAssertEqual(
                URLComponents(url: imageURL, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "photoReference" })?.value,
                "brazil-photo-reference"
            )
            XCTAssertEqual(
                URLComponents(url: imageURL, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "maxWidth" })?.value,
                "3200"
            )
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

    func testNativeTripStoreRetriesBroadDestinationAsAnIconicLandmark() {
        var requestedNames: [String] = []
        NativeTripStoreURLProtocol.handler = { request in
            let payload = try! XCTUnwrap(nativeRequestBodyData(request))
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
            requestedNames.append(json["name"] as? String ?? "")
            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
            let body: Data
            if requestedNames.count == 1 {
                body = """
                {"data":{"resolved":{"inventoryItem":{"imageUrl":null}}},"error":null}
                """.data(using: .utf8)!
            } else {
                body = """
                {"data":{"resolved":{"inventoryItem":{"imageUrl":"/api/travel-data/place-photo?photoReference=iconic-brazil-landmark&maxWidth=800"}}},"error":null}
                """.data(using: .utf8)!
            }
            return (response, body)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let expectation = expectation(description: "iconic destination hero retry")
        let store = nativeTripStore()
        store.resolveDestinationHeroImage(query: "Brazil") { imageURL in
            XCTAssertEqual(requestedNames, ["Brazil", "Brazil most visited iconic landmark"])
            guard let imageURL else {
                XCTFail("Expected the iconic landmark retry to return a photo URL")
                expectation.fulfill()
                return
            }
            XCTAssertEqual(
                URLComponents(url: imageURL, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "photoReference" })?.value,
                "iconic-brazil-landmark"
            )
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

    func testNativeTripStoreBuildsDestinationImageBankFromNearbySuggestions() {
        var requestedPaths: [String] = []
        NativeTripStoreURLProtocol.handler = { request in
            let path = request.url?.path ?? ""
            requestedPaths.append(path)
            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
            if path == "/api/travel-data/resolve-place" {
                let payload = try! XCTUnwrap(nativeRequestBodyData(request))
                let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
                XCTAssertEqual(json["name"] as? String, "Brazil")
                return (response, """
                {"data":{"resolved":{"inventoryItem":null,"latitude":-22.9519,"longitude":-43.2105}},"error":null}
                """.data(using: .utf8)!)
            }

            XCTAssertEqual(path, "/api/travel-data/suggestions")
            let payload = try! XCTUnwrap(nativeRequestBodyData(request))
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
            XCTAssertEqual(json["limit"] as? Int, 10)
            XCTAssertEqual(json["purpose"] as? String, "postcard_gallery")
            XCTAssertEqual(json["radiusMeters"] as? Int, 25_000)
            return (response, """
            {"data":{"suggestions":[
              {"title":"Christ the Redeemer","imageUrl":"/api/travel-data/place-photo?photoReference=christ-photo&maxWidth=800"},
              {"title":"Sugarloaf Mountain","imageUrl":"/api/travel-data/place-photo?photoReference=sugarloaf-photo&maxWidth=800"}
            ]},"error":null}
            """.data(using: .utf8)!)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let expectation = expectation(description: "destination image bank")
        let store = nativeTripStore()
        store.resolveDestinationImageBank(query: "Brazil") { choices in
            XCTAssertEqual(requestedPaths, ["/api/travel-data/resolve-place", "/api/travel-data/suggestions"])
            XCTAssertEqual(choices.map(\.title), ["Christ the Redeemer", "Sugarloaf Mountain"])
            XCTAssertEqual(choices.first?.url.host, "almidy.app")
            XCTAssertEqual(
                choices.first.flatMap { URLComponents(url: $0.url, resolvingAgainstBaseURL: false) }?
                    .queryItems?.first(where: { $0.name == "maxWidth" })?.value,
                "2400"
            )
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

}
