import CoreLocation
import UIKit
import XCTest
@testable import Almidy

final class NativeTripBackgroundTests: XCTestCase {
    private struct ScreenshotGeometry {
        let sourceSize: CGSize
        let frames: [String: CGRect]

        var framesOn393PointBaseline: [String: CGRect] {
            let scale = CGFloat(393) / sourceSize.width
            return frames.mapValues { frame in
                CGRect(
                    x: frame.minX * scale,
                    y: frame.minY * scale,
                    width: frame.width * scale,
                    height: frame.height * scale
                )
            }
        }

        var normalizedToSheetWidth: [String: CGRect] {
            framesOn393PointBaseline.mapValues { frame in
                CGRect(
                    x: frame.minX / 393,
                    y: frame.minY / 393,
                    width: frame.width / 393,
                    height: frame.height / 393
                )
            }
        }
    }

    // Screenshot 2026-08-15 at 1.18.47 PM: current collapsed Almidy state.
    private static let collapsedObserved = ScreenshotGeometry(
        sourceSize: CGSize(width: 1_320, height: 2_868),
        frames: [
            "sheet": CGRect(x: 0, y: 187, width: 1_320, height: 2_681),
            "grabber": CGRect(x: 606, y: 201, width: 108, height: 16),
            "more": CGRect(x: 60, y: 235, width: 144, height: 143),
            "search": CGRect(x: 240, y: 235, width: 144, height: 143),
            "close": CGRect(x: 1_116, y: 235, width: 144, height: 143),
            "titleDate": CGRect(x: 488, y: 260, width: 349, height: 96),
            "compactHeaderBottom": CGRect(x: 0, y: 487, width: 1_320, height: 1),
            "activityGroup": CGRect(x: 515, y: 430, width: 291, height: 284),
            "itinerary": CGRect(x: 60, y: 788, width: 1_200, height: 482)
        ]
    )

    // Screenshot 2026-08-15 at 1.18.06 PM: approved collapsed reference.
    private static let collapsedReference = ScreenshotGeometry(
        sourceSize: CGSize(width: 1_320, height: 2_868),
        frames: [
            "sheet": CGRect(x: 0, y: 187, width: 1_320, height: 2_681),
            "grabber": CGRect(x: 603, y: 212, width: 114, height: 25),
            "more": CGRect(x: 60, y: 235, width: 144, height: 143),
            "search": CGRect(x: 240, y: 235, width: 144, height: 143),
            "close": CGRect(x: 1_116, y: 235, width: 144, height: 143),
            "titleDate": CGRect(x: 558, y: 255, width: 389, height: 102),
            "compactHeaderBottom": CGRect(x: 0, y: 516, width: 1_320, height: 1),
            "activityGroup": CGRect(x: 478, y: 537, width: 364, height: 279),
            "itinerary": CGRect(x: 60, y: 890, width: 1_200, height: 494)
        ]
    )

