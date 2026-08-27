import XCTest
import UIKit
@testable import Almidy

final class NativeTripDateTests: XCTestCase {
    func testSavedPlaceCreateResponsePreservesCanonicalSegmentIdentity() throws {
        let payload = Data(#"{"id":"segment-123","start_time":"2026-08-24T16:00:00.000Z"}"#.utf8)
        let segment = try JSONDecoder().decode(NativeSavedPlaceSegment.self, from: payload)

        XCTAssertEqual(segment.id, "segment-123")
        XCTAssertEqual(segment.startTime, "2026-08-24T16:00:00.000Z")
    }

    func testSavedPlacePatchDraftCarriesEditableDetailsWithoutTripID() throws {
        let draft = NativeSavedPlaceDetailDraft(
            title: "Example Stay",
            location: "1 Main Street",
            startTime: "2026-08-24T16:00:00.000Z",
            endTime: "2026-08-27T15:00:00.000Z",
            bookingUrl: "https://example.com",
            confirmationCode: "ABC123",
            notes: "Late arrival",
            reservation: .init(
                phone: "+1 555 0100",
                website: "https://example.com",
                costAmount: Decimal(string: "425.50"),
                costCurrency: "USD",
                links: ["https://example.com/booking"]
            )
        )

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(draft)) as? [String: Any]
        )
        XCTAssertNil(object["tripId"])
        XCTAssertEqual(object["title"] as? String, "Example Stay")
        XCTAssertEqual(object["endTime"] as? String, "2026-08-27T15:00:00.000Z")
        let reservation = try XCTUnwrap(object["reservation"] as? [String: Any])
        XCTAssertEqual(reservation["costCurrency"] as? String, "USD")
        XCTAssertEqual(reservation["links"] as? [String], ["https://example.com/booking"])
    }

    func testActivityPreviewDetentScalesAcrossCompactAndTallPhones() {
        let compact = NativeActivitySheetMetrics.previewHeight(
            maximumDetentValue: 620,
            screenHeight: 667,
            safeAreaInsets: UIEdgeInsets(top: 20, left: 0, bottom: 0, right: 0)
        )
        let tall = NativeActivitySheetMetrics.previewHeight(
            maximumDetentValue: 850,
            screenHeight: 932,
            safeAreaInsets: UIEdgeInsets(top: 59, left: 0, bottom: 34, right: 0)
        )

        XCTAssertGreaterThanOrEqual(compact, 320)
        XCTAssertLessThanOrEqual(tall, 360)
        XCTAssertLessThan(compact, tall)
    }

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

    func testItineraryHeaderUsesReferenceTodayFormatInsideTripWindow() throws {
        let timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-15T16:00:00Z"))

        XCTAssertEqual(
            NativeTripOverviewDateCalculator.itineraryHeaderDate(
                startDate: "2026-08-15",
                endDate: "2026-09-09",
                now: now,
                timeZone: timeZone,
                locale: Locale(identifier: "en_US")
            ),
            "Today, Saturday, Aug 15"
        )
    }

    func testItineraryHeaderUsesNearestTripBoundaryOutsideTripWindow() throws {
        let timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let beforeTrip = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-12T16:00:00Z"))
        let afterTrip = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-09-12T16:00:00Z"))

        XCTAssertEqual(
            NativeTripOverviewDateCalculator.itineraryHeaderDate(
                startDate: "2026-08-15", endDate: "2026-09-09", now: beforeTrip,
                timeZone: timeZone, locale: Locale(identifier: "en_US")
            ),
            "Saturday, Aug 15"
        )
        XCTAssertEqual(
            NativeTripOverviewDateCalculator.itineraryHeaderDate(
                startDate: "2026-08-15", endDate: "2026-09-09", now: afterTrip,
                timeZone: timeZone, locale: Locale(identifier: "en_US")
            ),
            "Wednesday, Sep 9"
        )
    }
}

final class NativeTripCardMenuTests: XCTestCase {
    private let referenceDate = ISO8601DateFormatter().date(from: "2026-08-15T16:00:00Z")!

    func testTripsAreOrderedActiveThenFutureByScheduledStartDate() {
        let trips = [
            trip(id: "future-later", start: "2026-09-17", end: "2026-09-30"),
            trip(id: "past", start: "2026-07-01", end: "2026-07-05"),
            trip(id: "future-sooner", start: "2026-08-26", end: "2026-09-03"),
            trip(id: "active", start: "2026-08-11", end: "2026-08-25")
        ]

        XCTAssertEqual(
            NativeMapTrip.scheduled(trips, relativeTo: referenceDate).map(\.id),
            ["active", "future-sooner", "future-later", "past"]
        )
    }

    func testScheduleStateIncludesBothTripBoundaryDates() {
        let startsToday = trip(id: "starts-today", start: "2026-08-15", end: "2026-08-20")
        let endsToday = trip(id: "ends-today", start: "2026-08-01", end: "2026-08-15")
        XCTAssertEqual(startsToday.scheduleState(relativeTo: referenceDate), .active)
        XCTAssertEqual(endsToday.scheduleState(relativeTo: referenceDate), .active)
    }

    func testActiveAndFutureStatusesStayTruthful() {
        let active = trip(id: "active", start: "2026-08-11", end: "2026-08-25")
        let future = trip(id: "future", start: "2026-08-26", end: "2026-09-03")
        XCTAssertEqual(active.relativeStatus(relativeTo: referenceDate), "Ends in 10 days")
        XCTAssertEqual(future.relativeStatus(relativeTo: referenceDate), "Starts in 11 days")
    }

    func testCardGeometryAndTypographyMatchReferenceScale() {
        XCTAssertEqual(NativeTripCardLayout.activeHeight, 354)
        XCTAssertEqual(NativeTripCardLayout.futureHeight, 224)
        XCTAssertGreaterThan(NativeTripCardLayout.activeHeight, NativeTripCardLayout.futureHeight)
        XCTAssertEqual(NativeTripCardLayout.titleFontSize, 32)
        XCTAssertEqual(NativeTripCardLayout.dateFontSize, 17)
        XCTAssertEqual(NativeTripCardLayout.statusFontSize, 17)
    }

    func testMenuActionsRemainInReferenceOrder() {
        XCTAssertEqual(
            NativeTripCardMenuAction.allCases.map(\.title),
            [
                "Share Trip",
                "Edit Name",
                "Change Dates",
                "Change Background",
                "Duplicate Trip",
                "Merge into another Trip",
                "Remove Trip",
            ]
        )
    }

    func testMenuActionsUseDistinctSystemImages() {
        let images = NativeTripCardMenuAction.allCases.map(\.systemImage)
        XCTAssertEqual(Set(images).count, images.count)
    }

    private func trip(id: String, start: String, end: String) -> NativeMapTrip {
        NativeMapTrip(
            id: id,
            name: id,
            destination: id,
            latitude: 0,
            longitude: 0,
            startDate: start,
            endDate: end
        )
    }
}

final class NativeActivityCatalogTests: XCTestCase {
    func testCatalogPreservesEveryReferenceSection() {
        XCTAssertEqual(
            NativeActivityCatalog.sections.map(\.title),
            [
                "Stays and Other Accommodation", "Transportation", "Food & Drink", "Art & Fun",
                "Locations", "Work & Study", "Outdoor", "Sports", "Services", "Health", "Shopping",
            ]
        )
    }

    func testCatalogPreservesEveryReferenceOption() {
        XCTAssertEqual(
            NativeActivityCatalog.quickNames,
            [
                "Flight", "Stay", "Restaurant", "Tour", "Car", "Train",
                "Shopping", "Museum", "Event", "Car Rental", "Park",
            ]
        )
        XCTAssertEqual(NativeActivityCatalog.allNames.count, 55)
        XCTAssertTrue(["Campground", "Motorcycle", "Winery", "Nightlife", "University", "Public Transport", "Pharmacy", "Food Market"].allSatisfy {
            NativeActivityCatalog.allNames.contains($0)
        })
        XCTAssertEqual(Set(NativeActivityCatalog.allNames).count, NativeActivityCatalog.allNames.count)
    }

    func testEveryBuiltInActivityHasASearchAndMapPurpose() {
        XCTAssertEqual(NativeActivityPurposeRegistry.unresolvedCatalogNames, [])
        XCTAssertEqual(NativeActivityPurposeRegistry.all.count, NativeActivityCatalog.allNames.count)
    }

    func testQuickAliasesResolveToCanonicalPurposes() {
        XCTAssertEqual(NativeActivityPurposeRegistry.purpose(named: "Flight")?.canonicalName, "Flights")
        XCTAssertEqual(NativeActivityPurposeRegistry.purpose(named: "Stay")?.canonicalName, "Stays")
    }

