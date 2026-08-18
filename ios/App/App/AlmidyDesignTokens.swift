import UIKit

/// Native Almidy visual language. Keep product behavior in the controllers; keep visual decisions here.
enum AlmidyDesignTokens {
    enum Color {
        // Canonical values: design-system/almidy.tokens.json.
        static let brandGold = UIColor(hex: 0xD6A84F)
        static let brandGoldDeep = UIColor(hex: 0xB88A2E)
        static let brandGoldText = UIColor(hex: 0x8C641E)
        static let bgLight = UIColor(hex: 0xFFFFFF)
        static let bgLightMist = UIColor(hex: 0xF2F3F6)
        static let canonicalTextPrimary = UIColor(hex: 0x050505)
        static let canonicalTextSecondary = UIColor(hex: 0x7D7D84)
        static let borderSubtle = UIColor.black.withAlphaComponent(0.10)

        // Native sheets use the same airy white-and-mist foundation as Settings.
        static let background = bgLight
        static let surface = bgLight
        static let card = bgLightMist
        static let line = borderSubtle
        static let textPrimary = canonicalTextPrimary
        static let textSecondary = canonicalTextSecondary
        static let textTertiary = UIColor(hex: 0xA2A2A8)
        static let overviewMetadata = UIColor { traits in
            traits.accessibilityContrast == .high ? UIColor(hex: 0x4A4A50) : canonicalTextSecondary
        }
        static let darkInput = UIColor(hex: 0xF5F5F7)
        static let darkInputBorder = UIColor.black.withAlphaComponent(0.12)
        static let darkPlaceholder = UIColor.black.withAlphaComponent(0.44)
        static let disabledActionBackground = UIColor.black.withAlphaComponent(0.06)
        static let disabledActionText = UIColor.black.withAlphaComponent(0.38)
        static let disabledActionBorder = UIColor.black.withAlphaComponent(0.12)

        // Champagne gold signals elevated action and progress without reading as warning orange.
        static let gold = brandGold
        static let goldDeep = brandGoldDeep
        static let goldDark = brandGoldText
        static let goldMuted = UIColor(hex: 0x9F8857)
        static let goldMutedSurface = UIColor(hex: 0xF2EBDD)
        // Text accents sit on light surfaces, so use the contrast-safe dark gold.
        static let goldSoft = goldDark

        // Settings is intentionally light and uses the darker gold variants for contrast.
        static let settingsBackground = bgLightMist
        static let settingsCard = bgLight
        static let settingsText = canonicalTextPrimary
        static let settingsSecondary = UIColor(hex: 0x8B8B92)
        static let settingsLine = UIColor.black.withAlphaComponent(0.08)
        static let settingsGold = goldDark
        static let settingsIcon = goldDark
        static let settingsRowBackground = settingsCard
        static let searchEmptyState = textSecondary

        static let success = UIColor(hex: 0x3C8F5A)
        static let danger = UIColor(hex: 0xC2413A)
        static let info = UIColor(hex: 0x6D86A8)
        static let mapSurface = UIColor(hex: 0x030406)

        // Native map and generated imagery retain their existing depth while sharing semantic roles.
        static let offlineGlobeTint = UIColor(red: 0.30, green: 0.66, blue: 0.92, alpha: 1)
        static let generatedTripImageBase = UIColor(red: 0.09, green: 0.20, blue: 0.28, alpha: 1)
        static let generatedTripGradientStart = UIColor(red: 0.08, green: 0.38, blue: 0.48, alpha: 1)
        static let generatedTripGradientEnd = UIColor(red: 0.88, green: 0.38, blue: 0.18, alpha: 1)
        static let tripCardGradientStart = UIColor.clear
        static let tripCardGradientEnd = UIColor.black.withAlphaComponent(0.78)
        static let tripCardTextPrimary = UIColor.white
        static let tripCardTextSecondary = UIColor.white.withAlphaComponent(0.92)
        static let tripCardTextTertiary = UIColor.white.withAlphaComponent(0.82)
        static let tripOverviewMetadataPrimary = UIColor { traits in
            UIColor.white.withAlphaComponent(traits.accessibilityContrast == .high ? 0.94 : 0.82)
        }
        static let tripOverviewMetadataSecondary = UIColor { traits in
            UIColor.white.withAlphaComponent(traits.accessibilityContrast == .high ? 0.88 : 0.74)
        }
        // Populated-trip actions stay subordinate to the destination hero.
        static let tripOverviewActionSurface = UIColor(hex: 0xC9B989)
        static let tripOverviewActionIcon = UIColor(hex: 0x76531A)
        static let tripOverviewActionLabel = UIColor { traits in
            UIColor.white.withAlphaComponent(traits.accessibilityContrast == .high ? 0.90 : 0.72)
        }
        // Product decision: Trip Overview follows Almidy's established muted-gold
        // native palette. The bright orange in the visual reference is not a new
        // semantic action color and must not override the product brand tokens.
        static let tripOverviewAccent = goldMuted
        static let tripOverviewAccentSurface = goldMutedSurface
        static let tripOverviewNeutralText = UIColor(hex: 0x8E8E93)
        static let tripOverviewNeutralIcon = UIColor(hex: 0x929297)
        static let tripOverviewNeutralSurface = UIColor(hex: 0xF3F3F5)
        static let tripOverviewDivider = UIColor(hex: 0xE7E7EA)

