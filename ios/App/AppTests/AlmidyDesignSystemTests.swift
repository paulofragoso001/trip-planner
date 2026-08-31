import XCTest
import UIKit
@testable import Almidy

final class AlmidyDesignSystemTests: XCTestCase {
    func testInstrumentSansRequiredFacesResolveWithoutFallback() {
        let expected = [
            "InstrumentSans-Regular",
            "InstrumentSans-Medium",
            "InstrumentSans-SemiBold",
            "InstrumentSans-Bold"
        ]
        XCTAssertEqual(AlmidyDesignTokens.Typography.Face.allCases.map(\.rawValue), expected)
        for face in AlmidyDesignTokens.Typography.Face.allCases {
            let font = face.font(ofSize: 17)
            XCTAssertEqual(font.fontName, face.rawValue, "Missing or incorrectly registered face: \(face.rawValue)")
            XCTAssertEqual(font.familyName, "Instrument Sans")
        }
    }

    func testSemanticTypographyUsesInstrumentSansWeightMapping() {
        XCTAssertEqual(AlmidyDesignTokens.Typography.displayHero.baseFont.fontName, "InstrumentSans-Regular")
        XCTAssertEqual(AlmidyDesignTokens.Typography.body.baseFont.fontName, "InstrumentSans-Regular")
        XCTAssertEqual(AlmidyDesignTokens.Font.title(17).fontName, "InstrumentSans-Medium")
        XCTAssertEqual(AlmidyDesignTokens.Typography.cardTitle.baseFont.fontName, "InstrumentSans-SemiBold")
        XCTAssertEqual(AlmidyDesignTokens.Typography.badge.baseFont.fontName, "InstrumentSans-Bold")
    }

    func testInstrumentSansSemanticRoleBaseSizesRemainFrozen() {
        let roles: [(AlmidyDesignTokens.Typography.Style, CGFloat)] = [
            (AlmidyDesignTokens.Typography.displayHero, 52),
            (AlmidyDesignTokens.Typography.screenTitle, 24),
            (AlmidyDesignTokens.Typography.sheetTitle, 22),
            (AlmidyDesignTokens.Typography.sectionTitle, 20),
            (AlmidyDesignTokens.Typography.cardTitle, 17),
            (AlmidyDesignTokens.Typography.body, 17),
            (AlmidyDesignTokens.Typography.bodyCompact, 15),
            (AlmidyDesignTokens.Typography.bodyEmphasized, 17),
            (AlmidyDesignTokens.Typography.action, 17),
            (AlmidyDesignTokens.Typography.metadata, 13),
            (AlmidyDesignTokens.Typography.metadataEmphasis, 13),
            (AlmidyDesignTokens.Typography.caption, 12),
            (AlmidyDesignTokens.Typography.badge, 11)
        ]
        for (role, expectedSize) in roles {
            XCTAssertEqual(role.baseFont.pointSize, expectedSize)
            XCTAssertTrue(role.baseFont.fontName.hasPrefix("InstrumentSans-"))
        }
    }

    func testFixedSizeCompatibilityHelpersResolveInstrumentSans() {
        XCTAssertEqual(AlmidyDesignTokens.Font.display(52).fontName, "InstrumentSans-Regular")
        XCTAssertEqual(AlmidyDesignTokens.Font.body(18).pointSize, 18)
        XCTAssertEqual(AlmidyDesignTokens.Font.semibold(17).fontName, "InstrumentSans-SemiBold")
        XCTAssertEqual(AlmidyDesignTokens.Font.bold(11).fontName, "InstrumentSans-Bold")
    }

    func testSharedSemanticColorsPreserveCanonicalValues() {
        assertColor(AlmidyDesignTokens.Color.accent, hex: 0xD6A84F)
        assertColor(AlmidyDesignTokens.Color.accentPressed, hex: 0xB88A2E)
        assertColor(AlmidyDesignTokens.Color.accentText, hex: 0x8C641E)
        assertColor(AlmidyDesignTokens.Color.canvas, hex: 0xFFFFFF)
        assertColor(AlmidyDesignTokens.Color.canvasGrouped, hex: 0xF2F3F6)
        assertColor(AlmidyDesignTokens.Color.tripOverviewNeutralSurface, hex: 0xF2F3F6)
        assertColor(AlmidyDesignTokens.Color.textPrimary, hex: 0x050505)
        assertColor(AlmidyDesignTokens.Color.textSecondary, hex: 0x7D7D84)
    }