    func testAccommodationPurposesUseExpectedSearchAndMapConfiguration() {
        let stays = NativeActivityPurposeRegistry.purpose(named: "Stays")
        XCTAssertEqual(stays?.searchToken, "Stay")
        XCTAssertEqual(stays?.searchPlaceholder, "Hotel name or address")
        XCTAssertEqual(stays?.mapPlaceKinds, [.lodging])
        XCTAssertEqual(stays?.domain, .accommodation)

        let campground = NativeActivityPurposeRegistry.purpose(named: "Campground")
        XCTAssertEqual(campground?.mapPlaceKinds, [.campground])
        XCTAssertTrue(campground?.queryTerms.contains("RV park") == true)
    }

    func testPurposeLookupNormalizesPunctuationAndCase() {
        XCTAssertEqual(NativeActivityPurposeRegistry.purpose(named: " BAR & party ")?.canonicalName, "Bar & Party")
    }

    func testOnlyTransportationCategoriesOpenDedicatedActivityForms() {
        let transportation = NativeActivityCatalog.sections.first { $0.title == "Transportation" }?.items ?? []
        XCTAssertFalse(transportation.isEmpty)
        XCTAssertTrue(transportation.allSatisfy {
            NativeActivityPurposeRegistry.purpose(for: $0).opensDedicatedActivityForm
        })

        let everyOtherCategory = NativeActivityCatalog.sections
            .filter { $0.title != "Transportation" }
            .flatMap(\.items)
        XCTAssertFalse(everyOtherCategory.isEmpty)
        XCTAssertTrue(everyOtherCategory.allSatisfy {
            !NativeActivityPurposeRegistry.purpose(for: $0).opensDedicatedActivityForm
        })
    }

    func testCustomCategoryGetsGenericSearchAndMapFallback() {
        let category = NativeActivityCategory(name: "Observation Deck", symbols: ["binoculars.fill"], palette: .service)
        let purpose = NativeActivityPurposeRegistry.purpose(for: category)

        XCTAssertEqual(purpose.canonicalName, "Observation Deck")
        XCTAssertEqual(purpose.searchToken, "Observation Deck")
        XCTAssertEqual(purpose.searchPlaceholder, "Search activities and places")
        XCTAssertEqual(purpose.queryTerms, ["Observation Deck"])
        XCTAssertEqual(purpose.mapPlaceKinds, [.generic])
        XCTAssertEqual(purpose.domain, .custom)
    }
}

final class TransportationActivityDraftTests: XCTestCase {
    func testEveryTransportationCategoryMapsToATypedKind() {
        let transportation = NativeActivityCatalog.sections.first { $0.title == "Transportation" }?.items ?? []

        XCTAssertEqual(transportation.count, TransportationActivityDraft.Kind.allCases.count)
        XCTAssertTrue(transportation.allSatisfy {
            TransportationActivityDraft.Kind(categoryName: $0.name) != nil
        })
    }

    func testDraftRoundTripsAllPersistenceBoundaryValues() throws {
        let start = Date(timeIntervalSince1970: 1_787_425_200)
        let end = start.addingTimeInterval(24_300)
        let draft = TransportationActivityDraft(
            tripID: "trip-123",
            kind: .flight,
            title: "Miami to Barcelona",
            company: "American Airlines",
            transportNumber: "AA1546",
            departure: .init(name: "Miami International Airport", address: "Miami, FL", latitude: 25.7959, longitude: -80.2870),
            arrival: .init(name: "Barcelona-El Prat Airport", address: "Barcelona", latitude: 41.2974, longitude: 2.0833),
            startAt: start,
            endAt: end,
            reservation: .init(
                confirmationCode: "AA1544", seat: "3A", seatClass: "Business",
                coachNumber: nil, vehicle: nil, phone: nil, website: URL(string: "https://aa.com")
            ),
            cost: .init(amount: Decimal(string: "1500.00")!, currency: "usd"),
            note: "Window seat",
            attachments: [
                .init(
                    id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
                    kind: .link,
                    displayName: "Reservation",
                    sourceURL: URL(string: "https://aa.com/reservation")!
                )
            ]
        )

        let decoded = try JSONDecoder().decode(
            TransportationActivityDraft.self,
            from: JSONEncoder().encode(draft)
        )

        XCTAssertEqual(decoded, draft)
        XCTAssertEqual(decoded.cost?.currency, "USD")
        XCTAssertEqual(decoded.departure?.hasCoordinate, true)
        XCTAssertEqual(decoded.arrival?.hasCoordinate, true)
    }
}

final class NativeTripOverviewMenuTests: XCTestCase {
    func testOverviewMenuMatchesReferenceOrder() {
        XCTAssertEqual(
            NativeTripOverviewMenuAction.allCases.map(\.title),
            [
                "Share Trip",
                "Manage Guests",
                "Edit Name",
                "Change Dates",
                "Change Background",
                "Duplicate Trip",
                "Merge into another trip",
                "Turn Off Notifications",
            ]
        )
    }

    func testOverviewMenuUsesDistinctIcons() {
        let images = NativeTripOverviewMenuAction.allCases.map(\.systemImage)
        XCTAssertEqual(Set(images).count, images.count)
    }