        // Decorative account surfaces are intentionally pastel and are not provider-brand colors.
        static let avatarRoseSurface = UIColor(red: 1.00, green: 0.84, blue: 0.85, alpha: 1)
        static let avatarPeachSurface = UIColor(red: 1.00, green: 0.87, blue: 0.80, alpha: 1)
        static let avatarLavenderSurface = UIColor(red: 0.96, green: 0.79, blue: 0.94, alpha: 1)

        static let modalDimmingBackground = UIColor.black.withAlphaComponent(0.48)
        static let overlayPlaceholderText = UIColor.white.withAlphaComponent(0.45)
        static let shadowBlack = UIColor.black
        static let shadowSoft = UIColor.black.withAlphaComponent(0.12)

        // Compatibility aliases: existing visual call sites can migrate without changing behavior.
        static let brandOrange = gold
        static let brandOrangeStrong = goldDeep
        static let authSurface = surface
        static let walletSurface = surface
        static let borderSoft = line
    }

    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
        static let content = lg
        static let safeTop: CGFloat = 14
        static let safeBottom = lg
        static let section = xl
        static let cardPadding = md
        static let elementGap = sm
        static let contentInset = lg
    }

    enum Radius {
        static let sheet: CGFloat = 36
        static let card: CGFloat = 24
        static let control: CGFloat = 18
        static let capsule: CGFloat = 999
    }

    enum TripOverview {
        static let sheetCornerRadius: CGFloat = 34

        /// Geometry for the fully collapsed Trip Overview composition.
        ///
        /// These values are normalized from the approved 393-point reference and
        /// intentionally do not alias the expanded hero/action constants below.
        /// Keeping the two contracts separate lets the collapse transition
        /// interpolate between independently measurable compositions.
        enum CollapsedComposition {
            static let compactHeaderVisualHeight: CGFloat = 98
            static let grabberTopInset: CGFloat = 7.5
            static let controlDiameter: CGFloat = 43
            static let controlSideInset: CGFloat = 18
            static let controlTopInset: CGFloat = 14
            static let titleDateSpacing: CGFloat = 1
            static let activityRegionHeight: CGFloat = 93.3
            static let activityCircleDiameter: CGFloat = 64
            static let activityCircleToLabelGap: CGFloat = 2
            static let itineraryTopBaseline: CGFloat = 209.3
            // Moves the entire activity-to-Itinerary flow at the collapsed
            // endpoint. At 3x this is 105 screenshot pixels.
            static let contentFlowDownshift: CGFloat = 35

            static func contentFlowDownshift(for sheetWidth: CGFloat) -> CGFloat {
                contentFlowDownshift * sheetWidth / 393
            }
        }

        // The expanded hero and action region share a measured composition budget.
        static let expandedHeaderHeight: CGFloat = 370
        static let accessibilityExpandedHeaderHeight: CGFloat = 446
        static let compactHeaderHeight: CGFloat = 100
        static let accessibilityCompactHeaderHeight: CGFloat = 128
        static let headerControlDiameter: CGFloat = 48
        static let headerControlSideInset: CGFloat = 20
        static let headerControlGap: CGFloat = 12
        static let headerControlTopInset: CGFloat = 6
        // Bottom anchoring makes long destinations grow upward while preserving
        // the reference block position established by the expanded composition.
        static let destinationBlockBottomInset: CGFloat = 14
        static let emptyActionTopInset: CGFloat = 15
        static let emptyActionCircleDiameter: CGFloat = 72
        static let emptyActionIconDiameter: CGFloat = 34
        static let emptyActionLabelGap: CGFloat = 3
        static let emptyActionBottomInset: CGFloat = 2
        // Updated from the 440pt / 3x comparison to move the activity group and
        // Itinerary upward by 12pt while preserving the destination block frame.
        static let expandedItineraryTopBaseline: CGFloat = 502.7
        // Four pixels at the reference capture's 3x scale.
        static let expandedItineraryTopTolerance: CGFloat = 4 / 3
        static let expandedActionRegionHeight: CGFloat =
            expandedItineraryTopBaseline - expandedHeaderHeight - interCardGap
        static let minimumInteractiveTarget: CGFloat = 44
        static let outerHorizontalInset: CGFloat = 20
        static let cardCornerRadius: CGFloat = 20
        static let cardHorizontalInset: CGFloat = 16
        static let cardVerticalInset: CGFloat = 14
        static let compactCardVerticalInset: CGFloat = 10
        static let interCardGap: CGFloat = 18
        static let cardContentGap: CGFloat = 8
        static let headerHeight: CGFloat = 40
        static let headerIconSurface: CGFloat = 32
        static let headerIcon: CGFloat = 16
        static let headerTitleGap: CGFloat = 10
        static let headerMetadataGap: CGFloat = 8
        static let headingFont = Font.medium(17)
        static let bodyFont = Font.body(15)
        static let metadataFont = Font.body(13)
        static let captionFont = Font.body(12)
        static let actionFont = Font.semibold(15)
        static let iconClusterDiameter: CGFloat = 40
        static let iconClusterIcon: CGFloat = 20
        static let iconClusterOverlap: CGFloat = -6
        static let itineraryCardVerticalInset: CGFloat = 8
        static let itineraryContentGap: CGFloat = 6
        static let itineraryRowHeight: CGFloat = 40
        static let itineraryTimelineConnectorHeight: CGFloat = 14
        static let itineraryTimelineConnectorWidth: CGFloat = 2
        static let importedItemsCardVerticalInset: CGFloat = 10
        static let importedItemsContentGap: CGFloat = 6
        static let importedItemsHeaderHeight: CGFloat = 36
        static let importedItemsHeaderIconSurface: CGFloat = 28
        static let importedItemsHeaderIcon: CGFloat = 14
        static let importedItemsHeadingFont = Font.medium(16)
        static let importedItemsBodyFont = Font.body(14)
        static let importedItemsBodyMaximumWidth: CGFloat = 272
        static let importedItemsBodyLineSpacing: CGFloat = 1
        static let importedItemsIconClusterDiameter: CGFloat = 36
        static let importedItemsIconClusterIcon: CGFloat = 18
        static let importedItemsIconClusterOverlap: CGFloat = -5
        static let importedItemsIconRowHeight: CGFloat = 44
        static let expensesCardVerticalInset: CGFloat = importedItemsCardVerticalInset
        static let expensesContentGap: CGFloat = importedItemsContentGap
        static let expensesHeaderHeight: CGFloat = importedItemsHeaderHeight
        static let expensesHeaderIconSurface: CGFloat = importedItemsHeaderIconSurface
        static let expensesHeaderIcon: CGFloat = importedItemsHeaderIcon
        static let expensesHeadingFont = importedItemsHeadingFont
        static let expensesBodyFont = importedItemsBodyFont
        static let expensesBodyMaximumWidth: CGFloat = 280
        static let expensesBodyLineSpacing: CGFloat = importedItemsBodyLineSpacing
        static let expensesIconClusterDiameter: CGFloat = importedItemsIconClusterDiameter
        static let expensesIconClusterIcon: CGFloat = importedItemsIconClusterIcon
        static let expensesIconClusterOverlap: CGFloat = importedItemsIconClusterOverlap
        static let expensesIconRowHeight: CGFloat = importedItemsIconRowHeight
        static let separatorInset: CGFloat = 0
        static let bottomBreathingRoom: CGFloat = 40
    }

    enum Control {
        static let buttonHeight: CGFloat = 60
        static let compactButtonHeight: CGFloat = 48
        static let iconButton: CGFloat = 56
        static let mapControl: CGFloat = 56
    }

    enum Shadow {
        static let opacity: Float = 0.22
        static let radius: CGFloat = 22
        static let offset = CGSize(width: 0, height: -8)
    }

    enum Font {
        static func display(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .regular) }
        static func title(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func section(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func body(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .regular) }
        static func button(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .medium) }
        static func semibold(_ size: CGFloat) -> UIFont { .systemFont(ofSize: size, weight: .semibold) }
        static func regular(_ size: CGFloat) -> UIFont { body(size) }
        static func medium(_ size: CGFloat) -> UIFont { title(size) }
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
