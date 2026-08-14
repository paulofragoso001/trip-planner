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
        XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.Spacing.sm)
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

private extension UIView {
    func descendant(withAccessibilityIdentifier identifier: String) -> UIView? {
        if accessibilityIdentifier == identifier { return self }
        return subviews.lazy.compactMap { $0.descendant(withAccessibilityIdentifier: identifier) }.first
    }
}