    func testSemanticColorsResolveAcrossLightAndDarkAppearances() {
        let light = UITraitCollection(userInterfaceStyle: .light)
        let dark = UITraitCollection(userInterfaceStyle: .dark)
        let roles = [
            AlmidyDesignTokens.Color.canvas,
            AlmidyDesignTokens.Color.canvasGrouped,
            AlmidyDesignTokens.Color.surface,
            AlmidyDesignTokens.Color.surfaceNeutral,
            AlmidyDesignTokens.Color.textPrimary,
            AlmidyDesignTokens.Color.textSecondary,
            AlmidyDesignTokens.Color.accentText,
            AlmidyDesignTokens.Color.inputSurface,
            AlmidyDesignTokens.Color.inputPlaceholder,
            AlmidyDesignTokens.Color.success,
            AlmidyDesignTokens.Color.danger,
            AlmidyDesignTokens.Color.info
        ]
        for role in roles {
            XCTAssertNotEqual(role.resolvedColor(with: light), role.resolvedColor(with: dark))
        }
        XCTAssertEqual(
            AlmidyDesignTokens.Color.onMediaPrimary.resolvedColor(with: light),
            AlmidyDesignTokens.Color.onMediaPrimary.resolvedColor(with: dark)
        )
        XCTAssertEqual(AlmidyDesignTokens.appearanceContract, "semantic-light-dark-with-media-map-native-exceptions")
    }

    func testHighContrastRemainsIndependentFromAppearance() {
        let light = UITraitCollection(traitsFrom: [
            UITraitCollection(userInterfaceStyle: .light),
            UITraitCollection(accessibilityContrast: .high)
        ])
        let dark = UITraitCollection(traitsFrom: [
            UITraitCollection(userInterfaceStyle: .dark),
            UITraitCollection(accessibilityContrast: .high)
        ])
        XCTAssertNotEqual(
            AlmidyDesignTokens.Color.textSecondary.resolvedColor(with: light),
            AlmidyDesignTokens.Color.textSecondary.resolvedColor(with: dark)
        )
        XCTAssertNotEqual(
            AlmidyDesignTokens.Color.borderStrong.resolvedColor(with: dark),
            AlmidyDesignTokens.Color.borderStrong.resolvedColor(with: UITraitCollection(userInterfaceStyle: .dark))
        )
    }

    func testLayerBackedSharedSurfaceRefreshesForTraitTransition() {
        let card = AlmidyCard(style: .standard)
        let light = UITraitCollection(userInterfaceStyle: .light)
        let dark = UITraitCollection(userInterfaceStyle: .dark)
        card.refreshAppearance(using: light)
        let lightBorder = card.layer.borderColor
        card.refreshAppearance(using: dark)
        let darkBorder = card.layer.borderColor

        XCTAssertNotEqual(lightBorder, darkBorder)
        XCTAssertEqual(
            darkBorder,
            AlmidyDesignTokens.Color.borderSubtle.resolvedColor(with: dark).cgColor
        )
    }

    func testSemanticSpacingRadiusAndSizeValues() {
        XCTAssertEqual(AlmidyDesignTokens.Spacing.nativeContent, 20)
        XCTAssertEqual(AlmidyDesignTokens.Spacing.sheetContentInset, 20)
        XCTAssertEqual(AlmidyDesignTokens.Radius.small, 8)
        XCTAssertEqual(AlmidyDesignTokens.Radius.field, 12)
        XCTAssertEqual(AlmidyDesignTokens.Radius.control, 18)
        XCTAssertEqual(AlmidyDesignTokens.Radius.card, 24)
        XCTAssertEqual(AlmidyDesignTokens.Radius.sheetUtility, 28)
        XCTAssertEqual(AlmidyDesignTokens.Radius.sheetEditor, 34)
        XCTAssertEqual(AlmidyDesignTokens.Radius.sheetProminent, 36)
        XCTAssertEqual(AlmidyDesignTokens.Size.minimumTarget, 44)
        XCTAssertEqual(AlmidyDesignTokens.Size.buttonStandard, 60)
        XCTAssertEqual(AlmidyDesignTokens.Size.rowAction, 64)
        XCTAssertEqual(AlmidyDesignTokens.Size.mapControl, 56)
    }

