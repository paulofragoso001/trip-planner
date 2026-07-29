import UIKit

final class NativeCreateTripLayoutContext {
    let scrollView = UIScrollView()
    let contentView = UIView()
}

extension NativeCreateTripViewController {
    func configureFormLayout() {
        let scrollView = layoutContext.scrollView
        let contentView = layoutContext.contentView
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.backgroundColor = .clear
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(contentView)

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Cancel", for: .normal)
        closeButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.backgroundColor = AlmidyDesignTokens.Color.modalDimmingBackground
        closeButton.layer.cornerRadius = 24
        closeButton.contentEdgeInsets = UIEdgeInsets(top: 0, left: 22, bottom: 0, right: 22)
        closeButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        closeButton.accessibilityLabel = "Cancel trip editing"

        configureNameField()
        configureDatePresentation()

        locationStatus.font = .systemFont(ofSize: 14, weight: .medium)
        locationStatus.textColor = AlmidyDesignTokens.Color.tripCardTextTertiary
        locationStatus.textAlignment = .center
        locationStatus.numberOfLines = 0
        locationStatus.isAccessibilityElement = true
        locationStatus.isHidden = true

        suggestionTable.register(UITableViewCell.self, forCellReuseIdentifier: "suggestion")
        suggestionTable.dataSource = self
        suggestionTable.delegate = self
        suggestionTable.isHidden = true
        suggestionTable.backgroundColor = UIColor.white.withAlphaComponent(0.94)
        suggestionTable.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        suggestionTable.layer.masksToBounds = true
        suggestionTable.rowHeight = 68

        var createConfiguration = UIButton.Configuration.filled()
        createConfiguration.title = existingTrip == nil ? "Create Trip" : "Save Changes"
        createConfiguration.baseForegroundColor = .white
        createConfiguration.baseBackgroundColor = AlmidyDesignTokens.Color.gold
        createConfiguration.cornerStyle = .capsule
        createConfiguration.contentInsets = NSDirectionalEdgeInsets(
            top: 0,
            leading: 22,
            bottom: 0,
            trailing: 22
        )
        createConfiguration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = AlmidyDesignTokens.Font.button(17)
            return outgoing
        }
        createButton.configuration = createConfiguration
        createButton.addTarget(self, action: #selector(create), for: .touchUpInside)
        createButton.accessibilityLabel = existingTrip == nil ? "Create trip" : "Save trip changes"

        let datesButton = dateContext.button!
        let backgroundButton = makeFeaturedOptionButton(
            title: "Background",
            systemName: "photo",
            action: #selector(selectBackground)
        )
        backgroundButton.accessibilityLabel = "Choose trip background"
        let divider = UIView()
        divider.backgroundColor = UIColor.white.withAlphaComponent(0.52)
        divider.translatesAutoresizingMaskIntoConstraints = false
        let featuredActions = UIStackView(arrangedSubviews: [datesButton, divider, backgroundButton])
        featuredActions.axis = .horizontal
        featuredActions.alignment = .fill
        featuredActions.distribution = .fill
        datesButton.widthAnchor.constraint(equalTo: backgroundButton.widthAnchor).isActive = true
        divider.widthAnchor.constraint(equalToConstant: 1).isActive = true

        let dateSummary = UIStackView(arrangedSubviews: [
            dateContext.durationLabel,
            dateContext.summaryLabel
        ])
        dateSummary.axis = .vertical
        dateSummary.spacing = 4

        let fields = UIStackView(arrangedSubviews: [
            nameField,
            locationStatus,
            suggestionTable,
            dateSummary,
            featuredActions
        ])
        fields.axis = .vertical
        fields.spacing = 14
        fields.translatesAutoresizingMaskIntoConstraints = false

        contentView.addSubview(closeButton)
        contentView.addSubview(createButton)
        contentView.addSubview(fields)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        createButton.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            closeButton.topAnchor.constraint(equalTo: contentView.safeAreaLayoutGuide.topAnchor, constant: 16),
            closeButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            closeButton.heightAnchor.constraint(equalToConstant: 48),
            createButton.topAnchor.constraint(equalTo: closeButton.topAnchor),
            createButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            createButton.heightAnchor.constraint(equalToConstant: 48),
            fields.topAnchor.constraint(greaterThanOrEqualTo: closeButton.bottomAnchor, constant: 60),
            fields.centerYAnchor.constraint(equalTo: contentView.centerYAnchor, constant: 88),
            fields.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            fields.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 28),
            fields.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -28),
            fields.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.formMaxWidth),
            NativeAdaptiveLayout.preferredWidth(fields, equalTo: contentView.widthAnchor, constant: -56),
            fields.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20),
            nameField.heightAnchor.constraint(equalToConstant: 72),
            featuredActions.heightAnchor.constraint(greaterThanOrEqualToConstant: 82)
        ])

        let suggestionsHeight = suggestionTable.heightAnchor.constraint(equalToConstant: 272)
        suggestionsHeight.priority = .defaultHigh
        suggestionsHeight.isActive = true
        updateCreateState()
    }

    func updateCreateTripLayout() {
        updateBackgroundLayout()
    }

    func makeFeaturedOptionButton(title: String, systemName: String, action: Selector) -> UIButton {
        var configuration = UIButton.Configuration.plain()
        configuration.image = UIImage(systemName: systemName)
        configuration.imagePlacement = .top
        configuration.imagePadding = 8
        configuration.title = title
        configuration.baseForegroundColor = AlmidyDesignTokens.Color.tripCardTextSecondary
        configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = AlmidyDesignTokens.Font.button(17)
            return outgoing
        }
        let button = UIButton(configuration: configuration)
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }
}
