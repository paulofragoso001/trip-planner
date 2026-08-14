import XCTest
import UIKit
@testable import App

final class NativeTripDateTests: XCTestCase {
    func testBothDatesAbsentIsValidOptionalState() {
        XCTAssertNil(NativeTripDateRange(startDate: nil, endDate: nil))
    }

    func testHalfRangeCannotPersist() {
        let date = NativeTripDateFormatting.date(fromAPI: "2026-07-25")
        XCTAssertNil(NativeTripDateRange(startDate: date, endDate: nil))
        XCTAssertNil(NativeTripDateRange(startDate: nil, endDate: date))
    }

    func testSameDayTripIsValid() throws {
        let date = try XCTUnwrap(NativeTripDateFormatting.date(fromAPI: "2026-07-25"))
        let range = try XCTUnwrap(NativeTripDateRange(startDate: date, endDate: date))
        XCTAssertEqual(range.inclusiveDayCount, 1)
        XCTAssertEqual(range.apiStartDate, "2026-07-25")
        XCTAssertEqual(range.apiEndDate, "2026-07-25")
    }

    func testPastAndMultiDayTripsRemainValid() throws {
        let start = try XCTUnwrap(NativeTripDateFormatting.date(fromAPI: "2020-01-01"))
        let end = try XCTUnwrap(NativeTripDateFormatting.date(fromAPI: "2020-01-03"))
        let range = try XCTUnwrap(NativeTripDateRange(startDate: start, endDate: end))
        XCTAssertEqual(range.inclusiveDayCount, 3)
    }

    func testReversedRangeIsRejected() throws {
        let start = try XCTUnwrap(NativeTripDateFormatting.date(fromAPI: "2026-07-26"))
        let end = try XCTUnwrap(NativeTripDateFormatting.date(fromAPI: "2026-07-25"))
        XCTAssertNil(NativeTripDateRange(startDate: start, endDate: end))
    }

    func testDateOnlySerializationRoundTripsWithoutTimezoneDrift() throws {
        for value in ["2020-02-29", "2026-07-25", "2030-12-31"] {
            let date = try XCTUnwrap(NativeTripDateFormatting.date(fromAPI: value))
            XCTAssertEqual(NativeTripDateFormatting.apiString(from: date), value)
        }
    }

    func testOverviewDurationAndRelativeTimingContractRemainsUnchanged() throws {
        let timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-12T16:00:00Z"))

        XCTAssertEqual(
            NativeTripOverviewDateCalculator.inclusiveDurationDays(
                startDate: "2026-08-11", endDate: "2026-09-02", timeZone: timeZone
            ),
            23
        )
        XCTAssertEqual(
            NativeTripOverviewDateCalculator.relativeTiming(
                startDate: "2026-08-11", endDate: "2026-09-02", now: now, timeZone: timeZone
            ),
            "Happening now"
        )
        XCTAssertEqual(
            NativeTripOverviewDateCalculator.relativeTiming(
                startDate: "2026-08-13", endDate: "2026-08-20", now: now, timeZone: timeZone
            ),
            "Starts tomorrow"
        )
        XCTAssertEqual(
            NativeTripOverviewDateCalculator.relativeTiming(
                startDate: "2026-08-01", endDate: "2026-08-11", now: now, timeZone: timeZone
            ),
            "Ended yesterday"
        )
    }
}

final class NativeTripOverviewActivityModeTests: XCTestCase {
    private let newActivity = NativeTripOverviewAction(
        kind: .newActivity,
        label: "New Activity",
        destination: .webHandoff(URL(string: "https://almidy.app/dashboard/trips/trip-1/timeline#new-plan")!)
    )
    private let places = NativeTripOverviewAction(
        kind: .places,
        label: "Places",
        destination: .nativePlaces(URL(string: "almidy://trips/trip-1/places")!)
    )
    private let routes = NativeTripOverviewAction(
        kind: .routes,
        label: "Routes",
        destination: .nativeRoutes(URL(string: "almidy://trips/trip-1/routes")!)
    )

