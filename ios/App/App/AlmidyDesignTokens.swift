import UIKit

/// Native Almidy visual language. Keep product behavior in the controllers; keep visual decisions here.
enum AlmidyDesignTokens {
    /// Almidy currently presents a light branded planning surface with selected
    /// adaptive UIKit utilities. This is an explicit compatibility contract,
    /// not a complete native Dark Mode definition.
    static let appearanceContract = "light-branded-planning-surface"

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

        // Semantic foundation. These aliases preserve the existing pixels while
        // allowing new components to describe intent instead of legacy names.
        static let accent = brandGold
        static let accentPressed = brandGoldDeep
        static let accentText = brandGoldText
        static let canvas = bgLight
        static let canvasGrouped = bgLightMist
        static let surfaceNeutral = bgLightMist
        static let dividerSubtle = UIColor.black.withAlphaComponent(0.08)
        static let borderStrong = UIColor.black.withAlphaComponent(0.12)
        static let stateDisabledFill = UIColor.black.withAlphaComponent(0.06)
        static let stateDisabledText = UIColor.black.withAlphaComponent(0.38)
        static let onMediaPrimary = UIColor.white
        static let onMediaSecondary = UIColor.white.withAlphaComponent(0.92)
        static let onMediaTertiary = UIColor.white.withAlphaComponent(0.82)
        static let overlayScrim = UIColor.black.withAlphaComponent(0.48)

        // Active semantic aliases. They intentionally retain separate names so
        // future appearance work can evolve roles without feature churn.
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
        // Input roles replace the obsolete darkInput compatibility vocabulary.
        // Their fixed values are unchanged; Dark Mode is not introduced here.
        static let inputSurface = UIColor(hex: 0xF5F5F7)
        static let inputBorder = UIColor.black.withAlphaComponent(0.12)
        static let inputPlaceholder = UIColor.black.withAlphaComponent(0.44)

