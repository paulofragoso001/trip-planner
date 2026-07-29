import Foundation

struct NativeTripDateRange: Equatable {
    let startDate: Date
    let endDate: Date

    init?(startDate: Date?, endDate: Date?, calendar: Calendar = NativeTripDateFormatting.calendar) {
        guard let startDate, let endDate else { return nil }
        let start = calendar.startOfDay(for: startDate)
        let end = calendar.startOfDay(for: endDate)
        guard start <= end else { return nil }
        self.startDate = start
        self.endDate = end
    }

    init?(startDate: Date, endDate: Date, calendar: Calendar = NativeTripDateFormatting.calendar) {
        self.init(startDate: Optional(startDate), endDate: Optional(endDate), calendar: calendar)
    }

    var inclusiveDayCount: Int {
        let difference = NativeTripDateFormatting.calendar.dateComponents(
            [.day],
            from: startDate,
            to: endDate
        ).day ?? 0
        return max(difference + 1, 1)
    }

    var apiStartDate: String {
        NativeTripDateFormatting.apiString(from: startDate)
    }

    var apiEndDate: String {
        NativeTripDateFormatting.apiString(from: endDate)
    }
}
