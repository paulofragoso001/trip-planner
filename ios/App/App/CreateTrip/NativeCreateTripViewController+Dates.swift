import UIKit

final class NativeCreateTripDateContext {
    var startDate: Date?
    var endDate: Date?
    let durationLabel = UILabel()
    let summaryLabel = UILabel()
    var button: UIButton?

    init(existingTrip: NativeMapTrip?) {
        startDate = existingTrip?.startDate.flatMap(NativeTripDateFormatting.date)
        endDate = existingTrip?.endDate.flatMap(NativeTripDateFormatting.date)
    }
}

extension NativeCreateTripViewController {
    func configureDatePresentation() {
        let context = dateContext
        context.durationLabel.font = AlmidyDesignTokens.Font.body(17)
        context.durationLabel.textColor = AlmidyDesignTokens.Color.tripCardTextSecondary
        context.durationLabel.textAlignment = .center
        context.durationLabel.accessibilityLabel = "Trip duration"
        context.durationLabel.isHidden = true

        context.summaryLabel.font = AlmidyDesignTokens.Font.button(18)
        context.summaryLabel.textColor = .white
        context.summaryLabel.textAlignment = .center
        context.summaryLabel.numberOfLines = 0
        context.summaryLabel.accessibilityLabel = "Trip dates"

        let button = makeFeaturedOptionButton(
            title: "Set Dates",
            systemName: "calendar",
            action: #selector(setDates)
        )
        button.accessibilityLabel = "Set trip dates"
        context.button = button
        updateDateLabel()
    }

    func updateDateLabel() {
        let context = dateContext
        guard let selectedStartDate = context.startDate else {
            context.durationLabel.text = nil
            context.durationLabel.isHidden = true
            context.summaryLabel.text = "No date set"
            context.button?.configuration?.title = "Set Dates"
            context.button?.accessibilityLabel = "Set trip dates"
            return
        }
        let start = NativeTripDateFormatting.displayString(from: selectedStartDate)
        guard let selectedEndDate = context.endDate,
              !Calendar.current.isDate(selectedStartDate, inSameDayAs: selectedEndDate) else {
            context.durationLabel.text = "1 day"
            context.durationLabel.isHidden = false
            context.summaryLabel.text = start
            context.button?.configuration?.title = "Change Dates"
            context.button?.accessibilityLabel = "Change trip dates"
            return
        }
        let dayDifference = Calendar.current.dateComponents(
            [.day],
            from: Calendar.current.startOfDay(for: selectedStartDate),
            to: Calendar.current.startOfDay(for: selectedEndDate)
        ).day ?? 0
        let inclusiveDays = max(dayDifference + 1, 1)
        context.durationLabel.text = "\(inclusiveDays) days"
        context.durationLabel.isHidden = false
        context.summaryLabel.text = "\(start) → \(NativeTripDateFormatting.displayString(from: selectedEndDate))"
        context.button?.configuration?.title = "Change Dates"
        context.button?.accessibilityLabel = "Change trip dates"
    }

    @objc func setDates() {
        let controller = NativeTripDatesViewController(
            startDate: dateContext.startDate,
            endDate: dateContext.endDate
        ) { [weak self] start, end in
            self?.dateContext.startDate = start
            self?.dateContext.endDate = end
            self?.updateDateLabel()
        }
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.selectedDetentIdentifier = .large
            sheet.prefersGrabberVisible = true
        }
        present(controller, animated: true)
    }

    func submissionDateValues() -> (startDate: String?, endDate: String?) {
        let range = NativeTripDateRange(
            startDate: dateContext.startDate,
            endDate: dateContext.endDate
        )
        return (range?.apiStartDate, range?.apiEndDate)
    }
}
