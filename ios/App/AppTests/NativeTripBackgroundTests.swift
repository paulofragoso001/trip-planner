import CoreLocation
import UIKit
import XCTest
@testable import App

final class NativeTripBackgroundTests: XCTestCase {
    func testCreateTripStartsWithCuratedDefaultImagery() {
        let context = NativeCreateTripBackgroundContext(
            resolver: nil,
            imageBankResolver: nil
        )

        XCTAssertNotNil(context.genericSelection.identifier)
        XCTAssertFalse(context.genericSelection.isUsingGlobeFallback)
    }

    private let destination = NativeResolvedDestination(
        title: "Paris",
        coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
    )

    func testTravelImageBankContainsFourteenApprovedWonderAssets() {
        XCTAssertEqual(NativeTripTravelImageBank.shared.identifiers.count, 14)
        XCTAssertEqual(
            Set(NativeTripTravelImageBank.shared.identifiers),
            Set([
                "WonderGreatWall",
                "WonderPetra",
                "WonderChristRedeemer",
                "WonderMachuPicchu",
                "WonderChichenItza",
                "WonderColosseum",
                "WonderTajMahal",
                "WonderAmazon",
                "WonderHaLongBay",
                "WonderIguazuFalls",
                "WonderJejuIsland",
                "WonderKomodoIsland",
                "WonderPuertoPrincesa",
                "WonderTableMountain"
            ])
        )
        for identifier in NativeTripTravelImageBank.shared.identifiers {
            XCTAssertNotNil(UIImage(named: identifier), "Missing bundled wonder image: \(identifier)")
        }
    }

    func testTravelImageBankSelectsWonderImageAndAvoidsImmediateRepetition() {
        let firstImage = UIImage()
        let secondImage = UIImage()
        let bank = NativeTripTravelImageBank(
            identifiers: ["first", "second"],
            imageLoader: { $0 == "first" ? firstImage : secondImage },
            globeFallback: nil,
            randomIndex: { _ in 0 }
        )

        let first = bank.selectForPresentation()
        let second = bank.selectForPresentation()

        XCTAssertEqual(first.identifier, "first")
        XCTAssertEqual(second.identifier, "second")
        XCTAssertFalse(first.isUsingGlobeFallback)
        XCTAssertFalse(second.isUsingGlobeFallback)
    }

    func testMissingTravelAssetsUseBundledGlobeAsFinalFallback() {
        let globe = UIImage()
        let bank = NativeTripTravelImageBank(
            identifiers: ["missing"],
            imageLoader: { _ in nil },
            globeFallback: globe
        )

        let selection = bank.selectForPresentation()

        XCTAssertNil(selection.identifier)
        XCTAssertTrue(selection.image === globe)
        XCTAssertTrue(selection.isUsingGlobeFallback)
    }

    func testGenericSelectionRemainsStableWhileLocationIsUnresolved() {
        let generic = UIImage()
        let selection = NativeTripTravelImageSelection(
            identifier: "generic",
            image: generic,
            isUsingGlobeFallback: false
        )
        let controller = NativeTripBackgroundController(
            resolver: { _, _ in XCTFail("Unresolved text must not trigger a hero request.") },
            fallbackImage: UIImage(),
            genericSelection: selection
        )
        var completions: [UIImage?] = []

        controller.schedule(destination: nil, debounce: 0, loading: { _ in }) { completions.append($0) }
        controller.schedule(destination: nil, debounce: 0, loading: { _ in }) { completions.append($0) }

        XCTAssertEqual(controller.state.genericImageIdentifier, "generic")
        XCTAssertEqual(controller.state.selectionMode, .automaticGeneric)
        XCTAssertEqual(completions.count, 2)
        XCTAssertTrue(completions.allSatisfy { $0 === generic })
    }