    func testEmptyFixtureRendersOnlyAddFirstActivity() {
        let itinerary = fixture(count: 0, state: .empty)

        XCTAssertEqual(itinerary.activityMode, .empty)
        let visible = NativeTripOverviewActivityPresentation.visibleActions(
            from: [newActivity, places, routes],
            mode: itinerary.activityMode
        )
        XCTAssertEqual(visible.map(\.kind), [.newActivity])
        XCTAssertEqual(
            NativeTripOverviewActivityPresentation.label(for: newActivity, mode: itinerary.activityMode),
            "Add First Activity"
        )

        let view = NativeTripOverviewActionsView()
        view.render(actions: [newActivity, places, routes], activityMode: itinerary.activityMode)
        XCTAssertTrue(view.isUsingDedicatedEmptyAction)
        XCTAssertEqual(view.renderedActionKinds, [.newActivity])
        let control = view.descendant(withAccessibilityIdentifier: "trip-overview-empty-add-activity")
        XCTAssertEqual(control?.accessibilityLabel, "Add First Activity")
        XCTAssertEqual(control?.accessibilityHint, "Opens the new activity form for this trip")
    }

    func testPopulatedFixtureRendersOnlySupportedActions() {
        let unavailablePlaces = NativeTripOverviewAction(kind: .places, label: "Places", destination: nil)
        let unavailableFlight = NativeTripOverviewAction(kind: .flights, label: "Flights", destination: nil)
        let itinerary = fixture(count: 3, state: .available)

        XCTAssertEqual(itinerary.activityMode, .populated)
        let visible = NativeTripOverviewActivityPresentation.visibleActions(
            from: [newActivity, unavailablePlaces, routes, unavailableFlight],
            mode: itinerary.activityMode
        )
        XCTAssertEqual(visible.map(\.kind), [.newActivity, .routes])

        let view = NativeTripOverviewActionsView()
        view.render(actions: [newActivity, unavailablePlaces, routes, unavailableFlight], activityMode: itinerary.activityMode)
        XCTAssertFalse(view.isUsingDedicatedEmptyAction)
        XCTAssertEqual(view.renderedActionKinds, [.newActivity, .routes])
        XCTAssertEqual(NativeTripOverviewActionsView.populatedCircleDiameter, 52)
        XCTAssertGreaterThanOrEqual(NativeTripOverviewActionsView.populatedMinimumTarget, 44)
    }

    func testPopulatedFixtureRendersBalancedSupportedSet() {
        let itinerary = fixture(count: 3, state: .available)
        let view = NativeTripOverviewActionsView()

        view.render(actions: [newActivity, places, routes], activityMode: itinerary.activityMode)

        XCTAssertEqual(view.renderedActionKinds, [.newActivity, .places, .routes])
        XCTAssertEqual(view.renderedAccessibilityValues, ["Available", "Available", "Available"])
    }

    func testFailedFixtureDoesNotInferEmptyFromZeroCount() {
        let itinerary = fixture(count: 0, state: .failed)

        XCTAssertNil(itinerary.activityMode)
        let visible = NativeTripOverviewActivityPresentation.visibleActions(
            from: [newActivity, places, routes],
            mode: itinerary.activityMode
        )
        XCTAssertEqual(visible.map(\.kind), [.newActivity, .places, .routes])
    }

    func testCanonicalCountWinsOverNonFailedSectionLabel() {
        XCTAssertEqual(fixture(count: 0, state: .available).activityMode, .empty)
        XCTAssertEqual(fixture(count: 2, state: .empty).activityMode, .populated)
    }

    private func fixture(count: Int, state: NativeTripOverviewSectionState) -> NativeTripOverview.Itinerary {
        .init(
            status: .init(state: state, error: state == .failed ? "Unavailable" : nil),
            exactCount: count,
            dateRange: "Aug 11 → Sep 2",
            categories: count == 0 ? [] : [.init(key: "places", label: "Places", count: count, icon: "mappin")]
        )
    }
}