    func testTypographyRolesExposeExpectedBaseSizesAndScale() {
        XCTAssertEqual(AlmidyDesignTokens.Typography.displayHero.baseFont.pointSize, 52)
        XCTAssertEqual(AlmidyDesignTokens.Typography.sheetTitle.baseFont.pointSize, 22)
        XCTAssertEqual(AlmidyDesignTokens.Typography.body.baseFont.pointSize, 17)
        XCTAssertEqual(AlmidyDesignTokens.Typography.metadata.baseFont.pointSize, 13)
        XCTAssertEqual(AlmidyDesignTokens.Typography.badge.baseFont.pointSize, 11)

        let normal = UITraitCollection(preferredContentSizeCategory: .large)
        let accessibility = UITraitCollection(preferredContentSizeCategory: .accessibilityExtraExtraExtraLarge)
        XCTAssertGreaterThan(
            AlmidyDesignTokens.Typography.body.scaledFont(compatibleWith: accessibility).pointSize,
            AlmidyDesignTokens.Typography.body.scaledFont(compatibleWith: normal).pointSize
        )
    }

    func testBorderAndElevationConfigurationsAreComplete() {
        XCTAssertEqual(AlmidyDesignTokens.Border.outline.width, 1)
        XCTAssertEqual(AlmidyDesignTokens.Border.selected.width, 2)
        XCTAssertEqual(AlmidyDesignTokens.Border.timeline(color: .red).width, 2)
        XCTAssertEqual(AlmidyDesignTokens.Elevation.controlSubtle.opacity, 0.08)
        XCTAssertEqual(AlmidyDesignTokens.Elevation.controlSubtle.radius, 10)
        XCTAssertEqual(AlmidyDesignTokens.Elevation.controlRaised.offset, CGSize(width: 0, height: 5))
        XCTAssertEqual(AlmidyDesignTokens.Elevation.floating.opacity, 0.16)
        XCTAssertEqual(AlmidyDesignTokens.Elevation.cardRaised.radius, 24)
        XCTAssertEqual(AlmidyDesignTokens.Elevation.sheet.offset.height, -4)
        XCTAssertEqual(AlmidyDesignTokens.Elevation.mapPin.radius, 5)

        let layer = CALayer()
        AlmidyDesignTokens.Elevation.cardRaised.apply(to: layer)
        AlmidyDesignTokens.Elevation.controlSubtle.apply(to: layer)
        XCTAssertEqual(layer.shadowColor, UIColor.black.cgColor)
        XCTAssertEqual(layer.shadowOpacity, 0.08)
        XCTAssertEqual(layer.shadowRadius, 10)
        XCTAssertEqual(layer.shadowOffset, CGSize(width: 0, height: 4))
    }

    func testMotionResolvesImmediatelyForReduceMotion() {
        XCTAssertEqual(
            AlmidyDesignTokens.Motion.resolvedDuration(0.45, reduceMotionEnabled: true),
            0
        )
        XCTAssertEqual(
            AlmidyDesignTokens.Motion.resolvedDuration(0.45, reduceMotionEnabled: false),
            0.45
        )
        XCTAssertEqual(AlmidyDesignTokens.Motion.TripOverview.duration, 0.48)
        XCTAssertEqual(AlmidyDesignTokens.Motion.TripOverview.damping, 0.84)
    }

    func testShapeUsesIntentInsteadOfSentinelRadius() {
        let square = CGRect(x: 0, y: 0, width: 44, height: 44)
        let capsule = CGRect(x: 0, y: 0, width: 88, height: 44)
        XCTAssertEqual(AlmidyDesignTokens.Shape.circle.cornerRadius(for: square), 22)
        XCTAssertEqual(AlmidyDesignTokens.Shape.capsule.cornerRadius(for: capsule), 22)
    }

    func testFloatingIconButtonSupportsMeasuredGeometryWithoutLosingSemantics() {
        let button = AlmidyIconButton(
            symbol: "ellipsis",
            style: .floating,
            accessibilityLabel: "More itinerary options",
            overrides: .init(diameter: 50)
        )
        button.frame = CGRect(x: 0, y: 0, width: 50, height: 50)
        button.layoutIfNeeded()

        XCTAssertEqual(button.semanticDiameter, 50)
        XCTAssertEqual(button.semanticSymbolPointSize, 20)
        XCTAssertEqual(button.minimumHitTarget, CGSize(width: 44, height: 44))
        XCTAssertEqual(button.layer.cornerRadius, 25)
        XCTAssertEqual(button.layer.shadowOpacity, AlmidyDesignTokens.Elevation.floating.opacity)
        XCTAssertEqual(button.accessibilityLabel, "More itinerary options")
        XCTAssertTrue(button.accessibilityTraits.contains(.button))
    }