    func testDestinationLoadingRetainsGenericUntilSuccessfulImageArrives() {
        let generic = UIImage()
        let destinationImage = UIGraphicsImageRenderer(size: CGSize(width: 2, height: 2)).image {
            UIColor.systemBlue.setFill()
            $0.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        }
        let selection = NativeTripTravelImageSelection(
            identifier: "generic",
            image: generic,
            isUsingGlobeFallback: false
        )
        var resolverCompletion: ((URL?) -> Void)?
        var completions: [UIImage?] = []
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in resolverCompletion = completion },
            fallbackImage: UIImage(),
            genericSelection: selection,
            downloader: { _, completion in
                TestBackgroundTask(
                    onResume: {
                        completion(
                            destinationImage.pngData(),
                            HTTPURLResponse(
                                url: URL(string: "https://almidy.app/photo")!,
                                statusCode: 200,
                                httpVersion: nil,
                                headerFields: nil
                            ),
                            nil
                        )
                    },
                    onCancel: {}
                )
            }
        )

        controller.schedule(destination: destination, debounce: 0, loading: { _ in }) {
            completions.append($0)
        }
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        XCTAssertTrue(completions.isEmpty)
        XCTAssertEqual(controller.state.selectionMode, .automaticGeneric)

        resolverCompletion?(URL(string: "https://almidy.app/photo"))
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        XCTAssertEqual(completions.count, 1)
        XCTAssertEqual(controller.state.selectionMode, .automaticDestination)
        XCTAssertFalse(controller.state.isUsingGlobeFallback)
    }

    func testDestinationFailureUsesGlobeInsteadOfUnrelatedGenericImage() {
        let generic = UIImage()
        let globe = UIImage()
        let selection = NativeTripTravelImageSelection(
            identifier: "generic",
            image: generic,
            isUsingGlobeFallback: false
        )
        let completed = expectation(description: "neutral fallback restored")
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in completion(nil) },
            fallbackImage: globe,
            genericSelection: selection
        )

        controller.schedule(destination: destination, debounce: 0, loading: { _ in }) { image in
            XCTAssertTrue(image === globe)
            completed.fulfill()
        }
        wait(for: [completed], timeout: 1)
        XCTAssertEqual(controller.state.selectionMode, .automaticGeneric)
        XCTAssertTrue(controller.state.isUsingGlobeFallback)
    }

    func testManualSelectionOverridesGenericAndBlocksAutomaticReplacement() {
        let generic = UIImage()
        let manual = UIImage()
        let selection = NativeTripTravelImageSelection(
            identifier: "generic",
            image: generic,
            isUsingGlobeFallback: false
        )
        var resolverCalls = 0
        let controller = NativeTripBackgroundController(
            resolver: { _, _ in resolverCalls += 1 },
            fallbackImage: UIImage(),
            genericSelection: selection
        )

        controller.selectManualImage(manual) { XCTAssertTrue($0 === manual) }
        controller.schedule(destination: destination, debounce: 0, loading: { _ in }) { _ in
            XCTFail("A manual background must remain authoritative.")
        }
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))

        XCTAssertEqual(resolverCalls, 0)
        XCTAssertTrue(controller.isManualSelection)
        XCTAssertEqual(controller.state.selectionMode, .manual)
    }

    func testGalleryCompletionOrderCannotChangeServerRanking() {
        let first = NativeTripBackgroundOption(title: "First", image: UIImage())
        let second = NativeTripBackgroundOption(title: "Second", image: UIImage())
        let third = NativeTripBackgroundOption(title: "Third", image: UIImage())
        var slots = NativeRankedBackgroundSlots(count: 3)

        slots.insert(third, at: 2)
        slots.insert(first, at: 0)
        slots.insert(second, at: 1)

        XCTAssertEqual(slots.loadedOptionsInServerOrder.map(\.title), ["First", "Second", "Third"])
    }

    func testOnlyResolvedLocationDrivesAutomaticBackgroundLookup() {
        var resolvedQueries: [String] = []
        let controller = NativeTripBackgroundController(
            resolver: { query, completion in
                resolvedQueries.append(query)
                completion(nil)
            },
            fallbackImage: UIImage()
        )

        controller.schedule(
            destination: destination,
            debounce: 0,
            loading: { _ in },
            completion: { _ in }
        )
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        XCTAssertEqual(resolvedQueries, ["Paris"])

        resolvedQueries.removeAll()
        controller.schedule(
            destination: nil,
            debounce: 0,
            loading: { _ in },
            completion: { _ in }
        )
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        XCTAssertTrue(
            resolvedQueries.isEmpty,
            "Unresolved Trip Name text must not be treated as an authoritative location."
        )
    }

    func testDefaultDebounceWaitsApproximately550Milliseconds() {
        let fired = expectation(description: "after debounce")
        let startedAt = Date()
        var elapsed: TimeInterval?
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in
                elapsed = Date().timeIntervalSince(startedAt)
                fired.fulfill()
                completion(nil)
            },
            fallbackImage: nil
        )

        controller.schedule(destination: destination, loading: { _ in }, completion: { _ in })
        RunLoop.main.run(until: Date().addingTimeInterval(0.35))
        XCTAssertNil(elapsed, "The default destination request must not run before its debounce interval.")
        wait(for: [fired], timeout: 0.5)
        XCTAssertGreaterThanOrEqual(elapsed ?? 0, 0.50)
    }

    func testNewDestinationCancelsDebounceAndRejectsStaleResolverCompletion() {
        var resolverCompletions: [String: (URL?) -> Void] = [:]
        var completedImages = 0
        let controller = NativeTripBackgroundController(
            resolver: { query, completion in resolverCompletions[query] = completion },
            fallbackImage: UIImage()
        )
        let tokyo = NativeResolvedDestination(
            title: "Tokyo",
            coordinate: CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503)
        )

        controller.schedule(destination: destination, debounce: 0, loading: { _ in }) { _ in
            completedImages += 1
        }
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        controller.schedule(destination: tokyo, debounce: 0, loading: { _ in }) { _ in
            completedImages += 1
        }
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))

        resolverCompletions["Paris"]?(nil)
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        XCTAssertEqual(completedImages, 0, "A stale resolver revision must not update the background.")

        resolverCompletions["Tokyo"]?(nil)
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        XCTAssertEqual(completedImages, 1)
    }

    func testHTTPAndDecodingFailuresUseFallback() {
        for fixture in [
            DownloadFixture(statusCode: 503, data: Data()),
            DownloadFixture(statusCode: 200, data: Data("not-an-image".utf8))
        ] {
            let fallback = UIImage()
            let completed = expectation(description: "fallback")
            let controller = NativeTripBackgroundController(
                resolver: { _, completion in completion(URL(string: "https://almidy.app/photo")!) },
                fallbackImage: fallback,
                downloader: { url, completion in
                    TestBackgroundTask {
                        completion(
                            fixture.data,
                            HTTPURLResponse(
                                url: url,
                                statusCode: fixture.statusCode,
                                httpVersion: nil,
                                headerFields: nil
                            ),
                            nil
                        )
                    }
                }
            )
            controller.schedule(destination: destination, debounce: 0, loading: { _ in }) { image in
                XCTAssertTrue(image === fallback)
                completed.fulfill()
            }
            wait(for: [completed], timeout: 1)
        }
    }

    func testManualImageAndColorOverrideCancelAutomaticWork() {
        for manualImage in [UIImage(), NativeTripColorBank.options()[0].image] {
            var resolverCompletion: ((URL?) -> Void)?
            var automaticCompletionCount = 0
            let controller = NativeTripBackgroundController(
                resolver: { _, completion in resolverCompletion = completion },
                fallbackImage: UIImage()
            )
            controller.schedule(destination: destination, debounce: 0, loading: { _ in }) { _ in
                automaticCompletionCount += 1
            }
            RunLoop.main.run(until: Date().addingTimeInterval(0.03))

            var selected: UIImage?
            controller.selectManualImage(manualImage) { selected = $0 }
            resolverCompletion?(nil)
            RunLoop.main.run(until: Date().addingTimeInterval(0.03))

            XCTAssertTrue(controller.isManualSelection)
            XCTAssertTrue(selected === manualImage)
            XCTAssertEqual(automaticCompletionCount, 0)
        }
    }

    func testCancellingControllerCancelsActiveImageTask() {
        let cancelled = expectation(description: "download cancelled")
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in completion(URL(string: "https://almidy.app/photo")!) },
            fallbackImage: nil,
            downloader: { _, _ in TestBackgroundTask(onResume: {}, onCancel: { cancelled.fulfill() }) }
        )
        controller.schedule(destination: destination, debounce: 0, loading: { _ in }, completion: { _ in })
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        controller.cancelAll()
        wait(for: [cancelled], timeout: 1)
    }

    func testReducedMotionDisablesCrossfadeDuration() {
        XCTAssertEqual(NativeTripBackgroundController.transitionDuration(reduceMotionEnabled: true), 0)
        XCTAssertEqual(NativeTripBackgroundController.transitionDuration(reduceMotionEnabled: false), 0.45)
    }

    func testImageFailureDoesNotChangeCreateEligibility() throws {
        let state = NativeCreateTripState(
            tripName: "Anniversary",
            resolvedLocation: destination
        )
        let fallbackCompleted = expectation(description: "fallback")
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in completion(nil) },
            fallbackImage: UIImage()
        )
        controller.schedule(destination: destination, debounce: 0, loading: { _ in }) { _ in
            fallbackCompleted.fulfill()
        }
        wait(for: [fallbackCompleted], timeout: 1)

        XCTAssertEqual(try NativeCreateTripValidator.validate(state).get(), destination)
    }
}

private struct DownloadFixture {
    let statusCode: Int
    let data: Data
}

private final class TestBackgroundTask: NativeTripBackgroundTask {
    private let onResume: () -> Void
    private let onCancel: () -> Void

    init(onResume: @escaping () -> Void, onCancel: @escaping () -> Void = {}) {
        self.onResume = onResume
        self.onCancel = onCancel
    }

    func resume() { onResume() }
    func cancel() { onCancel() }
}