final class NativeTripOverviewItineraryCardTests: XCTestCase {
    func testEmptyCardKeepsTruthfulRangeAndUsesCompactTimelineLayout() {
        let card = NativeTripOverviewItineraryCard()

        card.render(fixture(count: 0, dateRange: "Aug 11 - Sep 2", categories: []), newActivityAvailable: true)

        XCTAssertEqual(card.renderedDateRange, "Aug 11 → Sep 2")
        XCTAssertEqual(card.totalText, "0 activities")
        XCTAssertTrue(card.hasAddFirstActivityAction)
        XCTAssertTrue(card.isUsingCompactEmptyInsets)
        XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.TripOverview.compactCardVerticalInset)
        XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.Radius.card)
    }

    func testWholeCardOpensItinerary() {
        let card = NativeTripOverviewItineraryCard()
        var openCount = 0
        card.onOpen = { openCount += 1 }
        card.render(fixture(count: 0, dateRange: "Aug 11 → Sep 2", categories: []), newActivityAvailable: true)

        card.sendActions(for: .touchUpInside)

        XCTAssertEqual(openCount, 1)
    }

    func testPopulatedCardShowsExactCountCentralizedCategoriesAndOverflow() {
        let card = NativeTripOverviewItineraryCard()
        let categories = ["flights", "stays", "restaurants", "bars", "routes", "shopping", "places"].map {
            NativeTripOverview.ItineraryCategory(key: $0, label: $0.capitalized, count: 1, icon: "ellipsis")
        }

        card.render(fixture(count: 11, dateRange: "Aug 11 → Sep 2", categories: categories), newActivityAvailable: true)

        XCTAssertEqual(card.totalText, "11 activities")
        XCTAssertEqual(card.renderedCategoryKeys, Array(categories.prefix(5).map(\.key)))
        XCTAssertEqual(card.overflowCount, 2)
        XCTAssertFalse(card.hasAddFirstActivityAction)
        XCTAssertFalse(card.isUsingCompactEmptyInsets)
        XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.Spacing.md)
        XCTAssertNotEqual(
            NativeTripOverviewCategoryCatalog.presentation(key: "flights").symbol,
            NativeTripOverviewCategoryCatalog.presentation(key: "restaurants").symbol
        )
    }

    private func fixture(
        count: Int,
        dateRange: String,
        categories: [NativeTripOverview.ItineraryCategory]
    ) -> NativeTripOverview.Itinerary {
        .init(
            status: .init(state: count == 0 ? .empty : .available),
            exactCount: count,
            dateRange: dateRange,
            categories: categories
        )
    }
}

final class NativeTripOverviewCardSystemTests: XCTestCase {
    func testAllOverviewCardsUseSharedSurfaceRadiusAndInsets() {
        let cards: [NativeTripOverviewCard] = [
            NativeTripOverviewItineraryCard(),
            NativeTripOverviewDocumentsCard(),
            NativeTripOverviewExpensesCard(),
            NativeTripOverviewRecentCard()
        ]

        cards.forEach { card in
            XCTAssertEqual(card.backgroundColor, AlmidyDesignTokens.Color.surface)
            XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.Radius.card)
            XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.TripOverview.cardVerticalInset)
            XCTAssertEqual(card.contentStack.spacing, AlmidyDesignTokens.TripOverview.cardContentGap)
        }
    }

    func testOverviewGridUsesReleaseRhythmAndSafeAreaBreathingRoom() {
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.outerHorizontalInset, 20)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.interCardGap, 20)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerHeight, 44)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerIconSurface, 36)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerIcon, 18)
        XCTAssertGreaterThanOrEqual(AlmidyDesignTokens.TripOverview.bottomBreathingRoom, 40)
    }
}