        // Active semantic gold aliases: identical raw values, distinct usage roles.
        // Champagne gold signals elevated action and progress without reading as warning orange.
        static let gold = brandGold
        static let goldDeep = brandGoldDeep
        static let goldDark = brandGoldText
        static let goldMuted = UIColor(hex: 0x9F8857)
        static let goldMutedSurface = UIColor(hex: 0xF2EBDD)
        static let accentMuted = goldMuted
        static let accentMutedSurface = goldMutedSurface
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
    }

    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let nativeContent: CGFloat = 20
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
        static let sheetContentInset = nativeContent
    }

    enum Radius {
        static let small: CGFloat = 8
        static let field: CGFloat = 12
        static let sheet: CGFloat = 36
        static let card: CGFloat = 24
        static let control: CGFloat = 18
        static let cardLarge: CGFloat = 28
        static let sheetUtility: CGFloat = 28
        static let sheetEditor: CGFloat = 34
        static let sheetProminent: CGFloat = 36
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
            static let outerHorizontalInset: CGFloat = 15
            static let cardCornerRadius: CGFloat = 28
            // The compact action block is slightly taller than the expanded
            // block, preserving the reference's breathing room before the card.
            static let activityRegionHeight: CGFloat = 124
            static let activityCircleDiameter: CGFloat = 70
            static let activityCircleToLabelGap: CGFloat = 2
            static let itineraryTopBaseline: CGFloat = 209.3
            // Pull the activity group up beneath the compact header. A negative
            // value is intentional: the compact header occupies much less visual
            // depth than the expanded destination hero.
            static let contentFlowDownshift: CGFloat = -22

            static func contentFlowDownshift(for sheetWidth: CGFloat) -> CGFloat {
                contentFlowDownshift * sheetWidth / 393
            }
        }

        // The expanded hero and action region share a measured composition budget.
        // Preserve the tall photographic composition from the approved
        // reference. Scroll presentation moves this content; the resting layout
        // must not pre-collapse the destination, action, and first card.
        static let expandedHeaderHeight: CGFloat = 370
        static let accessibilityExpandedHeaderHeight: CGFloat = 446
        static let compactHeaderHeight: CGFloat = 100
        static let accessibilityCompactHeaderHeight: CGFloat = 128
        static let headerControlDiameter: CGFloat = 48
        static let headerControlSideInset: CGFloat = 20
        static let headerControlGap: CGFloat = 12
        // The expanded and collapsed references share the same comfortable
        // toolbar inset beneath the sheet's rounded top and grabber.
        static let headerControlTopInset: CGFloat = 14
        // Bottom anchoring makes long destinations grow upward while preserving
        // the reference block position established by the expanded composition.
        static let destinationBlockBottomInset: CGFloat = 14
        static let countryFlagDiameter: CGFloat = 52
        static let countryFlagFont = Font.body(30)
        static let countryFlagBorderWidth: CGFloat = 1.5
        static let countryFlagTitleGap: CGFloat = 10
        static let emptyActionTopInset: CGFloat = 15
        static let emptyActionCircleDiameter: CGFloat = 72
        static let emptyActionIconDiameter: CGFloat = 34
        static let emptyActionLabelGap: CGFloat = 3
        static let emptyActionBottomInset: CGFloat = 2
        static let populatedActionCircleDiameter: CGFloat = 64
        static let populatedActionMinimumTarget: CGFloat = 60
        static let populatedActionIconDiameter: CGFloat = 29
        static let populatedActionLabelGap: CGFloat = 8
        // Measured from the sheet's rounded top to the first card in the resting
        // reference composition.
        static let expandedItineraryTopBaseline: CGFloat = 502.7
        // Four pixels at the reference capture's 3x scale.
        static let expandedItineraryTopTolerance: CGFloat = 4 / 3
        static let expandedActionRegionHeight: CGFloat =
            expandedItineraryTopBaseline - expandedHeaderHeight - interCardGap
        static let minimumInteractiveTarget: CGFloat = 44
        static let outerHorizontalInset: CGFloat = 20
        static let cardCornerRadius: CGFloat = 28
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
        static let headingFont = Font.title(17)
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
        static let importedItemsContentGap: CGFloat = cardContentGap
        static let importedItemsHeaderHeight: CGFloat = headerHeight
        static let importedItemsHeaderIconSurface: CGFloat = headerIconSurface
        static let importedItemsHeaderIcon: CGFloat = headerIcon
        static let importedItemsHeadingFont = headingFont
        static let importedItemsBodyFont = bodyFont
        static let importedItemsBodyMaximumWidth: CGFloat = 272
        static let importedItemsBodyLineSpacing: CGFloat = 1
        static let importedItemsEmptyContentGap: CGFloat = cardContentGap
        static let importedItemsIconClusterDiameter: CGFloat = 36
        static let importedItemsIconClusterIcon: CGFloat = 18
        static let importedItemsIconClusterOverlap: CGFloat = -5
        static let importedItemsIconRowHeight: CGFloat = 44
        static let importedItemsEmptyMinimumHeight: CGFloat = 276
        static let expensesCardVerticalInset: CGFloat = importedItemsCardVerticalInset
        static let expensesContentGap: CGFloat = importedItemsContentGap
        static let expensesHeaderHeight: CGFloat = importedItemsHeaderHeight
        static let expensesHeaderIconSurface: CGFloat = importedItemsHeaderIconSurface
        static let expensesHeaderIcon: CGFloat = importedItemsHeaderIcon
        static let expensesHeadingFont = importedItemsHeadingFont
        static let expensesBodyFont = importedItemsBodyFont
        static let expensesBodyMaximumWidth: CGFloat = 280
        static let expensesBodyLineSpacing: CGFloat = importedItemsBodyLineSpacing
        static let expensesEmptyContentGap: CGFloat = importedItemsEmptyContentGap
        static let expensesIconClusterDiameter: CGFloat = importedItemsIconClusterDiameter
        static let expensesIconClusterIcon: CGFloat = importedItemsIconClusterIcon
        static let expensesIconClusterOverlap: CGFloat = importedItemsIconClusterOverlap
        static let expensesIconRowHeight: CGFloat = importedItemsIconRowHeight
        static let expensesEmptyMinimumHeight: CGFloat = 276
        static let utilityCardVerticalInset: CGFloat = 12
        static let utilityCardContentGap: CGFloat = cardContentGap
        static let utilityCardIcon: CGFloat = headerIconSurface
        static let utilityCardMinimumHeight: CGFloat = 136
        static let separatorInset: CGFloat = 0
        static let bottomBreathingRoom: CGFloat = 40
    }

    enum Font {
        static func display(_ size: CGFloat) -> UIFont { Typography.Face.regular.font(ofSize: size) }
        static func title(_ size: CGFloat) -> UIFont { Typography.Face.medium.font(ofSize: size) }
        static func section(_ size: CGFloat) -> UIFont { Typography.Face.medium.font(ofSize: size) }
        static func body(_ size: CGFloat) -> UIFont { Typography.Face.regular.font(ofSize: size) }
        static func button(_ size: CGFloat) -> UIFont { Typography.Face.medium.font(ofSize: size) }
        static func semibold(_ size: CGFloat) -> UIFont { Typography.Face.semibold.font(ofSize: size) }
        static func bold(_ size: CGFloat) -> UIFont { Typography.Face.bold.font(ofSize: size) }
        static func font(_ size: CGFloat, weight: UIFont.Weight) -> UIFont {
            if weight >= .bold { return bold(size) }
            if weight >= .semibold { return semibold(size) }
            if weight >= .medium { return title(size) }
            return body(size)
        }
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