    func testAllOverviewMenuDestinationsAreEnabled() {
        XCTAssertTrue(NativeTripOverviewMenuAction.allCases.allSatisfy(\.isAvailable))
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
        view.frame = CGRect(x: 0, y: 0, width: 353, height: 150)
        view.layoutIfNeeded()
        XCTAssertGreaterThanOrEqual(control?.bounds.width ?? 0, AlmidyDesignTokens.TripOverview.minimumInteractiveTarget)
        XCTAssertGreaterThanOrEqual(control?.bounds.height ?? 0, AlmidyDesignTokens.TripOverview.minimumInteractiveTarget)
        let circle = view.descendant(withAccessibilityIdentifier: "trip-overview-measure-empty-action-circle")
        let icon = view.descendant(withAccessibilityIdentifier: "trip-overview-measure-empty-action-icon") as? UIImageView
        let label = view.descendant(withAccessibilityIdentifier: "trip-overview-measure-empty-action-label")
        XCTAssertEqual(circle?.bounds.size, CGSize(width: 72, height: 72))
        XCTAssertTrue(icon?.tintColor.isEqual(AlmidyDesignTokens.Color.tripOverviewAccent) == true)
        if let circle, let label {
            let circleFrame = circle.convert(circle.bounds, to: view)
            let labelFrame = label.convert(label.bounds, to: view)
            XCTAssertEqual(labelFrame.minY - circleFrame.maxY, AlmidyDesignTokens.TripOverview.emptyActionLabelGap, accuracy: 0.5)
        }

        view.updateTransition(progress: 1)
        view.layoutIfNeeded()
        XCTAssertEqual(
            view.emptyActionCircleDiameter,
            AlmidyDesignTokens.TripOverview.CollapsedComposition.activityCircleDiameter
        )
        XCTAssertEqual(
            view.emptyActionLabelGap,
            AlmidyDesignTokens.TripOverview.CollapsedComposition.activityCircleToLabelGap
        )
        XCTAssertEqual(control?.accessibilityLabel, "Add First Activity")
        XCTAssertEqual(control?.accessibilityHint, "Opens the new activity form for this trip")
        XCTAssertGreaterThanOrEqual(control?.bounds.width ?? 0, AlmidyDesignTokens.TripOverview.minimumInteractiveTarget)
        XCTAssertGreaterThanOrEqual(control?.bounds.height ?? 0, AlmidyDesignTokens.TripOverview.minimumInteractiveTarget)
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
        XCTAssertEqual(NativeTripOverviewActionsView.populatedCircleDiameter, 64)
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
    func testCardUsesFullTripDateRange() throws {
        let card = NativeTripOverviewItineraryCard()
        let timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-15T16:00:00Z"))
        let trip = NativeTripOverview.Trip(
            id: "trip-1", title: "New York", destination: "New York", countryCode: "US",
            startDate: "2026-08-15", endDate: "2026-09-09", dateRange: "Aug 15 → Sep 9",
            relativeTiming: "Happening now", durationDays: 26, status: "active"
        )

        card.render(
            fixture(count: 0, dateRange: "Aug 15 → Sep 9", categories: []),
            trip: trip,
            newActivityAvailable: true,
            now: now,
            timeZone: timeZone,
            locale: Locale(identifier: "en_US")
        )

        XCTAssertEqual(card.renderedDateRange, "Aug 15 → Sep 9")
    }

    func testEmptyCardKeepsTruthfulRangeAndUsesCompactTimelineLayout() {
        let card = NativeTripOverviewItineraryCard()

        card.render(fixture(count: 0, dateRange: "Aug 11 - Sep 2", categories: []), newActivityAvailable: true)

        XCTAssertEqual(card.renderedDateRange, "Aug 11 → Sep 2")
        XCTAssertEqual(card.totalText, "0 activities")
        XCTAssertTrue(card.hasAddFirstActivityAction)
        XCTAssertFalse(card.hasViewAllDaysAction)
        XCTAssertTrue(card.isUsingCompactEmptyInsets)
        XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.TripOverview.itineraryCardVerticalInset)
        XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.TripOverview.cardCornerRadius)
        XCTAssertEqual(card.contentStack.spacing, AlmidyDesignTokens.TripOverview.itineraryContentGap)
    }

    func testEmptyCardAddFirstActivityUsesWorkingAction() throws {
        let card = NativeTripOverviewItineraryCard()
        var newActivityCount = 0
        card.onNewActivity = { newActivityCount += 1 }
        card.render(fixture(count: 0, dateRange: "Aug 11 → Sep 2", categories: []), newActivityAvailable: true)
        card.frame = CGRect(x: 0, y: 0, width: 353, height: 220)
        card.layoutIfNeeded()

        let action = try XCTUnwrap(
            card.contentStack.arrangedSubviews
                .compactMap { $0 as? UIButton }
                .first { $0.title(for: .normal) == "Add First Activity" }
        )
        action.sendActions(for: .touchUpInside)

        XCTAssertEqual(newActivityCount, 1)
        XCTAssertEqual(action.accessibilityHint, "Opens the new activity form")
        XCTAssertGreaterThanOrEqual(action.bounds.height, AlmidyDesignTokens.TripOverview.minimumInteractiveTarget)
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
        XCTAssertFalse(card.hasViewAllDaysAction)
        XCTAssertFalse(card.isUsingCompactEmptyInsets)
        XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.TripOverview.cardVerticalInset)
        XCTAssertNotEqual(
            NativeTripOverviewCategoryCatalog.presentation(key: "flights").symbol,
            NativeTripOverviewCategoryCatalog.presentation(key: "restaurants").symbol
        )
    }

    func testPopulatedCardDoesNotInferMultiDayActionFromTripRange() {
        let card = NativeTripOverviewItineraryCard()
        let categories = [
            NativeTripOverview.ItineraryCategory(key: "places", label: "Places", count: 2, icon: "mappin")
        ]

        card.render(fixture(count: 2, dateRange: "Aug 11 → Sep 2", categories: categories), newActivityAvailable: true)

        XCTAssertEqual(card.renderedDateRange, "Aug 11 → Sep 2")
        XCTAssertEqual(card.totalText, "2 activities")
        XCTAssertEqual(card.renderedCategoryKeys, ["places"])
        XCTAssertFalse(card.hasAddFirstActivityAction)
        XCTAssertFalse(card.hasViewAllDaysAction)
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
        let itinerary = NativeTripOverviewItineraryCard()
        let importedItems = NativeTripOverviewDocumentsCard()
        let expenses = NativeTripOverviewExpensesCard()
        let cards: [NativeTripOverviewCard] = [
            NativeTripOverviewRecentCard()
        ]

        XCTAssertEqual(itinerary.backgroundColor, AlmidyDesignTokens.Color.surface)
        XCTAssertEqual(itinerary.layer.cornerRadius, AlmidyDesignTokens.TripOverview.cardCornerRadius)
        XCTAssertEqual(itinerary.verticalContentInset, AlmidyDesignTokens.TripOverview.cardVerticalInset)
        XCTAssertEqual(itinerary.contentStack.spacing, AlmidyDesignTokens.TripOverview.itineraryContentGap)
        XCTAssertEqual(importedItems.backgroundColor, AlmidyDesignTokens.Color.surface)
        XCTAssertEqual(importedItems.layer.cornerRadius, AlmidyDesignTokens.TripOverview.cardCornerRadius)
        XCTAssertEqual(importedItems.verticalContentInset, AlmidyDesignTokens.TripOverview.importedItemsCardVerticalInset)
        XCTAssertEqual(importedItems.contentStack.spacing, AlmidyDesignTokens.TripOverview.importedItemsContentGap)
        XCTAssertEqual(expenses.backgroundColor, AlmidyDesignTokens.Color.surface)
        XCTAssertEqual(expenses.layer.cornerRadius, AlmidyDesignTokens.TripOverview.cardCornerRadius)
        XCTAssertEqual(expenses.verticalContentInset, AlmidyDesignTokens.TripOverview.expensesCardVerticalInset)
        XCTAssertEqual(expenses.contentStack.spacing, AlmidyDesignTokens.TripOverview.expensesContentGap)

        cards.forEach { card in
            XCTAssertEqual(card.backgroundColor, AlmidyDesignTokens.Color.surface)
            XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.TripOverview.cardCornerRadius)
            XCTAssertEqual(card.verticalContentInset, AlmidyDesignTokens.TripOverview.cardVerticalInset)
            XCTAssertEqual(card.contentStack.spacing, AlmidyDesignTokens.TripOverview.cardContentGap)
        }
    }

    func testOverviewGridUsesReleaseRhythmAndSafeAreaBreathingRoom() {
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.outerHorizontalInset, 20)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.sheetCornerRadius, 34)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expandedHeaderHeight, 370)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.accessibilityExpandedHeaderHeight, 446)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.destinationBlockBottomInset, 14)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerControlDiameter, 48)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerControlSideInset, 20)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerControlGap, 12)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerControlTopInset, 14)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.emptyActionTopInset, 15)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.countryFlagDiameter, 52)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.countryFlagTitleGap, 10)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.emptyActionLabelGap, 3)
        XCTAssertGreaterThanOrEqual(AlmidyDesignTokens.TripOverview.minimumInteractiveTarget, 44)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.cardCornerRadius, 28)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.cardHorizontalInset, 16)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.cardVerticalInset, 14)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.interCardGap, 18)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerHeight, 40)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerIconSurface, 32)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerIcon, 16)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headingFont.pointSize, 17)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.bodyFont.pointSize, 15)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.metadataFont.pointSize, 13)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.actionFont.pointSize, 15)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.iconClusterDiameter, 40)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.iconClusterOverlap, -6)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.itineraryCardVerticalInset, 8)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.itineraryContentGap, 6)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.itineraryRowHeight, 40)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.itineraryTimelineConnectorHeight, 14)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsCardVerticalInset, 10)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsContentGap, 8)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsHeaderHeight, 40)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsHeaderIconSurface, 32)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsHeadingFont.pointSize, 17)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsBodyFont.pointSize, 15)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsIconClusterDiameter, 36)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.importedItemsEmptyMinimumHeight, 276)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesCardVerticalInset, 10)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesContentGap, 8)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesHeaderHeight, 40)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesHeaderIconSurface, 32)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesHeadingFont.pointSize, 17)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesBodyFont.pointSize, 15)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesIconClusterDiameter, 36)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expensesEmptyMinimumHeight, 276)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.utilityCardMinimumHeight, 136)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.separatorInset, 0)
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
        XCTAssertEqual(NativeTripOverviewReleaseScope.importedItemsDestinationTitle, "Documents")
        XCTAssertEqual(NativeTripOverviewReleaseScope.importedItemsEmptyActionTitle, "View Documents")
        XCTAssertFalse(NativeTripOverviewReleaseScope.importedItemsRequiresEntitlement)
        XCTAssertFalse(NativeTripOverviewReleaseScope.supportsDedicatedDocumentImportAction)
        XCTAssertEqual(NativeTripOverviewReleaseScope.expenseLedger, "budget_records")
        XCTAssertFalse(NativeTripOverviewReleaseScope.expensesRequiresEntitlement)
        XCTAssertFalse(NativeTripOverviewReleaseScope.supportsDedicatedExpenseCreationAction)
        XCTAssertTrue(NativeTripOverviewReleaseScope.supportsExpenseAmountPrivacyControl)
        XCTAssertTrue(NativeTripOverviewReleaseScope.supportsBudgetHandoff)
        XCTAssertEqual(NativeTripOverviewReleaseScope.expensesEmptyActionTitle, "View Budget")
        XCTAssertTrue(NativeTripOverviewReleaseScope.usesBrandMutedGoldAccent)
        XCTAssertTrue(NativeTripOverviewReleaseScope.itineraryMetadataUsesContextualDate)
        XCTAssertTrue(AlmidyDesignTokens.Color.tripOverviewAccent.isEqual(AlmidyDesignTokens.Color.goldMuted))
        XCTAssertTrue(AlmidyDesignTokens.Color.tripOverviewAccentSurface.isEqual(AlmidyDesignTokens.Color.goldMutedSurface))
    }

    func testIntentionalProductCopyAndEntitlementDecisionsRemainVisible() {
        let empty = NativeTripOverviewVisualFixture.newTripZeroActivities.overview
        let itinerary = NativeTripOverviewItineraryCard()
        let importedItems = NativeTripOverviewDocumentsCard()
        let expenses = NativeTripOverviewExpensesCard()

        itinerary.render(empty.itinerary, newActivityAvailable: true)
        importedItems.render(empty.documents)
        expenses.render(empty.expenses)

        XCTAssertEqual(itinerary.renderedDateRange, empty.trip.dateRange)
        XCTAssertTrue(itinerary.hasAddFirstActivityAction)
        XCTAssertEqual(importedItems.accessibilityLabel, "Imported items")
        XCTAssertEqual(importedItems.descendant(withAccessibilityIdentifier: "trip-overview-measure-documents-action")?.accessibilityLabel, "View Documents")
        XCTAssertEqual(expenses.descendant(withAccessibilityIdentifier: "trip-overview-measure-expenses-action")?.accessibilityLabel, "View Budget")

        let visibleSemantics = (importedItems.recursiveAccessibilityLabels + expenses.recursiveAccessibilityLabels)
            .joined(separator: " ")
            .lowercased()
        XCTAssertFalse(visibleSemantics.contains("pro"))
        XCTAssertFalse(visibleSemantics.contains("lock"))
        XCTAssertTrue(AlmidyDesignTokens.Color.tripOverviewAccent.isEqual(AlmidyDesignTokens.Color.goldMuted))
    }

    func testLowerCardDestinationsMatchSupportedProductFlows() {
        let controller = UIViewController()
        var routedURLs: [URL] = []
        let router = NativeTripOverviewRouter(
            viewController: controller,
            webHandoff: { routedURLs.append($0) },
            nativeRoute: { _, _ in XCTFail("Lower cards should use the controlled web handoff") }
        )

        router.route(.importedItems, tripID: "trip 123")
        router.route(.expenses, tripID: "trip 123")

        XCTAssertEqual(routedURLs.map(\.almidyRoute), [
            "/dashboard/trips/trip%20123/documents",
            "/dashboard/trips/trip%20123/budget"
        ])
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

    var recursiveAccessibilityLabels: [String] {
        [accessibilityLabel].compactMap { $0 } + subviews.flatMap(\.recursiveAccessibilityLabels)
    }
}