    func testIconButtonDisabledStateUsesSemanticColors() {
        let button = AlmidyIconButton(
            symbol: "xmark",
            accessibilityLabel: "Close"
        )
        button.isEnabled = false
        XCTAssertEqual(button.backgroundColor, AlmidyDesignTokens.Color.stateDisabledFill)
        XCTAssertEqual(button.tintColor, AlmidyDesignTokens.Color.stateDisabledText)
    }

    func testButtonVariantsAndSizesExposeSemanticContract() {
        let primary = AlmidyButton(title: "Continue", style: .primary, size: .standard)
        let destructive = AlmidyButton(title: "Delete", style: .destructive, size: .compact)
        XCTAssertEqual(primary.semanticHeight, 60)
        XCTAssertEqual(primary.backgroundColor, AlmidyDesignTokens.Color.accent)
        XCTAssertEqual(destructive.semanticHeight, 48)
        XCTAssertEqual(destructive.backgroundColor, AlmidyDesignTokens.Color.danger)

        primary.isEnabled = false
        XCTAssertEqual(primary.backgroundColor, AlmidyDesignTokens.Color.stateDisabledFill)
    }

    func testDividerUsesPixelCorrectHairline() {
        let divider = AlmidyDivider(style: .inset(16))
        XCTAssertEqual(divider.thickness, 1 / UIScreen.main.scale)
        XCTAssertEqual(divider.intrinsicContentSize.height, divider.thickness)
        XCTAssertFalse(divider.isAccessibilityElement)
    }

    func testBadgeUsesSemanticTypographyAndAccessibleText() {
        let badge = AlmidyBadge(text: "PRO", style: .accent)
        XCTAssertEqual(badge.font.pointSize, AlmidyDesignTokens.Typography.badge.scaledFont().pointSize)
        XCTAssertEqual(badge.accessibilityLabel, "PRO")
        XCTAssertEqual(badge.textColor, AlmidyDesignTokens.Color.accentText)
        XCTAssertEqual(
            badge.contentInsets,
            UIEdgeInsets(
                top: AlmidyDesignTokens.Spacing.xxs,
                left: AlmidyDesignTokens.Spacing.xs,
                bottom: AlmidyDesignTokens.Spacing.xxs,
                right: AlmidyDesignTokens.Spacing.xs
            )
        )
    }

    func testSurfaceAppliesRadiusBorderAndElevationContract() {
        let card = UIView()
        AlmidySurfaceStyle.card.apply(to: card)
        XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.Radius.card)
        XCTAssertEqual(card.layer.borderWidth, AlmidyDesignTokens.Border.outline.width)