final class NativeTripOverviewReleaseScopeTests: XCTestCase {
    func testUnsupportedReferenceActionsNeverBecomeVisible() {
        let available: (NativeTripOverviewActionKind) -> NativeTripOverviewAction = { kind in
            NativeTripOverviewAction(
                kind: kind,
                label: kind.rawValue,
                destination: .webHandoff(URL(string: "https://almidy.app/\(kind.rawValue)")!)
            )
        }
        let actions = [available(.newActivity), available(.places), available(.routes), available(.flights), available(.stays)]

        XCTAssertEqual(
            NativeTripOverviewActivityPresentation.visibleActions(from: actions, mode: .populated).map(\.kind),
            [.newActivity, .places, .routes]
        )
        XCTAssertEqual(NativeTripOverviewReleaseScope.importedItemsTitle, "Imported items")
        XCTAssertEqual(NativeTripOverviewReleaseScope.expenseLedger, "budget_records")
    }

    func testRecentItemsUseCreationTimestampThenIDAndLimitToFive() {
        let card = NativeTripOverviewRecentCard()
        let items = [
            recent("z", "2026-08-13T10:00:00Z"), recent("a", "2026-08-13T10:00:00Z"),
            recent("b", "2026-08-13T12:00:00Z"), recent("c", "2026-08-13T11:00:00Z"),
            recent("d", "2026-08-13T09:00:00Z"), recent("e", "2026-08-13T08:00:00Z")
        ]

        card.render(.init(status: .init(state: .available), items: items))

        XCTAssertEqual(card.renderedItemIDs, ["b", "c", "a", "z", "d"])
    }

    private func recent(_ id: String, _ createdAt: String) -> NativeTripOverview.RecentItem {
        .init(
            id: id,
            title: id,
            category: "place",
            icon: "mappin",
            createdAt: createdAt,
            url: URL(string: "https://almidy.app/items/\(id)")!
        )
    }
}

private extension UIView {
    func descendant(withAccessibilityIdentifier identifier: String) -> UIView? {
        if accessibilityIdentifier == identifier { return self }
        return subviews.lazy.compactMap { $0.descendant(withAccessibilityIdentifier: identifier) }.first
    }
}

// Reusable screenshot fixtures for the native overview. These deliberately live
// in AppTests so release builds never ship fabricated trip content.
private enum NativeTripOverviewVisualFixture: String, CaseIterable {
    case newTripZeroActivities
    case oneActivity
    case multipleCategories
    case missingHeroURL
    case cachedHeroRemoteUnavailable
    case itinerarySectionFailure
    case accessibilitySizeTypography

    var contentSizeCategory: UIContentSizeCategory {
        self == .accessibilitySizeTypography ? .accessibilityExtraExtraExtraLarge : .large
    }

    var overview: NativeTripOverview {
        let count: Int
        let categories: [NativeTripOverview.ItineraryCategory]
        switch self {
        case .newTripZeroActivities, .missingHeroURL, .cachedHeroRemoteUnavailable, .itinerarySectionFailure, .accessibilitySizeTypography:
            count = 0; categories = []
        case .oneActivity:
            count = 1; categories = [.init(key: "places", label: "Places", count: 1, icon: "mappin")]
        case .multipleCategories:
            count = 7; categories = [
                .init(key: "flights", label: "Flights", count: 1, icon: "airplane"),
                .init(key: "stays", label: "Stays", count: 2, icon: "bed.double.fill"),
                .init(key: "restaurants", label: "Restaurants", count: 2, icon: "fork.knife"),
                .init(key: "places", label: "Places", count: 2, icon: "mappin")
            ]
        }
        let itineraryFailed = self == .itinerarySectionFailure
        let title = self == .accessibilitySizeTypography
            ? "San Miguel de Allende y Dolores Hidalgo"
            : "Barcelona"
        let heroURL: URL? = self == .cachedHeroRemoteUnavailable
            ? URL(string: "https://unavailable.invalid/barcelona.jpg")
            : nil
        return .init(
            version: 1,
            trip: .init(
                id: rawValue, title: title, destination: title, countryCode: "ES",
                startDate: "2026-08-11", endDate: "2026-09-02", dateRange: "Aug 11 → Sep 2",
                relativeTiming: "Happening now", durationDays: 23, status: "active"
            ),
            hero: .init(imageURL: heroURL, alt: "Barcelona destination", attribution: "Fixture photographer", sourceLabel: "Fixture", fallbackColor: "#50343C"),
            itinerary: .init(
                status: .init(state: itineraryFailed ? .failed : (count == 0 ? .empty : .available), error: itineraryFailed ? "Itinerary is temporarily unavailable." : nil),
                exactCount: count, dateRange: "Aug 11 → Sep 2", categories: categories
            ),
            documents: .init(status: .init(state: .empty), items: []),
            expenses: .init(status: .init(state: .empty), ledger: "budget_records", currencies: []),
            recentItems: .init(status: .init(state: .empty), items: []),
            actions: Self.actions
        )
    }