// Reusable screenshot fixtures for the native overview. These deliberately live
// in AppTests so release builds never ship fabricated trip content.
private enum NativeTripOverviewVisualFixture: String, CaseIterable {
    case newTripZeroActivities
    case oneActivity
    case multipleCategories
    case populatedSections
    case singleDayTrip
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
        case .oneActivity, .singleDayTrip:
            count = 1; categories = [.init(key: "places", label: "Places", count: 1, icon: "mappin")]
        case .multipleCategories, .populatedSections:
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
        let singleDay = self == .singleDayTrip
        let populated = self == .populatedSections
        let tripDateRange = singleDay ? "Aug 11" : "Aug 11 → Sep 2"
        let documents: [NativeTripOverview.Document] = populated ? [
            .init(id: "reservation-1", title: "Hotel confirmation", type: "reservation_email", date: "2026-08-10", url: URL(string: "https://almidy.app/documents/1")!),
            .init(id: "photo-1", title: "Museum tickets", type: "photo", date: "2026-08-11", url: URL(string: "https://almidy.app/documents/2")!)
        ] : []
        let currencies: [NativeTripOverview.ExpenseCurrency] = populated ? [
            .init(
                total: .init(currency: "USD", amount: 425),
                categories: [.init(key: "stays", label: "Stays", money: .init(currency: "USD", amount: 425))]
            )
        ] : []
        return .init(
            version: 1,
            trip: .init(
                id: rawValue, title: title, destination: title, countryCode: "ES",
                startDate: "2026-08-11", endDate: singleDay ? "2026-08-11" : "2026-09-02", dateRange: tripDateRange,
                relativeTiming: "Happening now", durationDays: singleDay ? 1 : 23, status: "active"
            ),
            hero: .init(imageURL: heroURL, alt: "Barcelona destination", attribution: "Fixture photographer", sourceLabel: "Fixture", fallbackColor: "#50343C"),
            itinerary: .init(
                status: .init(state: itineraryFailed ? .failed : (count == 0 ? .empty : .available), error: itineraryFailed ? "Itinerary is temporarily unavailable." : nil),
                exactCount: count, dateRange: tripDateRange, categories: categories
            ),
            documents: .init(status: .init(state: populated ? .available : .empty), items: documents),
            expenses: .init(status: .init(state: populated ? .available : .empty), ledger: "budget_records", currencies: currencies),
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
            let documentCount = fixture.overview.documents.items.count
            let expectedDocuments = documentCount == 0
                ? "No imported items"
                : "\(documentCount) imported \(documentCount == 1 ? "item" : "items")"
            let currencyCount = fixture.overview.expenses.currencies.count
            let expectedExpenses = currencyCount == 0
                ? "No expenses recorded"
                : "\(currencyCount) currency totals"
            let recentCount = min(5, fixture.overview.recentItems.items.count)
            let expectedRecent = recentCount == 0
                ? "No recently added activities"
                : "\(recentCount) recently added \(recentCount == 1 ? "activity" : "activities")"
            XCTAssertEqual(snapshot.importedItemsValue, expectedDocuments, fixture.rawValue)
            XCTAssertEqual(snapshot.expensesValue, expectedExpenses, fixture.rawValue)
            XCTAssertEqual(snapshot.latestAddedValue, expectedRecent, fixture.rawValue)

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

    func testReleasePhoneFrameBaselineIsRecordedAndNumericallyGuarded() throws {
        let fixture = NativeTripOverviewVisualFixture.newTripZeroActivities
        let controller = makeController(fixture)
        controller.renderForTesting(fixture.state)
        controller.view.layoutIfNeeded()

        let snapshot = controller.visualVerificationSnapshot
        let frames = snapshot.measuredFrames
        let required = [
            "trip-overview-measure-header",
            "trip-overview-measure-header-grabber",
            "trip-overview-measure-header-image-region",
            "trip-overview-measure-header-image-focal-point",
            "trip-overview-measure-header-fade-region",
            "trip-overview-measure-header-more",
            "trip-overview-measure-header-search",
            "trip-overview-measure-header-close",
            "trip-overview-measure-header-title",
            "trip-overview-measure-header-timing",
            "trip-overview-measure-header-date",
            "trip-overview-measure-header-expanded-labels",
            "trip-overview-measure-empty-action-circle",
            "trip-overview-measure-empty-action-label",
            "trip-overview-measure-itinerary-card",
            "trip-overview-measure-itinerary-title",
            "trip-overview-measure-itinerary-metadata",
            "trip-overview-measure-itinerary-empty-row",
            "trip-overview-measure-itinerary-timeline-connector",
            "trip-overview-measure-itinerary-divider-primary",
            "trip-overview-measure-itinerary-action",
            "trip-overview-measure-documents-card",
            "trip-overview-measure-imported-items-title",
            "trip-overview-measure-documents-icons",
            "trip-overview-measure-documents-body",
            "trip-overview-measure-documents-action",
            "trip-overview-measure-expenses-card",
            "trip-overview-measure-expenses-title",
            "trip-overview-measure-expenses-icons",
            "trip-overview-measure-expenses-body",
            "trip-overview-measure-expenses-action"
        ]
        required.forEach { key in
            XCTAssertNotNil(frames[key], "Missing measurable frame: \(key)")
        }

        XCTAssertEqual(try XCTUnwrap(frames["trip-overview-measure-header"]).size, CGSize(width: 393, height: 370))
        for control in ["header-more", "header-search", "header-close"] {
            XCTAssertEqual(
                try XCTUnwrap(frames["trip-overview-measure-\(control)"]).size,
                CGSize(width: 48, height: 48),
                "\(control) changed from the captured release baseline"
            )
        }

        let cardKeys = ["itinerary-card", "documents-card", "expenses-card"]
        let cards = try cardKeys.map { try XCTUnwrap(frames["trip-overview-measure-\($0)"]) }
        cards.forEach { card in
            XCTAssertEqual(card.minX, 20, accuracy: 0.5)
            XCTAssertEqual(card.width, 353, accuracy: 0.5)
            XCTAssertGreaterThan(card.height, 0)
        }
        XCTAssertLessThan(cards[0].maxY, cards[1].minY)
        XCTAssertLessThan(cards[1].maxY, cards[2].minY)
        let headerFrame = try XCTUnwrap(frames["trip-overview-measure-header"])
        let destinationBlock = try XCTUnwrap(frames["trip-overview-measure-header-expanded-labels"])
        let emptyActionCircle = try XCTUnwrap(frames["trip-overview-measure-empty-action-circle"])
        let emptyActionLabel = try XCTUnwrap(frames["trip-overview-measure-empty-action-label"])
        XCTAssertEqual(
            destinationBlock.maxY,
            headerFrame.maxY - AlmidyDesignTokens.TripOverview.destinationBlockBottomInset,
            accuracy: 0.5
        )
        XCTAssertGreaterThanOrEqual(emptyActionCircle.minY, headerFrame.maxY)
        XCTAssertEqual(emptyActionCircle.size, CGSize(width: 72, height: 72))
        XCTAssertEqual(
            emptyActionLabel.minY - emptyActionCircle.maxY,
            AlmidyDesignTokens.TripOverview.emptyActionLabelGap,
            accuracy: 0.5
        )
        XCTAssertEqual(
            (AlmidyDesignTokens.TripOverview.emptyActionTopInset - 8) * 3,
            21,
            accuracy: 0.5,
            "The action should move about 20–25 reference pixels lower relative to the title."
        )
        XCTAssertGreaterThan(cards[0].minY, emptyActionCircle.maxY)

        controller.setScrollOffsetForTesting(CGPoint(x: 0, y: 1_000))
        controller.view.layoutIfNeeded()
        let compactFrames = controller.visualVerificationSnapshot.measuredFrames
        let compactHeader = try XCTUnwrap(compactFrames["trip-overview-measure-header"])
        let compactLabels = try XCTUnwrap(compactFrames["trip-overview-measure-header-compact-labels"])
        let compactControl = try XCTUnwrap(compactFrames["trip-overview-measure-header-more"])
        let compactGrabber = try XCTUnwrap(compactFrames["trip-overview-measure-header-grabber"])
        XCTAssertEqual(compactHeader.height, 100, accuracy: 0.5)
        XCTAssertEqual(compactLabels.midY, compactControl.midY, accuracy: 0.5)
        XCTAssertFalse(compactGrabber.intersects(compactControl))

        let report = XCTAttachment(string: "name,x,y,width,height\n\(snapshot.measuredFrameReport)")
        report.name = "TripOverview-release-phone-frame-baseline-393x852.csv"
        report.lifetime = .keepAlways
        add(report)
        let normalizedReport = XCTAttachment(
            string: "name,x_over_sheet_width,y_over_expanded_header,width_over_sheet_width,height_over_expanded_header\n\(snapshot.normalizedMeasuredFrameReport)"
        )
        normalizedReport.name = "TripOverview-release-phone-normalized-geometry-393x852.csv"
        normalizedReport.lifetime = .keepAlways
        add(normalizedReport)
    }

    func testExpandedItineraryTopRemainsInsideApprovedCompositionBudget() throws {
        let fixture = NativeTripOverviewVisualFixture.newTripZeroActivities
        let controller = makeController(fixture, size: CGSize(width: 440, height: 956))
        controller.renderForTesting(fixture.state)
        controller.view.layoutIfNeeded()

        let snapshot = controller.visualVerificationSnapshot
        let sheet = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header"])
        let itinerary = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-itinerary-card"])
        let sheetToItinerary = itinerary.minY - sheet.minY

        XCTAssertEqual(
            sheetToItinerary,
            AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline,
            accuracy: AlmidyDesignTokens.TripOverview.expandedItineraryTopTolerance,
            "The expanded hero, destination, and empty-action composition must not move the approved Itinerary anchor by more than four reference pixels."
        )
        XCTAssertEqual(
            AlmidyDesignTokens.TripOverview.expandedItineraryTopTolerance,
            4 / 3,
            accuracy: 0.001
        )
    }

    func testExpandedGeometryAnchorsScaleProportionallyAcrossPhoneWidths() throws {
        let fixture = NativeTripOverviewVisualFixture.newTripZeroActivities
        let dimensions = [CGSize(width: 375, height: 667), CGSize(width: 393, height: 852), CGSize(width: 430, height: 932)]
        let keys = [
            "trip-overview-measure-header-grabber",
            "trip-overview-measure-header-image-region",
            "trip-overview-measure-header-image-focal-point",
            "trip-overview-measure-header-fade-region",
            "trip-overview-measure-header-title",
            "trip-overview-measure-header-timing",
            "trip-overview-measure-header-date",
            "trip-overview-measure-empty-action-circle",
            "trip-overview-measure-empty-action-label",
            "trip-overview-measure-itinerary-card"
        ]
        let snapshots = dimensions.map { size -> NativeTripOverviewVisualVerificationSnapshot in
            let controller = makeController(fixture, size: size)
            controller.renderForTesting(fixture.state)
            controller.view.layoutIfNeeded()
            return controller.visualVerificationSnapshot
        }
        let baseline = snapshots[1].normalizedMeasuredFrames
        for snapshot in snapshots {
            XCTAssertEqual(snapshot.headerHeight, 370, accuracy: 0.5)
            for key in keys {
                let expected = try XCTUnwrap(baseline[key], "Missing 393-point geometry anchor: \(key)")
                let actual = try XCTUnwrap(snapshot.normalizedMeasuredFrames[key], "Missing scaled geometry anchor: \(key)")
                XCTAssertEqual(actual.midX, expected.midX, accuracy: 0.025, key)
                XCTAssertEqual(actual.minY, expected.minY, accuracy: 0.035, key)
            }
        }

        let expandedHeight = snapshots[1].headerHeight
        let controller = makeController(fixture)
        controller.renderForTesting(fixture.state)
        controller.setScrollOffsetForTesting(CGPoint(x: 0, y: 1_000))
        controller.view.layoutIfNeeded()
        XCTAssertEqual(expandedHeight, 370, accuracy: 0.5)
        XCTAssertEqual(controller.visualVerificationSnapshot.headerHeight, 100, accuracy: 0.5)
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

    func testEmptyAndPopulatedSectionStatesRemainProportional() {
        let empty = rendered(.newTripZeroActivities)
        XCTAssertEqual(empty.itineraryValue, "Empty")
        XCTAssertEqual(empty.importedItemsValue, "No imported items")
        XCTAssertEqual(empty.expensesValue, "No expenses recorded")

        let populated = rendered(.populatedSections)
        XCTAssertEqual(populated.itineraryValue, "7 activities")
        XCTAssertEqual(populated.importedItemsValue, "2 imported items")
        XCTAssertEqual(populated.expensesValue, "1 currency totals")
    }

    func testSingleAndMultiDayMetadataRemainTruthful() {
        XCTAssertTrue(rendered(.singleDayTrip).headerSummary?.contains("Aug 11") == true)
        XCTAssertFalse(rendered(.singleDayTrip).headerSummary?.contains("Sep 2") == true)
        XCTAssertTrue(rendered(.multipleCategories).headerSummary?.contains("Aug 11 → Sep 2") == true)
    }

    func testSmallAndLargePhoneDimensionsWithShortAndLongTitles() {
        let dimensions = [CGSize(width: 375, height: 667), CGSize(width: 430, height: 932)]
        for size in dimensions {
            for fixture in [NativeTripOverviewVisualFixture.oneActivity, .accessibilitySizeTypography] {
                let controller = makeController(fixture, size: size)
                controller.renderForTesting(fixture.state)
                controller.view.layoutIfNeeded()
                let snapshot = controller.visualVerificationSnapshot
                XCTAssertFalse(controller.view.hasAmbiguousLayout, "\(fixture.rawValue) at \(size)")
                XCTAssertEqual(snapshot.headerFrame.width, size.width, accuracy: 0.5)
                XCTAssertEqual(snapshot.contentFrame.width, size.width - 40, accuracy: 0.5)
                XCTAssertGreaterThan(snapshot.contentFrame.height, size.height)
            }
        }
    }

    func testHeaderControlsHaveFortyFourPointHitTargetsAndVoiceOverOrder() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 284))
        header.render(seed: .init(tripID: "a11y", title: "Barcelona", dateRange: "Aug 11 → Sep 2", imageURL: nil, fallbackColor: "#50343C"))
        header.layoutIfNeeded()