    func testExpandedAndCollapsedGeometryExpectationsAreIndependent() {
        // Expanded composition remains locked to the previously approved tokens.
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expandedHeaderHeight, 370)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline, 502.7, accuracy: 0.01)

        let collapsed = AlmidyDesignTokens.TripOverview.CollapsedComposition.self
        XCTAssertEqual(collapsed.compactHeaderVisualHeight, 98)
        XCTAssertEqual(collapsed.grabberTopInset, 7.5)
        XCTAssertEqual(collapsed.controlDiameter, 43)
        XCTAssertEqual(collapsed.controlSideInset, 18)
        XCTAssertEqual(collapsed.controlTopInset, 14)
        XCTAssertEqual(collapsed.titleDateSpacing, 1)
        XCTAssertEqual(collapsed.activityRegionHeight, 93.3, accuracy: 0.01)
        XCTAssertEqual(collapsed.activityCircleDiameter, 64)
        XCTAssertEqual(collapsed.activityCircleToLabelGap, 2)
        XCTAssertEqual(collapsed.itineraryTopBaseline, 209.3, accuracy: 0.01)
        XCTAssertEqual(collapsed.contentFlowDownshift, 35)
        XCTAssertEqual(collapsed.contentFlowDownshift * 3, 105)
        XCTAssertEqual(collapsed.contentFlowDownshift(for: 393), 35)
        XCTAssertEqual(collapsed.contentFlowDownshift(for: 375), 33.4, accuracy: 0.1)
        XCTAssertEqual(collapsed.contentFlowDownshift(for: 430), 38.3, accuracy: 0.1)

        XCTAssertNotEqual(collapsed.compactHeaderVisualHeight, AlmidyDesignTokens.TripOverview.expandedHeaderHeight)
        XCTAssertNotEqual(collapsed.controlDiameter, AlmidyDesignTokens.TripOverview.headerControlDiameter)
        XCTAssertNotEqual(collapsed.activityCircleDiameter, AlmidyDesignTokens.TripOverview.emptyActionCircleDiameter)

        XCTAssertEqual(
            collapsed.compactHeaderVisualHeight
                + collapsed.activityRegionHeight
                + AlmidyDesignTokens.TripOverview.interCardGap,
            collapsed.itineraryTopBaseline,
            accuracy: 0.01
        )

        let observed = Self.collapsedObserved.framesOn393PointBaseline
        let reference = Self.collapsedReference.framesOn393PointBaseline
        XCTAssertEqual(observed["sheet"]?.minY ?? -1, reference["sheet"]?.minY ?? -2, accuracy: 0.01)
        XCTAssertEqual(observed["more"]?.minX ?? -1, reference["more"]?.minX ?? -2, accuracy: 0.01)
        XCTAssertEqual(observed["search"]?.minX ?? -1, reference["search"]?.minX ?? -2, accuracy: 0.01)
        XCTAssertEqual(observed["close"]?.maxX ?? -1, reference["close"]?.maxX ?? -2, accuracy: 0.01)

        let referenceSheetTop = reference["sheet"]?.minY ?? 0
        XCTAssertEqual(
            (reference["compactHeaderBottom"]?.minY ?? 0) - referenceSheetTop,
            collapsed.compactHeaderVisualHeight,
            accuracy: 0.1
        )
        XCTAssertEqual(
            (reference["grabber"]?.minY ?? 0) - referenceSheetTop,
            collapsed.grabberTopInset,
            accuracy: 0.1
        )
        XCTAssertEqual(reference["more"]?.width ?? 0, collapsed.controlDiameter, accuracy: 0.15)
        XCTAssertEqual(reference["more"]?.minX ?? 0, collapsed.controlSideInset, accuracy: 0.15)
        XCTAssertEqual(
            (reference["itinerary"]?.minY ?? 0) - referenceSheetTop,
            collapsed.itineraryTopBaseline,
            accuracy: 0.1
        )

        // Record the measured collapsed mismatch without changing production layout:
        // the reference activity and Itinerary begin about 32 and 30 points lower.
        XCTAssertEqual(
            (reference["activityGroup"]?.minY ?? 0) - (observed["activityGroup"]?.minY ?? 0),
            31.86,
            accuracy: 0.15
        )
        XCTAssertEqual(
            (reference["itinerary"]?.minY ?? 0) - (observed["itinerary"]?.minY ?? 0),
            30.37,
            accuracy: 0.15
        )
    }

    func testCollapsedScreenshotFramesHaveStableNormalizedRecords() {
        let observed = Self.collapsedObserved.normalizedToSheetWidth
        let reference = Self.collapsedReference.normalizedToSheetWidth
        XCTAssertEqual(observed["grabber"]?.minY ?? -1, 0.1523, accuracy: 0.0002)
        XCTAssertEqual(reference["grabber"]?.minY ?? -1, 0.1606, accuracy: 0.0002)
        XCTAssertEqual(observed["compactHeaderBottom"]?.minY ?? -1, 0.3689, accuracy: 0.0002)
        XCTAssertEqual(reference["compactHeaderBottom"]?.minY ?? -1, 0.3909, accuracy: 0.0002)
        XCTAssertEqual(observed["itinerary"]?.minY ?? -1, 0.5970, accuracy: 0.0002)
        XCTAssertEqual(reference["itinerary"]?.minY ?? -1, 0.6742, accuracy: 0.0002)
    }

    func testHeroCropUsesVerifiableCenterBiasedFocalRuleAcrossImageShapes() {
        let container = CGSize(
            width: 393,
            height: AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        )
        let landscape = NativeTripOverviewFocalImageView.sourceCropRect(
            imageSize: CGSize(width: 1_600, height: 900), containerSize: container
        )
        let portrait = NativeTripOverviewFocalImageView.sourceCropRect(
            imageSize: CGSize(width: 900, height: 1_600), containerSize: container
        )
        let unusuallyTall = NativeTripOverviewFocalImageView.sourceCropRect(
            imageSize: CGSize(width: 600, height: 2_400), containerSize: container
        )

        XCTAssertEqual(NativeTripOverviewFocalImageView.defaultVerticalFocalPosition, 0.48, accuracy: 0.001)
        XCTAssertEqual(landscape.minY, 0, accuracy: 0.001)
        XCTAssertEqual(landscape.height, 1, accuracy: 0.001, "Landscape destinations retain their full vertical image content.")
        let crops = [
            (landscape, CGSize(width: 1_600, height: 900)),
            (portrait, CGSize(width: 900, height: 1_600)),
            (unusuallyTall, CGSize(width: 600, height: 2_400))
        ]
        for (crop, imageSize) in crops {
            XCTAssertGreaterThanOrEqual(crop.minX, 0)
            XCTAssertGreaterThanOrEqual(crop.minY, 0)
            XCTAssertLessThanOrEqual(crop.maxX, 1)
            XCTAssertLessThanOrEqual(crop.maxY, 1)
            XCTAssertLessThanOrEqual(crop.minY, 0.48)
            XCTAssertGreaterThanOrEqual(crop.maxY, 0.48, "The primary center-biased focal anchor must remain visible.")
            XCTAssertEqual(
                (crop.width * imageSize.width) / (crop.height * imageSize.height),
                container.width / container.height,
                accuracy: 0.001,
                "Every crop must preserve aspect-fill geometry."
            )
        }
        XCTAssertLessThanOrEqual(portrait.midY, 0.5)
        XCTAssertLessThanOrEqual(unusuallyTall.midY, 0.5)
    }

    func testExpandedHeroReducesPortraitMagnificationAndKeepsSubjectLandmarksVisible() {
        let formerContainer = CGSize(width: 393, height: 322)
        let revisedContainer = CGSize(
            width: 393,
            height: AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        )
        let imageShapes = [
            CGSize(width: 900, height: 1_600),
            CGSize(width: 600, height: 2_400)
        ]
        // Representative vertical subject band: upper feature/torch, head/body,
        // and pedestal/base. Keeping all three inside the crop guards full subjects.
        let subjectLandmarks: [CGFloat] = [0.37, 0.44, 0.58]

        for imageSize in imageShapes {
            let former = NativeTripOverviewFocalImageView.sourceCropRect(
                imageSize: imageSize,
                containerSize: formerContainer
            )
            let revised = NativeTripOverviewFocalImageView.sourceCropRect(
                imageSize: imageSize,
                containerSize: revisedContainer
            )
            XCTAssertGreaterThan(
                revised.height,
                former.height,
                "The taller hero must retain more vertical source content and therefore reduce apparent subject magnification."
            )
            for landmark in subjectLandmarks {
                XCTAssertTrue(
                    revised.minY...revised.maxY ~= landmark,
                    "Representative subject landmark \(landmark) was cropped from \(imageSize)."
                )
            }
        }
    }

    func testHeroOwnsTheRoundedSheetTopWithoutASecondChromeLayer() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 284))
        header.layoutIfNeeded()

        XCTAssertEqual(header.topCornerRadius, AlmidyDesignTokens.TripOverview.sheetCornerRadius)
        XCTAssertEqual(header.topCornerMask, [.layerMinXMinYCorner, .layerMaxXMinYCorner])
        XCTAssertEqual(header.heroImageFrame, header.bounds)
        XCTAssertEqual(header.heroFadeFrame, header.bounds)
        XCTAssertEqual(header.customGrabberCount, 1)
        XCTAssertEqual(header.grabberFrame.minY, 5, accuracy: 0.01)
        XCTAssertTrue(header.controlMinimumHitTargets.allSatisfy { $0.width >= 44 && $0.height >= 44 })
    }

    func testCustomGrabberRemainsStableThroughoutCollapse() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 370))
        header.layoutIfNeeded()
        let expandedFrame = header.grabberFrame

        header.updateTransition(progress: 0.5)
        header.layoutIfNeeded()
        let midpointFrame = header.grabberFrame

        header.updateTransition(progress: 1)
        header.layoutIfNeeded()

        XCTAssertEqual(header.customGrabberCount, 1)
        XCTAssertEqual(midpointFrame, expandedFrame)
        XCTAssertEqual(header.grabberFrame, expandedFrame)
        XCTAssertEqual(header.grabberAlpha, 1, accuracy: 0.001)
    }

    func testCompactGrabberUsesDarkReferenceContrastOnLightAdaptiveSurface() {
        let lightSurface = UIColor(red: 0.60, green: 0.56, blue: 0.50, alpha: 1)
        let darkSurface = UIColor(red: 0.08, green: 0.09, blue: 0.10, alpha: 1)
        var white: CGFloat = 0
        var alpha: CGFloat = 0

        XCTAssertTrue(NativeTripOverviewHeroColorProcessor.compactGrabberColor(for: lightSurface).getWhite(&white, alpha: &alpha))
        XCTAssertEqual(white, 0, accuracy: 0.001)
        XCTAssertEqual(alpha, 0.72, accuracy: 0.001)

        XCTAssertTrue(NativeTripOverviewHeroColorProcessor.compactGrabberColor(for: darkSurface).getWhite(&white, alpha: &alpha))
        XCTAssertEqual(white, 1, accuracy: 0.001)
        XCTAssertEqual(alpha, 0.80, accuracy: 0.001)
    }

    func testHeaderTransitionKeepsHeroContinuousAndMasksTitleBeforeCompactHandoff() {
        let expanded = NativeTripOverviewHeaderTransition(progress: 0, reduceMotion: false)
        let middle = NativeTripOverviewHeaderTransition(progress: 0.5, reduceMotion: false)
        let compact = NativeTripOverviewHeaderTransition(progress: 1, reduceMotion: false)

        XCTAssertEqual(expanded.imageAlpha, 1, accuracy: 0.001)
        XCTAssertGreaterThan(middle.imageAlpha, compact.imageAlpha)
        XCTAssertEqual(compact.imageAlpha, 0, accuracy: 0.001)
        XCTAssertGreaterThanOrEqual(compact.gradientAlpha, 0.90)
        XCTAssertEqual(expanded.compactBackgroundAlpha, 0, accuracy: 0.001)
        XCTAssertEqual(compact.compactBackgroundAlpha, 1, accuracy: 0.001)
        XCTAssertEqual(middle.expandedAlpha, 1, accuracy: 0.001)
        XCTAssertGreaterThan(compact.compactAlpha, middle.compactAlpha)
    }

    func testTitleHandoffNeverLeavesBothTitlesEquallyReadable() {
        let beforeHandoff = NativeTripOverviewHeaderTransition(progress: 0.86, reduceMotion: false)
        let boundary = NativeTripOverviewHeaderTransition(progress: 0.92, reduceMotion: false)
        let afterHandoff = NativeTripOverviewHeaderTransition(progress: 0.96, reduceMotion: false)

        XCTAssertGreaterThan(beforeHandoff.expandedAlpha, beforeHandoff.compactAlpha)
        XCTAssertEqual(beforeHandoff.compactAlpha, 0, accuracy: 0.001)
        XCTAssertLessThan(boundary.expandedAlpha, 0.05)
        XCTAssertEqual(boundary.compactAlpha, 0, accuracy: 0.001)
        XCTAssertGreaterThan(afterHandoff.compactAlpha, afterHandoff.expandedAlpha)
        XCTAssertEqual(afterHandoff.expandedAlpha, 0, accuracy: 0.001)
    }

    func testCompactHeaderUsesDistinctImageDerivedSurfaceAndTransparentHeroBoundary() {
        let palette = NativeTripOverviewHeroColorProcessor.palette(
            top: UIColor(red: 0.70, green: 0.52, blue: 0.34, alpha: 1),
            bottom: UIColor(red: 0.48, green: 0.32, blue: 0.20, alpha: 1),
            dominant: UIColor(red: 0.56, green: 0.40, blue: 0.26, alpha: 1)
        )
        let colors = NativeTripOverviewCompactGradient.colors(
            compact: palette.compact,
            sheet: palette.sheet,
            increasedContrast: false
        )

        XCTAssertEqual(NativeTripOverviewCompactGradient.locations, [0.0, 0.44, 0.76, 1.0])
        XCTAssertEqual(colors.count, 4)
        XCTAssertFalse(colors[0].isEqual(palette.sheet), "The compact header must remain visually distinct from the activity surface.")
        XCTAssertEqual(colors[0].cgColor.alpha, 0.56, accuracy: 0.001)
        XCTAssertGreaterThan(colors[0].cgColor.alpha, colors[1].cgColor.alpha)
        XCTAssertGreaterThan(colors[1].cgColor.alpha, colors[2].cgColor.alpha)
        XCTAssertEqual(colors.last?.cgColor.alpha ?? 1, 0, accuracy: 0.001, "The fixed header must dissolve without a visible lower edge.")
        XCTAssertLessThan(Self.relativeLuminance(palette.compact), Self.relativeLuminance(palette.sheet))
    }

    func testCompactHeaderBackdropNeverCoversExpandedHero() {
        let header = NativeTripOverviewHeaderView()
        header.frame = CGRect(x: 0, y: 0, width: 390, height: AlmidyDesignTokens.TripOverview.expandedHeaderHeight)
        header.layoutIfNeeded()

        XCTAssertEqual(
            header.compactBackgroundFrame.height,
            NativeTripOverviewCompactGradient.surfaceHeight,
            accuracy: 0.001
        )
        XCTAssertLessThan(header.compactBackgroundFrame.height, header.bounds.height)
        XCTAssertGreaterThan(
            NativeTripOverviewCompactGradient.surfaceHeight,
            AlmidyDesignTokens.TripOverview.compactHeaderHeight,
            "The tint must extend beyond the structural toolbar so its lower edge can dissolve smoothly."
        )
    }

    func testScrollingContentFadesCompletelyUnderCompactHeader() {
        let viewportHeight: CGFloat = 852
        let locations = NativeTripOverviewScrollOcclusion.locations(
            viewportHeight: viewportHeight
        ).map(\.doubleValue)

        XCTAssertEqual(locations.count, 4)
        XCTAssertEqual(locations[0], 0, accuracy: 0.001)
        XCTAssertEqual(
            locations[1],
            Double(NativeTripOverviewScrollOcclusion.fadeStart / viewportHeight),
            accuracy: 0.001
        )
        XCTAssertEqual(
            locations[2],
            Double(NativeTripOverviewScrollOcclusion.fadeEnd / viewportHeight),
            accuracy: 0.001
        )
        XCTAssertEqual(locations[1], locations[2], accuracy: 0.001)
        XCTAssertLessThan(locations[2], locations[3])
        XCTAssertEqual(
            NativeTripOverviewScrollOcclusion.fadeEnd - NativeTripOverviewScrollOcclusion.fadeStart,
            0,
            accuracy: 0.001,
            "The reference uses a clean cutoff with no fog-producing interpolation."
        )
        XCTAssertLessThan(
            NativeTripOverviewScrollOcclusion.boundary,
            AlmidyDesignTokens.TripOverview.compactHeaderHeight,
            "The reference clips content directly below the controls, before the structural header ends."
        )
    }

    func testExternalHeroBackdropDoesNotStackASecondCompactFogLayer() {
        let header = NativeTripOverviewHeaderView()
        header.setUsesExternalHeroBackdrop(true)
        header.updateTransition(progress: 1)

        XCTAssertEqual(header.compactBackgroundAlpha, 0, accuracy: 0.001)
    }

    func testFullyCollapsedOverviewHidesItineraryWithoutRemovingItsLayoutSpace() {
        XCTAssertEqual(
            NativeTripOverviewDetentVisibility.itineraryAlpha(isFullyCollapsed: true),
            0,
            accuracy: 0.001,
            "The smallest detent must not expose the white edge of the Itinerary card."
        )
        XCTAssertEqual(
            NativeTripOverviewDetentVisibility.itineraryAlpha(isFullyCollapsed: false),
            1,
            accuracy: 0.001,
            "The itinerary preview remains visible in the taller collapsed and expanded detents."
        )
    }

    func testCollapsePresentationChangesContinuouslyAndMonotonically() {
        let samples = stride(from: CGFloat(0), through: 1, by: 0.05).map {
            NativeTripOverviewHeaderTransition(progress: $0, reduceMotion: false)
        }

        for pair in zip(samples, samples.dropFirst()) {
            XCTAssertLessThanOrEqual(pair.1.imageAlpha, pair.0.imageAlpha)
            XCTAssertEqual(pair.1.externalHeroAlpha, 1, accuracy: 0.001)
            XCTAssertLessThanOrEqual(pair.1.gradientAlpha, pair.0.gradientAlpha)
            XCTAssertLessThanOrEqual(pair.1.expandedAlpha, pair.0.expandedAlpha)
            XCTAssertGreaterThanOrEqual(pair.1.compactAlpha, pair.0.compactAlpha)
            XCTAssertGreaterThanOrEqual(pair.1.compactBackgroundAlpha, pair.0.compactBackgroundAlpha)
            XCTAssertLessThanOrEqual(pair.1.controlMaterialAlpha, pair.0.controlMaterialAlpha)
            XCTAssertGreaterThanOrEqual(pair.1.controlFillAlpha, pair.0.controlFillAlpha)
            XCTAssertLessThanOrEqual(pair.1.controlBorderAlpha, pair.0.controlBorderAlpha)
            XCTAssertLessThanOrEqual(pair.1.controlBorderWidth, pair.0.controlBorderWidth)

            // Small progress steps must not introduce a visible discontinuity.
            XCTAssertLessThan(abs(pair.1.imageAlpha - pair.0.imageAlpha), 0.11)
            XCTAssertLessThan(abs(pair.1.gradientAlpha - pair.0.gradientAlpha), 0.08)
        }
    }

    func testExpandedAndCollapsedHeaderShareApprovedTopInset() {
        let expanded = NativeTripOverviewHeaderTransition(progress: 0, reduceMotion: false)
        let collapsed = NativeTripOverviewHeaderTransition(progress: 1, reduceMotion: false)

        XCTAssertEqual(expanded.toolbarVerticalOffset, 0, accuracy: 0.001)
        XCTAssertEqual(
            NativeTripOverviewHeaderTransition.compactToolbarVerticalOffset,
            0,
            accuracy: 0.001
        )
        XCTAssertEqual(collapsed.toolbarVerticalOffset, 0, accuracy: 0.001)
        XCTAssertEqual(
            AlmidyDesignTokens.TripOverview.headerControlTopInset,
            14,
            accuracy: 0.001,
            "Expanded controls must use the same reference inset instead of sitting against the sheet top."
        )
        XCTAssertEqual(
            AlmidyDesignTokens.TripOverview.headerControlTopInset + collapsed.toolbarVerticalOffset,
            AlmidyDesignTokens.TripOverview.CollapsedComposition.controlTopInset,
            accuracy: 0.001
        )
    }

    func testControlsRemainLightFrostedGlassThroughoutTransition() {
        let expanded = NativeTripOverviewHeaderTransition(progress: 0, reduceMotion: false)
        let compact = NativeTripOverviewHeaderTransition(progress: 1, reduceMotion: false)

        XCTAssertEqual(expanded.controlMaterialAlpha, 0.72, accuracy: 0.001)
        XCTAssertEqual(compact.controlMaterialAlpha, 0.57, accuracy: 0.001)
        XCTAssertEqual(expanded.controlFillAlpha, 0.72, accuracy: 0.001)
        XCTAssertEqual(compact.controlFillAlpha, 0.80, accuracy: 0.001)
        XCTAssertEqual(expanded.controlBorderAlpha, 0.28, accuracy: 0.001)
        XCTAssertEqual(compact.controlBorderAlpha, 0.20, accuracy: 0.001)
        XCTAssertEqual(expanded.controlBorderWidth, 1.0, accuracy: 0.001)
        XCTAssertEqual(compact.controlBorderWidth, 1.0, accuracy: 0.001)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerControlSideInset, 20)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.headerControlDiameter, 48)
    }

    func testCompactDestinationIsCenteredAndSafelyBoundedBetweenControls() {
        let header = NativeTripOverviewHeaderView(frame: CGRect(x: 0, y: 0, width: 393, height: 100))
        header.render(seed: NativeTripOverviewSeed(
            tripID: "long-compact-destination",
            title: "A Deliberately Long Destination Name",
            dateRange: "Aug 15 → Aug 25",
            imageURL: nil,
            fallbackColor: "#737A84"
        ))
        header.updateTransition(progress: 1)
        header.layoutIfNeeded()

        XCTAssertEqual(header.compactDestinationFrame.midX, header.bounds.midX, accuracy: 0.5)
        XCTAssertEqual(header.compactTitleFrame.midX, header.compactDestinationFrame.width / 2, accuracy: 0.5)
        XCTAssertEqual(header.compactDateFrame.midX, header.compactDestinationFrame.width / 2, accuracy: 0.5)
        XCTAssertGreaterThanOrEqual(header.compactDestinationFrame.minX, header.searchButton.frame.maxX + 12 - 0.5)
        XCTAssertLessThanOrEqual(header.compactDestinationFrame.maxX, header.closeButton.frame.minX - 12 + 0.5)
        XCTAssertEqual(header.compactDestinationSpacing, 0)
        XCTAssertEqual(header.compactTitleMaximumLines, 2)
        XCTAssertEqual(header.compactTitleLineBreakMode, .byTruncatingTail)
        XCTAssertTrue(header.compactLabelsUseDynamicType)
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)

        header.updateTransition(progress: 0.49)
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)
        header.updateTransition(progress: 0.50)
        XCTAssertEqual(header.accessibleTitleContainerCount, 1)
    }

    func testReducedMotionTransitionUsesOpacityOnlyForPinnedCompactIdentity() {
        let middle = NativeTripOverviewHeaderTransition(progress: 0.5, reduceMotion: true)

        XCTAssertEqual(middle.compactTransform, .identity)
        XCTAssertEqual(middle.imageAlpha, 0.5, accuracy: 0.001)
        XCTAssertGreaterThan(middle.expandedAlpha, 0)
        XCTAssertEqual(middle.compactAlpha, 0, accuracy: 0.001)
    }

    func testHeaderTransitionClampsOverscrollWithoutHidingGrabberOrHero() {
        let beforeStart = NativeTripOverviewHeaderTransition(progress: -1, reduceMotion: false)
        let afterEnd = NativeTripOverviewHeaderTransition(progress: 2, reduceMotion: false)

        XCTAssertEqual(beforeStart.progress, 0)
        XCTAssertEqual(afterEnd.progress, 1)
        XCTAssertEqual(beforeStart.imageAlpha, 1, accuracy: 0.001)
        XCTAssertEqual(afterEnd.imageAlpha, 0, accuracy: 0.001)
        XCTAssertEqual(beforeStart.externalHeroAlpha, 1, accuracy: 0.001)
        XCTAssertEqual(afterEnd.externalHeroAlpha, 1, accuracy: 0.001)
    }

    func testScrollPositionRemainsStableAcrossSectionRefresh() {
        let preserved = CGPoint(x: 0, y: 226)
        XCTAssertEqual(
            NativeTripOverviewScrollPosition.restored(preserved, contentHeight: 1_400, viewportHeight: 800),
            preserved,
            "A partial refresh with sufficient content must retain the exact viewport offset."
        )
        XCTAssertEqual(
            NativeTripOverviewScrollPosition.restored(preserved, contentHeight: 900, viewportHeight: 800).y,
            100,
            "If refreshed content becomes shorter, clamp to its valid end instead of jumping to the top."
        )
    }

    func testExpandedSheetKeepsHeroSpacerFixedWhileCardsScrollNaturally() {
        let expanded = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        let downshift = AlmidyDesignTokens.TripOverview.CollapsedComposition.contentFlowDownshift

        XCTAssertEqual(
            NativeTripOverviewHeroSpacer.height(
                expandedHeight: expanded,
                compactDownshift: downshift,
                transitionProgress: 1,
                isExpandedDetent: true
            ),
            expanded,
            accuracy: 0.001
        )
        XCTAssertEqual(
            NativeTripOverviewHeroSpacer.height(
                expandedHeight: expanded,
                compactDownshift: downshift,
                transitionProgress: 1,
                isExpandedDetent: false
            ),
            expanded + downshift,
            accuracy: 0.001,
            "Compact detents retain their tuned content-flow downshift."
        )
    }

    func testHeroParallaxMovesSubjectInsideFixedViewport() {
        let distance: CGFloat = 240
        let start = NativeTripOverviewHeroParallax.translation(
            offset: 0,
            collapseDistance: distance,
            reduceMotion: false
        )
        let middle = NativeTripOverviewHeroParallax.translation(
            offset: distance / 2,
            collapseDistance: distance,
            reduceMotion: false
        )
        let end = NativeTripOverviewHeroParallax.translation(
            offset: distance * 2,
            collapseDistance: distance,
            reduceMotion: false
        )

        XCTAssertEqual(start, 0, accuracy: 0.001)
        XCTAssertGreaterThan(middle, start, "The subject must drift downward as content scrolls up.")
        XCTAssertGreaterThan(end, middle)
        XCTAssertEqual(
            NativeTripOverviewHeroParallax.translation(
                offset: distance,
                collapseDistance: distance,
                reduceMotion: true
            ),
            0,
            accuracy: 0.001,
            "Reduce Motion disables the parallax transform."
        )

        let restingCrop = NativeTripOverviewFocalImageView.sourceCropRect(
            imageSize: CGSize(width: 900, height: 1_600),
            containerSize: CGSize(width: 393, height: 485),
            verticalContentTranslation: start
        )
        let movedCrop = NativeTripOverviewFocalImageView.sourceCropRect(
            imageSize: CGSize(width: 900, height: 1_600),
            containerSize: CGSize(width: 393, height: 485),
            verticalContentTranslation: end
        )
        XCTAssertLessThan(movedCrop.minY, restingCrop.minY)
        XCTAssertGreaterThanOrEqual(movedCrop.minY, 0)
        XCTAssertLessThanOrEqual(movedCrop.maxY, 1)
    }

    func testExpandedMetadataTravelsWithScrollingActivityContent() {
        let header = NativeTripOverviewHeaderView()
        header.updateTransition(progress: 0, expandedContentOffset: 48)

        XCTAssertEqual(header.expandedContentTransform.ty, -48, accuracy: 0.001)
        XCTAssertEqual(header.compactContentTransform.ty, 12, accuracy: 0.001)
        XCTAssertEqual(header.expandedContentAlpha, 1, accuracy: 0.001)
    }

    func testInitialExpandedOverviewResetsRestoredScrollPositionToTop() {
        let preserved = CGPoint(x: 0, y: 226)
        XCTAssertEqual(
            NativeTripOverviewScrollPosition.restored(
                preserved,
                contentHeight: 1_400,
                viewportHeight: 800,
                resetToTop: true
            ),
            CGPoint(x: 0, y: 0),
            "The first loaded overview in the expanded detent must reveal the full hero."
        )
    }

    func testHeaderStructureChangesOnlyWithSheetDetent() {
        let expanded = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        let compact = AlmidyDesignTokens.TripOverview.compactHeaderHeight
        XCTAssertEqual(expanded, 370)
        XCTAssertEqual(compact, 100)
        XCTAssertEqual(
            NativeTripOverviewHeaderStructure.height(
                expandedHeight: expanded,
                compactHeight: compact,
                isExpandedDetent: true
            ),
            expanded
        )
        XCTAssertEqual(
            NativeTripOverviewHeaderStructure.height(
                expandedHeight: expanded,
                compactHeight: compact,
                isExpandedDetent: false
            ),
            compact
        )
    }

    func testCardChromeChangesOnlyWithCompactSheetDetents() {
        XCTAssertEqual(
            NativeTripOverviewContentChrome.progress(
                transitionProgress: 1,
                isExpandedDetent: true
            ),
            0,
            accuracy: 0.001,
            "Scrolling the large sheet must preserve expanded card dimensions."
        )
        XCTAssertEqual(
            NativeTripOverviewContentChrome.progress(
                transitionProgress: 1,
                isExpandedDetent: false
            ),
            1,
            accuracy: 0.001,
            "Compact detents retain their dedicated card composition."
        )
    }

    func testTallHeaderPassesNonControlTouchesThrough() {
        let header = NativeTripOverviewHeaderView(
            frame: CGRect(x: 0, y: 0, width: 393, height: AlmidyDesignTokens.TripOverview.expandedHeaderHeight)
        )
        header.layoutIfNeeded()

        XCTAssertFalse(header.point(inside: CGPoint(x: 196, y: 300), with: nil))
        XCTAssertTrue(header.point(inside: header.moreButton.center, with: nil))
        XCTAssertTrue(header.point(inside: header.searchButton.center, with: nil))
        XCTAssertTrue(header.point(inside: header.closeButton.center, with: nil))
    }

    func testExpandedCompositionReallocatesSixtyPointsWithoutMovingItineraryBudget() {
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.destinationBlockBottomInset, 14)
        let formerCenterAnchor = CGFloat(322) * 0.80
        let referenceThreeLineBlockHeight: CGFloat = 73
        let revisedCenter = AlmidyDesignTokens.TripOverview.expandedHeaderHeight
            - AlmidyDesignTokens.TripOverview.destinationBlockBottomInset
            - referenceThreeLineBlockHeight / 2
        XCTAssertGreaterThanOrEqual(revisedCenter - formerCenterAnchor, 55)
        XCTAssertLessThanOrEqual(revisedCenter - formerCenterAnchor, 65)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.expandedActionRegionHeight, 114.7, accuracy: 0.01)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.emptyActionCircleDiameter, 72)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.emptyActionLabelGap, 3)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.emptyActionBottomInset, 2)
        XCTAssertEqual(
            AlmidyDesignTokens.TripOverview.expandedHeaderHeight
                + AlmidyDesignTokens.TripOverview.expandedActionRegionHeight
                + AlmidyDesignTokens.TripOverview.interCardGap,
            AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline,
            accuracy: 0.01
        )
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.compactHeaderHeight, 100)
        XCTAssertEqual(AlmidyDesignTokens.TripOverview.accessibilityCompactHeaderHeight, 128)
    }

    func testOverviewExpandedTypographyKeepsLongDestinationDominantWithoutCrowdingMetadata() {
        let header = NativeTripOverviewHeaderView()

        XCTAssertEqual(header.expandedTitlePointSize, 30, accuracy: 0.01)
        XCTAssertEqual(header.expandedTitleWeight.rawValue, UIFont.Weight.semibold.rawValue, accuracy: 0.01)
        XCTAssertEqual(header.expandedTitleMaximumLines, 2)
        XCTAssertLessThan(header.expandedTimingPointSize, header.expandedTitlePointSize)
        XCTAssertEqual(header.expandedTitleBottomInset, 6, accuracy: 0.01)

        header.render(seed: NativeTripOverviewSeed(
            tripID: "localized-long-title",
            title: "San Miguel de Allende y Dolores Hidalgo",
            dateRange: "Aug 11 - Sep 2",
            imageURL: nil,
            fallbackColor: "#50343C"
        ))
        header.layoutIfNeeded()
        XCTAssertEqual(header.expandedTitleMaximumLines, 2)
    }

    func testOverviewHeroGradientRetainsImageUntilLowerRegion() {
        XCTAssertEqual(NativeTripOverviewHeroGradient.locations, [0.0, 0.36, 0.50, 0.62, 0.74, 0.88])
        let colors = NativeTripOverviewHeroGradient.colors(transition: .systemBrown, sheet: .systemPurple, increasedContrast: false)
        XCTAssertEqual(colors.count, 6)
        XCTAssertEqual(colors[0].cgColor.alpha, 0, accuracy: 0.001)
        XCTAssertEqual(colors[1].cgColor.alpha, 0.08, accuracy: 0.001)
        XCTAssertEqual(colors[2].cgColor.alpha, 0.32, accuracy: 0.001)
        XCTAssertEqual(colors[3].cgColor.alpha, 0.72, accuracy: 0.001)
        XCTAssertEqual(colors[4].cgColor.alpha, 1, accuracy: 0.001)
        XCTAssertEqual(colors[5].cgColor.alpha, 1, accuracy: 0.001)
        XCTAssertTrue(colors[5].isEqual(UIColor.systemPurple), "The final fade stop must exactly match the overview surface.")
        XCTAssertGreaterThan(
            NativeTripOverviewHeroGradient.locations[3].doubleValue,
            0.58,
            "The strong neutral fog must begin around the destination metadata."
        )
        XCTAssertEqual(
            NativeTripOverviewHeroGradient.locations.last?.doubleValue ?? -1,
            0.88,
            accuracy: 0.001,
            "The terminal opaque stop must conceal the photograph before the Itinerary boundary."
        )
    }

    func testOverviewHeroOpaqueShadeExpandsUpwardDuringCollapse() {
        let expanded = NativeTripOverviewHeroGradient.locations(progress: 0).map(\.doubleValue)
        let middle = NativeTripOverviewHeroGradient.locations(progress: 0.5).map(\.doubleValue)
        let collapsed = NativeTripOverviewHeroGradient.locations(progress: 1).map(\.doubleValue)

        XCTAssertEqual(expanded, NativeTripOverviewHeroGradient.locations.map(\.doubleValue))
        for index in 1..<expanded.count {
            XCTAssertLessThan(middle[index], expanded[index])
            XCTAssertLessThan(collapsed[index], middle[index])
        }
        XCTAssertEqual(collapsed[4], 0.62, accuracy: 0.001, "The opaque terminal shade must rise without flattening the full hero.")
        XCTAssertEqual(collapsed[0], 0, accuracy: 0.001, "The top remains available beneath the pinned header material.")
    }

    func testTitleCollisionGeometryDrivesOneStableMasterProgress() {
        let initialY: CGFloat = 220
        let targetY: CGFloat = 55
        let distance = NativeTripOverviewTitleCollisionTransition.distance(
            initialCenterY: initialY,
            targetCenterY: targetY
        )

        XCTAssertEqual(distance, 165, accuracy: 0.001)
        XCTAssertEqual(
            NativeTripOverviewTitleCollisionTransition.progress(
                offset: 0,
                initialCenterY: initialY,
                targetCenterY: targetY
            ),
            0,
            accuracy: 0.001
        )
        XCTAssertEqual(
            NativeTripOverviewTitleCollisionTransition.progress(
                offset: distance,
                initialCenterY: initialY,
                targetCenterY: targetY
            ),
            1,
            accuracy: 0.001
        )
    }

    func testStableTransitionGeometryMeasuresTitleLabelsRatherThanStackCenters() {
        let header = NativeTripOverviewHeaderView(
            frame: CGRect(x: 0, y: 0, width: 393, height: AlmidyDesignTokens.TripOverview.expandedHeaderHeight)
        )
        header.render(seed: NativeTripOverviewSeed(
            tripID: "title-geometry",
            title: "New York",
            dateRange: "Aug 15 → Aug 25",
            imageURL: nil,
            fallbackColor: "#737A84"
        ))
        header.layoutIfNeeded()

        let geometry = header.stableTransitionGeometry(
            expandedHeaderHeight: AlmidyDesignTokens.TripOverview.expandedHeaderHeight
        )
        XCTAssertLessThan(
            geometry.compactCenterY,
            header.moreButton.frame.midY,
            "The compact title sits above the center of the complete title/date stack."
        )
        XCTAssertGreaterThan(geometry.expandedCenterY, geometry.compactCenterY)
    }

    func testHeroWashUsesMasterProgressInsteadOfFormerHoldDistance() {
        XCTAssertEqual(NativeTripOverviewHeroGradient.washProgress(progress: 0), 0, accuracy: 0.001)
        XCTAssertGreaterThan(NativeTripOverviewHeroGradient.washProgress(progress: 0.36), 0)
        XCTAssertLessThan(NativeTripOverviewHeroGradient.washProgress(progress: 0.36), 1)
        XCTAssertEqual(NativeTripOverviewHeroGradient.washProgress(progress: 0.94), 1, accuracy: 0.001)
    }

    func testOverviewHeroImageFadesIndependentlyOfPersistentBackdrop() {
        XCTAssertEqual(NativeTripOverviewHeroGradient.imageAlpha(progress: 0), 1, accuracy: 0.001)
        XCTAssertEqual(NativeTripOverviewHeroGradient.imageAlpha(progress: 0.14), 1, accuracy: 0.001)
        XCTAssertEqual(NativeTripOverviewHeroGradient.imageAlpha(progress: 0.56), 0.5, accuracy: 0.001)
        XCTAssertEqual(NativeTripOverviewHeroGradient.imageAlpha(progress: 0.98), 0, accuracy: 0.001)
        XCTAssertEqual(NativeTripOverviewHeroGradient.imageAlpha(progress: 1), 0, accuracy: 0.001)
    }

    func testTitleWashKeepsWhiteTextReadableOverBrightAndDarkPhotos() {
        for source in [UIColor.white, UIColor.black] {
            let palette = NativeTripOverviewHeroColorProcessor.palette(top: source, bottom: source, dominant: source)
            let colors = NativeTripOverviewHeroGradient.colors(
                transition: palette.transition,
                sheet: palette.sheet,
                increasedContrast: false
            )
            let titleSurface = Self.composite(foreground: colors[4], over: source)
            XCTAssertGreaterThanOrEqual(Self.contrastRatio(titleSurface, .white), 4.5)
            XCTAssertTrue(colors[5].isEqual(palette.sheet))
        }
    }

    func testOverviewHeroGradientProducesSafeSurfaceForImageExtremes() {
        for imageColor in [UIColor.white, .black, .systemGray, .systemYellow, .systemPink, .systemBlue] {
            let surface = NativeTripOverviewHeroColorProcessor.mutedSurface(from: imageColor, burgundyBias: 0.10)
            var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
            XCTAssertTrue(surface.getRed(&red, green: &green, blue: &blue, alpha: &alpha))
            var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0
            XCTAssertTrue(surface.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha))
            XCTAssertGreaterThanOrEqual(brightness, 0.38)
            XCTAssertLessThanOrEqual(brightness, 0.53)
            XCTAssertLessThanOrEqual(saturation, 0.22)
            XCTAssertGreaterThanOrEqual(Self.contrastRatio(surface, .white), 4.5)
            XCTAssertEqual(alpha, 1, accuracy: 0.001)
        }
    }

    func testOverviewPaletteSeparatesTopTransitionAndSheetPurposes() {
        let palette = NativeTripOverviewHeroColorProcessor.palette(
            top: UIColor(white: 0.90, alpha: 1),
            bottom: UIColor(red: 0.34, green: 0.30, blue: 0.28, alpha: 1),
            dominant: UIColor(red: 0.54, green: 0.24, blue: 0.30, alpha: 1)
        )

        XCTAssertLessThan(palette.topContrast.cgColor.alpha, 1)
        XCTAssertNotEqual(palette.transition, palette.sheet)
        var sheetHue: CGFloat = 0, sheetSaturation: CGFloat = 0, sheetBrightness: CGFloat = 0, alpha: CGFloat = 0
        XCTAssertTrue(palette.sheet.getHue(&sheetHue, saturation: &sheetSaturation, brightness: &sheetBrightness, alpha: &alpha))
        XCTAssertGreaterThan(sheetSaturation, 0.04, "Barcelona-like burgundy input must retain a restrained destination tint.")
        XCTAssertGreaterThanOrEqual(sheetBrightness, 0.20)
    }

    func testOverviewTerminalSurfaceFollowsLowerImageRegionInsteadOfSkyAverage() {
        let palette = NativeTripOverviewHeroColorProcessor.palette(
            top: UIColor(red: 0.62, green: 0.74, blue: 0.86, alpha: 1),
            bottom: UIColor(red: 0.48, green: 0.34, blue: 0.24, alpha: 1),
            dominant: UIColor(red: 0.42, green: 0.58, blue: 0.76, alpha: 1)
        )

        var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0, alpha: CGFloat = 0
        XCTAssertTrue(palette.sheet.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha))
        XCTAssertLessThan(hue, 0.20, "A warm lower image region must produce a warm terminal fog even when sky dominates the full image.")
        XCTAssertGreaterThan(saturation, 0.04)
        XCTAssertGreaterThanOrEqual(Self.contrastRatio(palette.sheet, .white), 4.5)
    }

    func testOverviewPaletteUsesAlmidyGuardrailWhenSamplingFails() {
        let palette = NativeTripOverviewHeroColorProcessor.palette(top: nil, bottom: nil, dominant: nil)
        XCTAssertEqual(palette.sheet.cgColor.alpha, 1, accuracy: 0.001)
        XCTAssertNotEqual(palette.sheet, UIColor.black)
    }

    private static func contrastRatio(_ first: UIColor, _ second: UIColor) -> CGFloat {
        let firstLuminance = relativeLuminance(first)
        let secondLuminance = relativeLuminance(second)
        return (max(firstLuminance, secondLuminance) + 0.05) / (min(firstLuminance, secondLuminance) + 0.05)
    }

    private static func composite(foreground: UIColor, over background: UIColor) -> UIColor {
        var fr: CGFloat = 0, fg: CGFloat = 0, fb: CGFloat = 0, fa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        guard foreground.getRed(&fr, green: &fg, blue: &fb, alpha: &fa),
              background.getRed(&br, green: &bg, blue: &bb, alpha: &ba) else { return background }
        return UIColor(
            red: (fr * fa) + (br * (1 - fa)),
            green: (fg * fa) + (bg * (1 - fa)),
            blue: (fb * fa) + (bb * (1 - fa)),
            alpha: 1
        )
    }

    private static func relativeLuminance(_ color: UIColor) -> CGFloat {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return 0 }
        func linear(_ component: CGFloat) -> CGFloat {
            component <= 0.04045 ? component / 12.92 : pow((component + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    }

    func testCreateTripStartsWithCuratedDefaultImagery() {
        let context = NativeCreateTripBackgroundContext(
            resolver: nil,
            imageBankResolver: nil
        )

        XCTAssertNotNil(context.genericSelection.identifier)
        XCTAssertFalse(context.genericSelection.isUsingGlobeFallback)
    }

    func testSavedTripBackgroundRemainsAvailableWhenTripIsReopened() {
        let trip = NativeMapTrip(
            id: "image-persistence-\(UUID().uuidString)",
            name: "Tokyo",
            destination: "Tokyo, Japan",
            latitude: 35.6762,
            longitude: 139.6503
        )
        let image = UIImage()

        NativeTripBackgroundImageCache.shared.store(image, for: trip)

        XCTAssertTrue(NativeTripBackgroundImageCache.shared.image(for: trip) === image)
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

    func testTravelImageBankSelectsColosseumForItaly() {
        let colosseum = UIImage()
        let bank = NativeTripTravelImageBank(
            identifiers: ["WonderColosseum"],
            imageLoader: { $0 == "WonderColosseum" ? colosseum : nil },
            globeFallback: nil
        )

        let selection = bank.selectForDestination("Italy")

        XCTAssertEqual(selection?.identifier, "WonderColosseum")
        XCTAssertTrue(selection?.image === colosseum)
        XCTAssertFalse(selection?.isUsingGlobeFallback ?? true)
    }

    func testTravelImageBankSelectsChristRedeemerForBrazilAndRio() {
        let christRedeemer = UIImage()
        let bank = NativeTripTravelImageBank(
            identifiers: ["WonderChristRedeemer"],
            imageLoader: { $0 == "WonderChristRedeemer" ? christRedeemer : nil },
            globeFallback: nil
        )

        XCTAssertEqual(bank.selectForDestination("Brazil")?.identifier, "WonderChristRedeemer")
        XCTAssertEqual(bank.selectForDestination("Rio de Janeiro")?.identifier, "WonderChristRedeemer")
        XCTAssertNil(bank.selectForDestination("Unmapped destination"))
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
        let loadingStarted = expectation(description: "destination lookup started")
        let destinationCompleted = expectation(description: "destination image selected")
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

        controller.schedule(destination: destination, debounce: 0, loading: { isLoading in
            if isLoading { loadingStarted.fulfill() }
        }) {
            completions.append($0)
            destinationCompleted.fulfill()
        }
        wait(for: [loadingStarted], timeout: 1)
        XCTAssertTrue(completions.isEmpty)
        XCTAssertEqual(controller.state.selectionMode, .automaticGeneric)

        resolverCompletion?(URL(string: "https://almidy.app/photo"))
        wait(for: [destinationCompleted], timeout: 1)
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

    func testDestinationFailureUsesMatchingBundledImageWhenAvailable() {
        let italy = UIImage()
        let completed = expectation(description: "Italy fallback")
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in completion(nil) },
            fallbackImage: UIImage(),
            destinationFallback: { destination in
                guard destination == "Italy" else { return nil }
                return NativeTripTravelImageSelection(
                    identifier: "WonderColosseum",
                    image: italy,
                    isUsingGlobeFallback: false
                )
            }
        )

        controller.schedule(
            destination: NativeResolvedDestination(
                title: "Italy",
                coordinate: CLLocationCoordinate2D(latitude: 41.8719, longitude: 12.5674)
            ),
            debounce: 0,
            loading: { _ in }
        ) { image in
            XCTAssertTrue(image === italy)
            completed.fulfill()
        }

        wait(for: [completed], timeout: 1)
        XCTAssertEqual(controller.state.selectionMode, .automaticDestination)
        XCTAssertFalse(controller.state.isUsingGlobeFallback)
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
        let resumed = expectation(description: "download started")
        let cancelled = expectation(description: "download cancelled")
        let controller = NativeTripBackgroundController(
            resolver: { _, completion in completion(URL(string: "https://almidy.app/photo")!) },
            fallbackImage: nil,
            downloader: { _, _ in TestBackgroundTask(onResume: { resumed.fulfill() }, onCancel: { cancelled.fulfill() }) }
        )
        controller.schedule(destination: destination, debounce: 0, loading: { _ in }, completion: { _ in })
        wait(for: [resumed], timeout: 1)
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
