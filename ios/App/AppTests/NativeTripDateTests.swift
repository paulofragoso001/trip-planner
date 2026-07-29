import XCTest
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