    var state: NativeTripOverviewViewState {
        switch self {
        case .cachedHeroRemoteUnavailable:
            return .recoverableError(
                message: "You appear to be offline. Showing saved details.",
                cached: overview,
                canRetry: true
            )
        case .itinerarySectionFailure:
            return .partial(overview, failedSections: [.itinerary])
        default:
            return .loaded(overview)
        }
    }

    var cachedHero: UIImage? {
        guard self == .cachedHeroRemoteUnavailable else { return nil }
        return Self.image(color: UIColor(red: 0.42, green: 0.24, blue: 0.30, alpha: 1))
    }

    private static let actions: [NativeTripOverviewAction] = [
        .init(kind: .newActivity, label: "New Activity", destination: .webHandoff(URL(string: "https://almidy.app/dashboard/trips/fixture/timeline#new-plan")!)),
        .init(kind: .places, label: "Places", destination: .nativePlaces(URL(string: "almidy://trips/fixture/places")!)),
        .init(kind: .routes, label: "Routes", destination: .nativeRoutes(URL(string: "almidy://trips/fixture/routes")!))
    ]

    static func image(color: UIColor) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 80, height: 120)).image { context in
            color.setFill(); context.fill(CGRect(x: 0, y: 0, width: 80, height: 120))
        }
    }
}

final class NativeTripOverviewVisualFixtureTests: XCTestCase {
    private var retainedTraitHosts: [UIViewController] = []