        AlmidySurfaceStyle.cardLarge.apply(to: card)
        XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.Radius.cardLarge)
        XCTAssertEqual(card.layer.shadowOpacity, AlmidyDesignTokens.Elevation.cardRaised.opacity)
    }

    func testInputStylesApplyNormalFocusErrorAndDisabledStates() {
        let field = UITextField()
        field.placeholder = "Destination"
        AlmidyInputStyle.standard.apply(to: field, state: .focused)
        XCTAssertEqual(field.layer.cornerRadius, AlmidyDesignTokens.Radius.field)
        XCTAssertEqual(field.layer.borderWidth, AlmidyDesignTokens.Border.selected.width)

        AlmidyInputStyle.standard.apply(to: field, state: .error)
        XCTAssertEqual(
            field.layer.borderColor,
            AlmidyDesignTokens.Color.danger.resolvedColor(with: field.traitCollection).cgColor
        )

        AlmidyInputStyle.standard.apply(to: field, state: .disabled)
        XCTAssertFalse(field.isEnabled)
        XCTAssertEqual(field.backgroundColor, AlmidyDesignTokens.Color.stateDisabledFill)
    }

    func testSearchInputPreservesOutlinedDarkSurfaceContract() {
        let field = UITextField()
        field.placeholder = "Search a city or place"

        AlmidyInputStyle.search.apply(to: field)

        XCTAssertEqual(field.backgroundColor, AlmidyDesignTokens.Color.inputSurface)
        XCTAssertEqual(field.layer.cornerRadius, AlmidyDesignTokens.Radius.control)
        XCTAssertEqual(field.layer.borderWidth, 1)
        XCTAssertEqual(
            field.layer.borderColor,
            AlmidyDesignTokens.Color.inputBorder.resolvedColor(with: field.traitCollection).cgColor
        )
        XCTAssertEqual(
            field.attributedPlaceholder?.attribute(.foregroundColor, at: 0, effectiveRange: nil) as? UIColor,
            AlmidyDesignTokens.Color.inputPlaceholder
        )
    }

    func testSheetConfigurationsExposeSemanticDefaultsAndOverrides() {
        XCTAssertEqual(AlmidySheetConfiguration.utility.preferredCornerRadius, 28)
        XCTAssertTrue(AlmidySheetConfiguration.utility.prefersGrabberVisible)
        XCTAssertEqual(AlmidySheetConfiguration.editor.preferredCornerRadius, 34)
        XCTAssertFalse(AlmidySheetConfiguration.editor.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertEqual(AlmidySheetConfiguration.prominent.preferredCornerRadius, 36)
        XCTAssertEqual(
            AlmidySheetConfiguration.overview.preferredCornerRadius,
            AlmidyDesignTokens.Component.TripOverview.sheetCornerRadius
        )
        XCTAssertFalse(AlmidySheetConfiguration.overview.prefersGrabberVisible)

        let override = AlmidySheetConfiguration.utility.overriding(
            cornerRadius: 30,
            grabberVisible: false,
            scrollingExpandsWhenScrolledToEdge: false
        )
        XCTAssertEqual(override.preferredCornerRadius, 30)
        XCTAssertFalse(override.prefersGrabberVisible)
        XCTAssertFalse(override.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertEqual(override.role, .utility)
    }

    func testSheetHeaderCentersTitleAndSupportsMeasuredControls() {
        let leading = UIView()
        leading.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            leading.widthAnchor.constraint(equalToConstant: 82),
            leading.heightAnchor.constraint(equalToConstant: 44)
        ])
        let header = AlmidySheetHeader(
            title: "Choose a Date",
            subtitle: "Mon, Aug 24",
            leadingControl: leading,
            metrics: .init(height: 67, horizontalInset: 20, controlSize: 82),
            dividerOverride: AlmidyDivider(thickness: 1)
        )
        header.frame = CGRect(x: 0, y: 0, width: 393, height: 67)
        header.layoutIfNeeded()
        XCTAssertEqual(header.metrics.controlSize, 82)
        let titleFrame = header.titleLabel.convert(header.titleLabel.bounds, to: header)
        XCTAssertEqual(titleFrame.midX, header.bounds.midX, accuracy: 0.5)
        XCTAssertEqual(header.divider?.thickness, 1)
        XCTAssertTrue(header.titleLabel.adjustsFontForContentSizeCategory)
    }

    func testLargeLeadingSheetHeaderPreservesAsymmetricUtilityGeometry() {
        let close = AlmidyIconButton(
            symbol: "xmark",
            accessibilityLabel: "Close Settings",
            overrides: .init(diameter: 52, symbolPointSize: 24)
        )
        let header = AlmidySheetHeader(
            title: "Settings",
            layout: .largeLeading,
            trailingControl: close,
            metrics: .init(height: 0, horizontalInset: 20, controlSize: 52),
            titleFont: AlmidyDesignTokens.Font.display(38)
        )
        header.frame = CGRect(x: 0, y: 0, width: 393, height: 155)
        header.layoutIfNeeded()

        XCTAssertEqual(close.frame.size, CGSize(width: 52, height: 52))
        XCTAssertEqual(close.frame.minY, 14, accuracy: 0.5)
        XCTAssertEqual(close.frame.maxX, 373, accuracy: 0.5)
        let titleFrame = header.titleLabel.convert(header.titleLabel.bounds, to: header)
        XCTAssertEqual(titleFrame.minX, 24, accuracy: 0.5)
        XCTAssertEqual(header.titleLabel.textAlignment, .natural)
    }

    func testCardVariantsDelegateSurfaceResponsibilities() {
        let standard = AlmidyCard(style: .standard)
        let large = AlmidyCard(style: .large)
        XCTAssertEqual(standard.layer.cornerRadius, AlmidyDesignTokens.Radius.card)
        XCTAssertEqual(standard.layer.borderWidth, AlmidyDesignTokens.Border.outline.width)
        XCTAssertEqual(large.layer.cornerRadius, AlmidyDesignTokens.Radius.cardLarge)
        XCTAssertEqual(large.layer.shadowOpacity, AlmidyDesignTokens.Elevation.cardRaised.opacity)
    }

    func testGroupedCardSurfaceMatchesUtilitySectionContract() {
        let view = UIView()
        AlmidySurfaceStyle.groupedCard.apply(to: view)
        XCTAssertEqual(view.backgroundColor, AlmidyDesignTokens.Color.surface)
        XCTAssertEqual(view.layer.cornerRadius, AlmidyDesignTokens.Radius.card)
        XCTAssertEqual(view.layer.borderWidth, 1)
        XCTAssertEqual(view.layer.borderColor, AlmidyDesignTokens.Color.dividerSubtle.cgColor)
    }

    func testListRowSemanticContentAndAccessories() {
        let row = AlmidyListRow(
            title: "Cost",
            subtitle: "Optional",
            symbol: "dollarsign",
            value: "$120",
            showsChevron: true
        )
        XCTAssertEqual(row.semanticHeight, AlmidyDesignTokens.Size.rowStandard)
        XCTAssertEqual(row.titleLabel.font.pointSize, AlmidyDesignTokens.Typography.body.scaledFont().pointSize)
        XCTAssertFalse(row.iconView.isHidden)
        XCTAssertFalse(row.chevronView.isHidden)
        XCTAssertEqual(row.accessibilityLabel, "Cost, Optional, $120")
    }

    func testFormSectionCreatesSemanticInternalSeparators() {
        let section = AlmidyFormSection(rows: [UIView(), UIView(), UIView()])
        XCTAssertEqual(section.layer.cornerRadius, AlmidyDesignTokens.Radius.control)
        XCTAssertEqual(section.separators.count, 2)
        XCTAssertTrue(section.separators.allSatisfy { $0.thickness == 1 / UIScreen.main.scale })
    }

    func testActionRowUsesStandardActionGeometry() {
        let row = AlmidyActionRow(title: "Add note", symbol: "note.text")
        XCTAssertEqual(row.semanticHeight, AlmidyDesignTokens.Size.rowAction)
        XCTAssertEqual(row.row.semanticHeight, AlmidyDesignTokens.Size.rowAction)
        XCTAssertEqual(row.row.iconView.tintColor, AlmidyDesignTokens.Color.accentText)
    }

    func testEmptyStateProvidesAccessibleHierarchyAndReflow() {
        let state = AlmidyEmptyState(
            style: .offline,
            title: "You’re offline",
            message: "Reconnect to load this trip."
        )
        XCTAssertTrue(state.titleLabel.accessibilityTraits.contains(.header))
        XCTAssertFalse(state.imageView.isAccessibilityElement)
        XCTAssertEqual(state.titleLabel.numberOfLines, 0)
        XCTAssertEqual(state.messageLabel.numberOfLines, 0)
        XCTAssertTrue(state.messageLabel.adjustsFontForContentSizeCategory)
    }

    func testMessageOnlyEmptyStatePreservesInlineStatusPresentation() {
        let state = AlmidyEmptyState(
            style: .empty,
            presentation: .messageOnly,
            title: "",
            message: "Start typing to search the globe."
        )

        XCTAssertTrue(state.imageView.isHidden)
        XCTAssertTrue(state.titleLabel.isHidden)
        XCTAssertEqual(state.messageLabel.text, "Start typing to search the globe.")

        state.setMessage("Could not load search suggestions.", style: .error)
        XCTAssertEqual(state.semanticStyle, .error)
        XCTAssertEqual(state.messageLabel.text, "Could not load search suggestions.")
    }

    func testFloatingControlComposesIconButtonSemantics() {
        let neutral = AlmidyFloatingControl(
            symbol: "ellipsis",
            style: .neutral,
            accessibilityLabel: "More"
        )
        let map = AlmidyFloatingControl(
            symbol: "location",
            style: .map,
            accessibilityLabel: "Current location"
        )
        XCTAssertEqual(neutral.semanticDiameter, 50)
        XCTAssertEqual(neutral.button.layer.shadowOpacity, AlmidyDesignTokens.Elevation.floating.opacity)
        XCTAssertEqual(map.semanticDiameter, AlmidyDesignTokens.Size.mapControl)
        XCTAssertEqual(map.button.accessibilityLabel, "Current location")
    }

    private func assertColor(
        _ color: UIColor,
        hex: UInt32,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        let light = color.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light))
        XCTAssertTrue(light.getRed(&red, green: &green, blue: &blue, alpha: &alpha), file: file, line: line)
        XCTAssertEqual(red, CGFloat((hex >> 16) & 0xFF) / 255, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(green, CGFloat((hex >> 8) & 0xFF) / 255, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(blue, CGFloat(hex & 0xFF) / 255, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(alpha, 1, accuracy: 0.001, file: file, line: line)
    }
}