        XCTAssertTrue(header.controlMinimumHitTargets.allSatisfy { $0.width >= 44 && $0.height >= 44 })
        XCTAssertTrue(header.moreButton.point(inside: CGPoint(x: 2, y: 20), with: nil))
        XCTAssertEqual(
            Array(header.accessibilityReadingOrderLabels.prefix(4)),
            ["More trip options", "Search saved activities and documents", "Close trip overview", "Barcelona, Aug 11 → Sep 2"]
        )
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)
        header.updateTransition(progress: 0.49)
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)
        header.updateTransition(progress: 0.5)
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)
        header.updateTransition(progress: 1)
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)
        XCTAssertEqual(
            Array(header.accessibilityReadingOrderLabels.prefix(4)),
            ["More trip options", "Search saved activities and documents", "Close trip overview", "Barcelona, Aug 11 → Sep 2"]
        )
    }

    func testCountryFlagFollowsTripCountryAndCustomizationPreference() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 370))
        let trip = NativeTripOverview.Trip(
            id: "flag-trip", title: "New York City", destination: "New York City", countryCode: "us",
            startDate: "2026-08-01", endDate: "2026-08-07", dateRange: "Aug 1 → Aug 7",
            relativeTiming: "2 weeks ago", durationDays: 7, status: "past"
        )
        let hero = NativeTripOverview.Hero(
            imageURL: nil, alt: "New York City", attribution: nil, sourceLabel: nil, fallbackColor: "#4B4741"
        )

        header.render(hero: hero, trip: trip, stale: false)
        header.layoutIfNeeded()
        XCTAssertEqual(header.displayedFlag, "🇺🇸")
        XCTAssertTrue(header.isCountryFlagVisible)
        XCTAssertEqual(header.countryFlagFrame.size, CGSize(width: 52, height: 52))

        header.setShowsCountryFlag(false)
        XCTAssertFalse(header.isCountryFlagVisible)
        header.setShowsCountryFlag(true)
        XCTAssertTrue(header.isCountryFlagVisible)
    }

    func testCollapseKeepsControlsFixedAndMovesFirstCardWithScrollContent() throws {
        let fixture = NativeTripOverviewVisualFixture.multipleCategories
        let controller = makeController(fixture)
        controller.renderForTesting(fixture.state)
        controller.view.layoutIfNeeded()

        let expanded = controller.visualVerificationSnapshot
        let scrollDelta = (AlmidyDesignTokens.TripOverview.expandedHeaderHeight
            - AlmidyDesignTokens.TripOverview.compactHeaderHeight) / 2
        controller.setScrollOffsetForTesting(CGPoint(x: 0, y: scrollDelta))
        controller.view.layoutIfNeeded()
        let collapsing = controller.visualVerificationSnapshot

        for key in [
            "trip-overview-measure-header-more",
            "trip-overview-measure-header-search",
            "trip-overview-measure-header-close"
        ] {
            let before = try XCTUnwrap(expanded.measuredFrames[key])
            let after = try XCTUnwrap(collapsing.measuredFrames[key])
            XCTAssertEqual(after.origin.x, before.origin.x, accuracy: 0.5, key)
            XCTAssertEqual(after.origin.y, before.origin.y, accuracy: 0.5, key)
            XCTAssertEqual(after.size, before.size, key)
        }

        let firstCardBefore = try XCTUnwrap(expanded.measuredFrames["trip-overview-measure-itinerary-card"])
        let firstCardAfter = try XCTUnwrap(collapsing.measuredFrames["trip-overview-measure-itinerary-card"])
        let collapsedDownshift = AlmidyDesignTokens.TripOverview.CollapsedComposition
            .contentFlowDownshift(for: controller.view.bounds.width)
        let transition = NativeTripOverviewHeaderTransition(progress: 0.5, reduceMotion: false)
        XCTAssertEqual(
            firstCardAfter.minY,
            firstCardBefore.minY - scrollDelta + collapsedDownshift * transition.easedProgress,
            accuracy: 1,
            "The first card must travel with scroll content plus the intentional collapsed-composition downshift."
        )
        XCTAssertLessThan(collapsing.headerHeight, expanded.headerHeight)
        XCTAssertGreaterThan(collapsing.headerHeight, AlmidyDesignTokens.TripOverview.compactHeaderHeight)
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

    func testHeaderDoesNotExposeInternalDestinationResolverAsPhotoCredit() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 340))
        let fixture = NativeTripOverviewVisualFixture.newTripZeroActivities.overview
        let internalHero = NativeTripOverview.Hero(
            imageURL: fixture.hero.imageURL,
            alt: fixture.hero.alt,
            attribution: nil,
            sourceLabel: "native_destination_resolver",
            fallbackColor: fixture.hero.fallbackColor
        )

        header.render(hero: internalHero, trip: fixture.trip, stale: false)

        XCTAssertNil(header.displayedAttribution)
        XCTAssertFalse(header.activeSummaryAccessibilityLabel?.contains("native_destination_resolver") == true)
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

    func testRequestedContentDeviceAndDynamicTypeVerificationMatrix() throws {
        let dimensions = [
            CGSize(width: 375, height: 667),
            CGSize(width: 393, height: 852),
            CGSize(width: 430, height: 932)
        ]
        let contentFixtures: [NativeTripOverviewVisualFixture] = [
            .newTripZeroActivities, // empty itinerary, short title, multi-day
            .multipleCategories,    // populated itinerary, short title, multi-day
            .singleDayTrip,         // populated itinerary, short title, single-day
            .accessibilitySizeTypography // empty itinerary and long title
        ]

        for size in dimensions {
            for fixture in contentFixtures {
                let controller = makeController(fixture, size: size)
                controller.renderForTesting(fixture.state)
                controller.view.layoutIfNeeded()
                let snapshot = controller.visualVerificationSnapshot
                let frames = snapshot.measuredFrames

                XCTAssertFalse(controller.view.hasAmbiguousLayout, "\(fixture.rawValue) at \(size)")
                XCTAssertEqual(snapshot.headerFrame.width, size.width, accuracy: 0.5)
                XCTAssertNotNil(frames["trip-overview-measure-header-title"])
                XCTAssertNotNil(frames["trip-overview-measure-itinerary-card"])
                XCTAssertEqual(
                    snapshot.itineraryValue,
                    fixture == .newTripZeroActivities || fixture == .accessibilitySizeTypography ? "Empty" :
                        (fixture == .singleDayTrip ? "1 activity" : "7 activities")
                )
            }
        }

        for category in [UIContentSizeCategory.large, .accessibilityExtraExtraExtraLarge] {
            let controller = makeController(
                .accessibilitySizeTypography,
                contentSizeCategory: category
            )
            controller.renderForTesting(NativeTripOverviewVisualFixture.accessibilitySizeTypography.state)
            controller.view.layoutIfNeeded()
            XCTAssertFalse(controller.view.hasAmbiguousLayout, category.rawValue)
            XCTAssertNotNil(controller.visualVerificationSnapshot.headerSummary)
        }
    }

    func testExpandedMidpointAndCollapsedGeometryAcrossReferenceDevices() throws {
        let dimensions = [
            CGSize(width: 375, height: 667),
            CGSize(width: 393, height: 852),
            CGSize(width: 430, height: 932)
        ]
        let expanded = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        let compact = AlmidyDesignTokens.TripOverview.compactHeaderHeight
        let collapseDistance = expanded - compact

        for size in dimensions {
            let controller = makeController(.multipleCategories, size: size)
            controller.renderForTesting(NativeTripOverviewVisualFixture.multipleCategories.state)
            for (name, offset, expectedHeight) in [
                ("expanded", CGFloat(0), expanded),
                ("midpoint", collapseDistance / 2, (expanded + compact) / 2),
                ("collapsed", collapseDistance, compact)
            ] {
                controller.setScrollOffsetForTesting(CGPoint(x: 0, y: offset))
                controller.view.layoutIfNeeded()
                let snapshot = controller.visualVerificationSnapshot
                XCTAssertEqual(snapshot.headerHeight, expectedHeight, accuracy: 0.5, "\(name) at \(size)")
                XCTAssertEqual(snapshot.headerFrame.width, size.width, accuracy: 0.5, "\(name) at \(size)")
                XCTAssertNotNil(snapshot.headerSummary, "\(name) at \(size)")
            }
        }
    }

    func testCollapsedNumericGeometryPaletteAndContinuityContracts() throws {
        let size = CGSize(width: 393, height: 852)
        let fixture = NativeTripOverviewVisualFixture.newTripZeroActivities
        let hero = NativeTripOverviewVisualFixture.image(
            color: UIColor(red: 0.62, green: 0.43, blue: 0.28, alpha: 1)
        )
        let controller = makeController(fixture, seedImage: hero, size: size)
        controller.renderForTesting(fixture.state)
        controller.view.layoutIfNeeded()

        let expanded = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        let compact = AlmidyDesignTokens.TripOverview.compactHeaderHeight
        let collapseDistance = expanded - compact
        XCTAssertEqual(collapseDistance, 270, accuracy: 0.001)
        XCTAssertEqual((expanded + compact) / 2, 235, accuracy: 0.001)

        let expandedSnapshot = controller.visualVerificationSnapshot
        let expandedHeader = try XCTUnwrap(expandedSnapshot.measuredFrames["trip-overview-measure-header"])
        let expandedItinerary = try XCTUnwrap(expandedSnapshot.measuredFrames["trip-overview-measure-itinerary-card"])
        XCTAssertEqual(expandedHeader.minY, 0, accuracy: 0.5, "The sheet-owned header top must not move.")
        XCTAssertEqual(
            expandedItinerary.minY - expandedHeader.minY,
            AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline,
            accuracy: AlmidyDesignTokens.TripOverview.expandedItineraryTopTolerance
        )
        XCTAssertEqual(controller.customGrabberCountForVerification, 1)
        controller.controlMinimumHitTargetsForVerification.forEach { target in
            XCTAssertGreaterThanOrEqual(target.width, 44)
            XCTAssertGreaterThanOrEqual(target.height, 44)
        }

        var previousHeaderFrame = expandedHeader
        var previousActivityFrame = try XCTUnwrap(
            expandedSnapshot.measuredFrames["trip-overview-measure-empty-action-circle"]
        )
        let sampleCount = 20
        let maximumContinuousStep = (collapseDistance / CGFloat(sampleCount)) * 1.75
        for index in 1...sampleCount {
            let offset = collapseDistance * CGFloat(index) / CGFloat(sampleCount)
            controller.setScrollOffsetForTesting(CGPoint(x: 0, y: offset))
            controller.view.layoutIfNeeded()
            let snapshot = controller.visualVerificationSnapshot
            let header = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header"])
            let activity = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-empty-action-circle"])

            XCTAssertEqual(header.minY, expandedHeader.minY, accuracy: 0.5)
            XCTAssertLessThanOrEqual(header.height, previousHeaderFrame.height + 0.01)
            XCTAssertLessThanOrEqual(
                previousHeaderFrame.height - header.height,
                maximumContinuousStep,
                "Header transition frames must advance continuously without a height jump."
            )
            XCTAssertLessThanOrEqual(
                abs(activity.minY - previousActivityFrame.minY),
                maximumContinuousStep,
                "The activity composition must remain continuous during collapse."
            )
            previousHeaderFrame = header
            previousActivityFrame = activity
        }

        let collapsedSnapshot = controller.visualVerificationSnapshot
        let collapsedHeader = try XCTUnwrap(collapsedSnapshot.measuredFrames["trip-overview-measure-header"])
        let compactTitle = try XCTUnwrap(collapsedSnapshot.measuredFrames["trip-overview-measure-header-compact-title"])
        let compactDate = try XCTUnwrap(collapsedSnapshot.measuredFrames["trip-overview-measure-header-compact-date"])
        let collapsedItinerary = try XCTUnwrap(collapsedSnapshot.measuredFrames["trip-overview-measure-itinerary-card"])

        XCTAssertEqual(collapsedHeader.height, compact, accuracy: 0.5)
        XCTAssertEqual(compactTitle.midX, compactDate.midX, accuracy: 0.5)
        XCTAssertEqual(compactTitle.midX, collapsedHeader.midX, accuracy: 0.5)
        let approvedCollapsedItineraryTop = AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline
            - collapseDistance
            + AlmidyDesignTokens.TripOverview.CollapsedComposition.contentFlowDownshift
        XCTAssertEqual(approvedCollapsedItineraryTop, 267.7, accuracy: 0.01)
        XCTAssertEqual(
            collapsedItinerary.minY - collapsedHeader.minY,
            approvedCollapsedItineraryTop,
            accuracy: 2,
            "The collapsed Itinerary top must stay within two points of the approved baseline."
        )

        let activitySurface = try XCTUnwrap(controller.currentActivitySurfaceColor)
        XCTAssertTrue(activitySurface.isEqual(controller.currentSheetSurfaceColorForVerification))
        XCTAssertTrue(
            controller.isActivityRegionTransparentForVerification,
            "The activity region must inherit the unified overview surface instead of drawing a rectangular panel."
        )
        XCTAssertFalse(
            controller.currentCompactHeaderSurfaceColorForVerification.isEqual(activitySurface),
            "Compact-header and activity surfaces must keep their separate adaptive palette roles."
        )
    }

    func testCollapsedActivityAndItineraryMoveTogetherInNormalContentFlow() throws {
        let controller = makeController(.newTripZeroActivities, size: CGSize(width: 393, height: 852))
        controller.renderForTesting(NativeTripOverviewVisualFixture.newTripZeroActivities.state)
        controller.view.layoutIfNeeded()

        let expandedSnapshot = controller.visualVerificationSnapshot
        let expandedCircle = try XCTUnwrap(
            expandedSnapshot.measuredFrames["trip-overview-measure-empty-action-circle"]
        )
        let expandedItinerary = try XCTUnwrap(
            expandedSnapshot.measuredFrames["trip-overview-measure-itinerary-card"]
        )

        let collapseDistance = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
            - AlmidyDesignTokens.TripOverview.compactHeaderHeight
        controller.setScrollOffsetForTesting(CGPoint(x: 0, y: collapseDistance))
        controller.view.layoutIfNeeded()

        let collapsedSnapshot = controller.visualVerificationSnapshot
        let collapsedCircle = try XCTUnwrap(
            collapsedSnapshot.measuredFrames["trip-overview-measure-empty-action-circle"]
        )
        let collapsedItinerary = try XCTUnwrap(
            collapsedSnapshot.measuredFrames["trip-overview-measure-itinerary-card"]
        )
        let downshift = AlmidyDesignTokens.TripOverview.CollapsedComposition.contentFlowDownshift

        XCTAssertEqual(controller.currentHeroSpacerHeight, AlmidyDesignTokens.TripOverview.expandedHeaderHeight + downshift)
        XCTAssertEqual(collapsedCircle.minY - expandedCircle.minY, -collapseDistance + downshift, accuracy: 0.5)
        XCTAssertEqual(collapsedItinerary.minY - expandedItinerary.minY, -collapseDistance + downshift, accuracy: 0.5)
        XCTAssertEqual(
            collapsedItinerary.minY - collapsedCircle.minY,
            expandedItinerary.minY - expandedCircle.minY,
            accuracy: 0.5,
            "The activity group and first card must move as one content-flow composition."
        )
    }

    func testTitleAndItineraryMaintainReferenceProportionsAcrossWidths() throws {
        let dimensions = [
            CGSize(width: 375, height: 667),
            CGSize(width: 393, height: 852),
            CGSize(width: 430, height: 932)
        ]
        let snapshots = dimensions.map { size -> NativeTripOverviewVisualVerificationSnapshot in
            let controller = makeController(.newTripZeroActivities, size: size)
            controller.renderForTesting(NativeTripOverviewVisualFixture.newTripZeroActivities.state)
            controller.view.layoutIfNeeded()
            return controller.visualVerificationSnapshot
        }
        let baseline = snapshots[1]
        let baselineTitle = try XCTUnwrap(baseline.measuredFrames["trip-overview-measure-header-title"])
        let baselineItinerary = try XCTUnwrap(baseline.measuredFrames["trip-overview-measure-itinerary-card"])
        let titleRatio = baselineTitle.minY / baseline.headerFrame.height
        let itineraryRatio = baselineItinerary.minY / baseline.headerFrame.height

        for snapshot in snapshots {
            let title = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header-title"])
            let itinerary = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-itinerary-card"])
            XCTAssertEqual(title.minY / snapshot.headerFrame.height, titleRatio, accuracy: 0.035)
            XCTAssertEqual(itinerary.minY / snapshot.headerFrame.height, itineraryRatio, accuracy: 0.05)
            XCTAssertGreaterThan(itinerary.minY, snapshot.headerFrame.maxY)
        }
    }

    func testBrightAndDarkHeroesProduceVisualArtifactsAtEveryCollapseState() throws {
        let fixture = NativeTripOverviewVisualFixture.newTripZeroActivities
        let expanded = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        let compact = AlmidyDesignTokens.TripOverview.compactHeaderHeight
        let collapseDistance = expanded - compact
        let states: [(String, CGFloat)] = [
            ("expanded", 0),
            ("midpoint", collapseDistance / 2),
            ("collapsed", collapseDistance)
        ]

        for (heroName, hero) in [
            ("bright", NativeTripOverviewVisualFixture.image(color: .white)),
            ("dark", NativeTripOverviewVisualFixture.image(color: .black))
        ] {
            let controller = makeController(fixture, seedImage: hero)
            controller.renderForTesting(fixture.state)
            for (stateName, offset) in states {
                controller.setScrollOffsetForTesting(CGPoint(x: 0, y: offset))
                controller.view.layoutIfNeeded()
                let snapshot = controller.visualVerificationSnapshot
                let header = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header"])
                let image = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header-image-region"])
                let fade = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header-fade-region"])
                let grabber = try XCTUnwrap(snapshot.measuredFrames["trip-overview-measure-header-grabber"])

                XCTAssertEqual(image, header, "Hero must reach every sheet edge; a mismatch creates a white rim.")
                XCTAssertEqual(fade, header, "The fade must cover the hero completely without a boundary seam.")
                XCTAssertGreaterThan(grabber.width, 0)

                let rendered = UIGraphicsImageRenderer(bounds: controller.view.bounds).image { _ in
                    controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
                }
                let attachment = XCTAttachment(image: rendered)
                attachment.name = "TripOverview-hero-\(heroName)-\(stateName)-393x852"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
        }
    }

    func testCompleteTripOverviewVisualVerificationMatrix() throws {
        let dimensions = [
            CGSize(width: 375, height: 667),
            CGSize(width: 393, height: 852),
            CGSize(width: 430, height: 932)
        ]
        let scenarios: [(
            name: String,
            fixture: NativeTripOverviewVisualFixture,
            category: UIContentSizeCategory,
            hero: UIImage
        )] = [
            (
                "standard-short-populated-warm",
                .multipleCategories,
                .large,
                NativeTripOverviewVisualFixture.image(
                    color: UIColor(red: 0.64, green: 0.42, blue: 0.24, alpha: 1)
                )
            ),
            (
                "accessibility-long-empty-cool",
                .accessibilitySizeTypography,
                .accessibilityExtraExtraExtraLarge,
                NativeTripOverviewVisualFixture.image(
                    color: UIColor(red: 0.22, green: 0.43, blue: 0.62, alpha: 1)
                )
            )
        ]
        let states: [(name: String, progress: CGFloat)] = [
            ("expanded", 0),
            ("midpoint", 0.5),
            ("collapsed", 1)
        ]

        for size in dimensions {
            for scenario in scenarios {
                let controller = makeController(
                    scenario.fixture,
                    contentSizeCategory: scenario.category,
                    seedImage: scenario.hero,
                    size: size
                )
                controller.renderForTesting(scenario.fixture.state)
                controller.view.layoutIfNeeded()

                let expandedHeight = scenario.category.isAccessibilityCategory
                    ? AlmidyDesignTokens.TripOverview.accessibilityExpandedHeaderHeight
                    : AlmidyDesignTokens.TripOverview.expandedHeaderHeight
                let compactHeight = scenario.category.isAccessibilityCategory
                    ? AlmidyDesignTokens.TripOverview.accessibilityCompactHeaderHeight
                    : AlmidyDesignTokens.TripOverview.compactHeaderHeight
                let collapseDistance = expandedHeight - compactHeight
                var fixedControlFrames: [String: CGRect] = [:]
                var expandedCircleFrame: CGRect?
                var expandedItineraryFrame: CGRect?

                for state in states {
                    controller.setScrollOffsetForTesting(
                        CGPoint(x: 0, y: collapseDistance * state.progress)
                    )
                    controller.view.layoutIfNeeded()

                    let snapshot = controller.visualVerificationSnapshot
                    let frames = snapshot.measuredFrames
                    let header = try XCTUnwrap(frames["trip-overview-measure-header"])
                    let image = try XCTUnwrap(frames["trip-overview-measure-header-image-region"])
                    let fade = try XCTUnwrap(frames["trip-overview-measure-header-fade-region"])
                    let circle = frames["trip-overview-measure-empty-action-circle"]
                    let itinerary = try XCTUnwrap(frames["trip-overview-measure-itinerary-card"])

                    if scenario.fixture == .accessibilitySizeTypography {
                        XCTAssertNotNil(circle, "An empty itinerary must retain its Add First Activity control.")
                    } else {
                        XCTAssertNil(circle, "A populated itinerary must not expose the empty-state activity control.")
                        XCTAssertEqual(snapshot.actionKinds, [.newActivity, .places, .routes])
                    }

                    XCTAssertFalse(controller.view.hasAmbiguousLayout, "\(scenario.name), \(state.name), \(size)")
                    XCTAssertEqual(header.minY, 0, accuracy: 0.5)
                    XCTAssertEqual(header.width, size.width, accuracy: 0.5)
                    XCTAssertEqual(image, header, "Hero edges must remain flush with the header; otherwise a rim or seam appears.")
                    XCTAssertEqual(fade, header, "Fog must cover the complete hero through its terminal solid color.")
                    XCTAssertEqual(controller.customGrabberCountForVerification, 1)
                    XCTAssertEqual(controller.accessibleHeaderTitleCountForVerification, 1)
                    let accessibilityOrder = controller.headerAccessibilityReadingOrderForVerification
                    XCTAssertEqual(
                        Array(accessibilityOrder.prefix(3)),
                        ["More trip options", "Search saved activities and documents", "Close trip overview"]
                    )
                    let accessibleTitle = try XCTUnwrap(accessibilityOrder.dropFirst(3).first)
                    XCTAssertTrue(accessibleTitle.contains(scenario.fixture.overview.trip.destination))
                    XCTAssertTrue(accessibleTitle.contains(scenario.fixture.overview.trip.dateRange))
                    if state.progress == 0, let relativeTiming = scenario.fixture.overview.trip.relativeTiming {
                        XCTAssertTrue(accessibleTitle.contains(relativeTiming))
                    }

                    for key in [
                        "trip-overview-measure-header-more",
                        "trip-overview-measure-header-search",
                        "trip-overview-measure-header-close"
                    ] {
                        let frame = try XCTUnwrap(frames[key])
                        if state.progress == 0 {
                            fixedControlFrames[key] = frame
                        } else {
                            XCTAssertEqual(frame, fixedControlFrames[key], "Header controls must not drift while scrolling.")
                        }
                    }

                    if state.progress == 0 {
                        XCTAssertGreaterThan(controller.expandedHeaderContentAlphaForVerification, 0.99)
                        XCTAssertLessThan(controller.compactHeaderContentAlphaForVerification, 0.01)
                        expandedCircleFrame = circle
                        expandedItineraryFrame = itinerary
                        if !scenario.category.isAccessibilityCategory {
                            XCTAssertEqual(
                                itinerary.minY - header.minY,
                                AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline,
                                accuracy: 2,
                                "Expanded Itinerary must remain within six reference pixels."
                            )
                        }
                    } else if state.progress == 0.5 {
                        XCTAssertGreaterThan(controller.expandedHeaderContentAlphaForVerification, 0)
                        XCTAssertGreaterThan(controller.compactHeaderContentAlphaForVerification, 0)
                    } else {
                        XCTAssertLessThan(controller.expandedHeaderContentAlphaForVerification, 0.01)
                        XCTAssertGreaterThan(controller.compactHeaderContentAlphaForVerification, 0.99)
                        if !scenario.category.isAccessibilityCategory {
                            let expectedItineraryTop = AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline
                                - collapseDistance
                                + AlmidyDesignTokens.TripOverview.CollapsedComposition.contentFlowDownshift(for: size.width)
                            XCTAssertEqual(
                                itinerary.minY - header.minY,
                                expectedItineraryTop,
                                accuracy: 2,
                                "Collapsed Itinerary must remain within six reference pixels."
                            )
                        }
                    }

                    if let circle, let expandedCircleFrame {
                        let expectedMovement = -(collapseDistance * state.progress)
                            + (AlmidyDesignTokens.TripOverview.CollapsedComposition.contentFlowDownshift(for: size.width) * state.progress)
                        XCTAssertEqual(circle.minY - expandedCircleFrame.minY, expectedMovement, accuracy: 2)
                    }
                    if let expandedItineraryFrame {
                        let expectedMovement = -(collapseDistance * state.progress)
                            + (AlmidyDesignTokens.TripOverview.CollapsedComposition.contentFlowDownshift(for: size.width) * state.progress)
                        XCTAssertEqual(itinerary.minY - expandedItineraryFrame.minY, expectedMovement, accuracy: 2)
                    }

                    let rendered = UIGraphicsImageRenderer(bounds: controller.view.bounds).image { context in
                        controller.view.layer.render(in: context.cgContext)
                    }
                    let attachment = XCTAttachment(image: rendered)
                    attachment.name = "TripOverview-visual-\(Int(size.width))x\(Int(size.height))-\(scenario.name)-\(state.name)"
                    attachment.lifetime = .keepAlways
                    add(attachment)
                }
            }
        }
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
        seedImage: UIImage? = nil,
        size: CGSize = CGSize(width: 393, height: 852)
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
        controller.view.frame = CGRect(origin: .zero, size: size)
        let category = contentSizeCategory ?? fixture.contentSizeCategory
        if contentSizeCategory != nil {
            let parent = UIViewController()
            parent.loadViewIfNeeded()
            parent.view.frame = CGRect(origin: .zero, size: size)
            parent.addChild(controller)
            parent.setOverrideTraitCollection(UITraitCollection(preferredContentSizeCategory: category), forChild: controller)
            parent.view.addSubview(controller.view)
            controller.didMove(toParent: parent)
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