    func testAllRequestedVisualFixturesRenderAtPhoneSize() {
        for fixture in NativeTripOverviewVisualFixture.allCases {
            let controller = makeController(fixture)
            controller.renderForTesting(fixture.state)
            controller.view.layoutIfNeeded()

            let snapshot = controller.visualVerificationSnapshot
            XCTAssertEqual(snapshot.statusBarStyle, .lightContent, fixture.rawValue)
            XCTAssertNotNil(snapshot.headerSummary, fixture.rawValue)
            XCTAssertEqual(snapshot.importedItemsValue, "No imported items", fixture.rawValue)
            XCTAssertEqual(snapshot.expensesValue, "No expenses recorded", fixture.rawValue)
            XCTAssertEqual(snapshot.latestAddedValue, "No recently added activities", fixture.rawValue)

            let image = UIGraphicsImageRenderer(bounds: controller.view.bounds).image { _ in
                controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
            }
            let attachment = XCTAttachment(image: image)
            attachment.name = "TripOverview-\(fixture.rawValue)-\(fixture.contentSizeCategory.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    func testEmptyPopulatedPartialStaleAndOfflineFixturesRemainTruthful() {
        let empty = rendered(.newTripZeroActivities)
        XCTAssertEqual(empty.actionKinds, [.newActivity])
        XCTAssertEqual(empty.itineraryValue, "Empty")

        let one = rendered(.oneActivity)
        XCTAssertEqual(one.actionKinds, [.newActivity, .places, .routes])
        XCTAssertEqual(one.itineraryValue, "1 activity")

        let many = rendered(.multipleCategories)
        XCTAssertEqual(many.itineraryValue, "7 activities")

        let partial = rendered(.itinerarySectionFailure)
        XCTAssertEqual(partial.itineraryValue, "Temporarily unavailable")
        XCTAssertTrue(partial.statusMessage?.contains("itinerary") == true)

        let offline = rendered(.cachedHeroRemoteUnavailable)
        XCTAssertTrue(offline.statusMessage?.localizedCaseInsensitiveContains("offline") == true)

        let staleFixture = NativeTripOverviewVisualFixture.oneActivity
        let staleController = makeController(staleFixture)
        staleController.renderForTesting(.stale(staleFixture.overview, refresh: .refreshing))
        XCTAssertTrue(staleController.visualVerificationSnapshot.statusMessage?.localizedCaseInsensitiveContains("saved") == true)
    }

    func testCachedMyTripsHeroIsReusedByTripOverviewWhenRemoteImageIsUnavailable() throws {
        let fixture = NativeTripOverviewVisualFixture.cachedHeroRemoteUnavailable
        let cachedHero = try XCTUnwrap(fixture.cachedHero)
        let controller = makeController(fixture, seedImage: cachedHero)

        controller.renderForTesting(fixture.state)
        controller.view.layoutIfNeeded()

        XCTAssertTrue(
            controller.renderedHeroImageForVerification === cachedHero,
            "Trip Overview must retain the exact cached My Trips image instead of starting a second lookup or replacing it with a fallback."
        )
    }

    func testReleasePhoneLayoutHasNoAmbiguousOverviewViews() {
        var retainedWindows: [UIWindow] = []
        for fixture in NativeTripOverviewVisualFixture.allCases {
            let controller = makeController(fixture)
            let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 393, height: 852))
            window.rootViewController = controller
            window.makeKeyAndVisible()
            controller.renderForTesting(fixture.state)
            controller.view.setNeedsLayout()
            controller.view.layoutIfNeeded()

            let snapshot = controller.visualVerificationSnapshot
            XCTAssertFalse(controller.view.hasAmbiguousLayout, fixture.rawValue)
            XCTAssertEqual(snapshot.scrollFrame, controller.view.bounds, fixture.rawValue)
            XCTAssertEqual(snapshot.headerFrame.width, controller.view.bounds.width, accuracy: 0.5, fixture.rawValue)
            XCTAssertEqual(
                snapshot.contentFrame.width,
                controller.view.bounds.width - (AlmidyDesignTokens.TripOverview.outerHorizontalInset * 2),
                accuracy: 0.5,
                fixture.rawValue
            )
            XCTAssertGreaterThan(snapshot.headerFrame.height, 0, fixture.rawValue)
            XCTAssertGreaterThan(snapshot.contentFrame.height, controller.view.bounds.height, fixture.rawValue)
            retainedWindows.append(window)
        }
        withExtendedLifetime(retainedWindows) {}
    }

    func testContentSizeMatrixKeepsControlsAndCardsReachable() {
        let categories: [UIContentSizeCategory] = [
            .large, .extraLarge, .extraExtraExtraLarge, .accessibilityExtraExtraExtraLarge
        ]
        for category in categories {
            let fixture = NativeTripOverviewVisualFixture.multipleCategories
            let controller = makeController(fixture, contentSizeCategory: category)
            controller.renderForTesting(fixture.state)
            controller.view.layoutIfNeeded()
            XCTAssertEqual(controller.visualVerificationSnapshot.actionKinds, [.newActivity, .places, .routes])
            XCTAssertEqual(controller.preferredStatusBarStyle, .lightContent)
            XCTAssertEqual(controller.view.bounds.size, CGSize(width: 393, height: 852))
            XCTAssertGreaterThan(controller.currentHeaderHeight, 0)
        }
    }

    func testHeaderVoiceOverSummaryControlsContrastAndHeroFallbacks() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 340))
        let seed = NativeTripOverviewSeed(
            tripID: "header", title: "A Very Long Localized Destination Name That Wraps",
            dateRange: "Aug 11 - Sep 2", imageURL: nil, fallbackColor: "#50343C"
        )
        header.render(seed: seed)
        XCTAssertTrue(header.activeSummaryAccessibilityLabel?.contains("Aug 11 → Sep 2") == true)
        XCTAssertTrue(header.controlAccessibilityHints.allSatisfy { !($0 ?? "").isEmpty })
        XCTAssertNil(header.heroPlaceholderAccessibilityLabel)
        XCTAssertNil(header.renderedHeroImage)
        XCTAssertFalse(header.isShowingHeroLoadingState)

        let bright = NativeTripOverviewVisualFixture.image(color: .white)
        header.render(seed: seed, image: bright)
        XCTAssertNotNil(header.renderedHeroImage)

        let dark = NativeTripOverviewVisualFixture.image(color: .black)
        header.render(seed: seed, image: dark)
        XCTAssertNotNil(header.renderedHeroImage)

        let host = UIViewController()
        host.addChild(NativeTripOverviewHeaderHost(header))
        host.setOverrideTraitCollection(UITraitCollection(accessibilityContrast: .high), forChild: host.children[0])
        XCTAssertTrue(header.controlBorderWidths.allSatisfy { $0 >= 1 })
    }

    func testExpandedAndCompactStatesKeepLightStatusBarAndOneActiveHeading() {
        let fixture = NativeTripOverviewVisualFixture.oneActivity
        let controller = makeController(fixture)
        controller.renderForTesting(fixture.state)
        XCTAssertEqual(controller.preferredStatusBarStyle, .lightContent)
        let expanded = controller.visualVerificationSnapshot
        controller.setScrollOffsetForTesting(CGPoint(x: 0, y: 1_000))
        let compact = controller.visualVerificationSnapshot
        XCTAssertEqual(compact.statusBarStyle, .lightContent)
        XCTAssertNotEqual(expanded.headerHeight, compact.headerHeight)
        XCTAssertNotNil(compact.headerSummary)
    }

    private func rendered(_ fixture: NativeTripOverviewVisualFixture) -> NativeTripOverviewVisualVerificationSnapshot {
        let controller = makeController(fixture)
        controller.renderForTesting(fixture.state)
        controller.view.layoutIfNeeded()
        return controller.visualVerificationSnapshot
    }

    private func makeController(
        _ fixture: NativeTripOverviewVisualFixture,
        contentSizeCategory: UIContentSizeCategory? = nil,
        seedImage: UIImage? = nil
    ) -> NativeTripOverviewViewController {
        let store = NativeTripOverviewStore(requester: FixtureOverviewRequester(), cache: FixtureOverviewCache())
        let controller = NativeTripOverviewViewController(
            userID: "fixture-user", tripID: fixture.rawValue,
            seed: .init(
                tripID: fixture.rawValue, title: fixture.overview.trip.title,
                dateRange: fixture.overview.trip.dateRange, imageURL: fixture.overview.hero.imageURL,
                fallbackColor: fixture.overview.hero.fallbackColor
            ),
            seedImage: seedImage ?? fixture.cachedHero,
            store: store
        )
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 393, height: 852)
        let category = contentSizeCategory ?? fixture.contentSizeCategory
        if contentSizeCategory != nil {
            let parent = UIViewController()
            parent.addChild(controller)
            parent.setOverrideTraitCollection(UITraitCollection(preferredContentSizeCategory: category), forChild: controller)
            retainedTraitHosts.append(parent)
        }
        return controller
    }
}

private final class NativeTripOverviewHeaderHost: UIViewController {
    private let header: UIView
    init(_ header: UIView) { self.header = header; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func loadView() { view = header }
}

private final class FixtureOverviewRequester: NativeTripOverviewRequesting {
    func loadOverview(tripID: String, completion: @escaping (Result<Data, Error>) -> Void) {}
}

private final class FixtureOverviewCache: NativeTripOverviewCaching {
    func load(userID: String, tripID: String) -> NativeTripOverview? { nil }
    func save(_ overview: NativeTripOverview, userID: String, tripID: String) throws {}
    func remove(userID: String, tripID: String) {}
}
