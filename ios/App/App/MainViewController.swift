import Capacitor
import Network
import os
import WebKit

enum NativeWebRoutePolicy {
    static let allowedPrefixes = [
        "/login",
        "/dashboard/imports",
        "/dashboard/help",
        "/dashboard/account",
    ]

    static func allows(_ route: String) -> Bool {
        guard route.hasPrefix("/") && !route.hasPrefix("//"),
              let url = URL(string: route) else {
            return false
        }
        return allows(url)
    }

    static func allows(_ url: URL) -> Bool {
        guard url.host == nil || url.host == NativeServiceConfiguration.appHost,
              url.path == "/login" || url.path.hasPrefix("/dashboard/") else {
            return false
        }
        if url.path == "/login" { return true }
        return allowedPrefixes.contains { url.path.hasPrefix($0) }
    }

    static func isNativeOwned(_ url: URL) -> Bool {
        guard url.host == nil || url.host == NativeServiceConfiguration.appHost else { return false }
        let path = url.path
        return path == "/dashboard" ||
            path.hasPrefix("/dashboard/trips") ||
            path.hasPrefix("/dashboard/search") ||
            path.hasPrefix("/dashboard/globe") ||
            path.hasPrefix("/dashboard/wallet")
    }
}

enum NativeWebFeatureResult {
    case dismissed
    case tripDataChanged
    case importCompleted
}

struct NativeWebAuthStorage {
    let key: String
    let value: String
    let cookieHeader: String
}

final class MainViewController: CAPBridgeViewController {
    private var didInstallLocationOverlayBlocker = false
    private var nativeDashboardController: NativeMapViewController?
    private var didPresentNativeDashboard = false
    private var nativeTripStore: NativeTripStore?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Preserve the mobile signal used by the server route guard while
        // adding a stable marker for native-only wallet presentation.
        bridge?.webView?.customUserAgent = "AlmidyNativeApp/1.0 Mobile iPhone"
        installLocationOverlayBlocker()
        let mapGatewayPlugin = MapGatewayPlugin()
        let nativeMapPlugin = NativeMapPlugin()
        nativeMapPlugin.mapGatewayPlugin = mapGatewayPlugin
        nativeTripStore = NativeTripStore(webView: bridge?.webView)
        bridge?.registerPluginInstance(mapGatewayPlugin)
        bridge?.registerPluginInstance(nativeMapPlugin)
        bridge?.registerPluginInstance(AppleCalendarPlugin())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        installLocationOverlayBlocker()
        applyLocationOverlayBlocker()
        presentNativeDashboardIfNeeded()
    }

    private func presentNativeDashboardIfNeeded() {
        guard !didPresentNativeDashboard,
              presentedViewController == nil,
              bridge != nil else { return }

        didPresentNativeDashboard = true
        let dashboard = NativeMapViewController(
            trips: [],
            tripStore: nativeTripStore,
            sourceWebView: bridge?.webView
        )
        dashboard.modalPresentationStyle = .fullScreen
        nativeDashboardController = dashboard
        present(dashboard, animated: false)
    }

    private func installLocationOverlayBlocker() {
        guard !didInstallLocationOverlayBlocker, let webView = bridge?.webView else { return }

        let script = WKUserScript(
            source: locationOverlayBlockerSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        webView.configuration.userContentController.addUserScript(script)
        didInstallLocationOverlayBlocker = true
        applyLocationOverlayBlocker()
    }

    private func applyLocationOverlayBlocker() {
        bridge?.webView?.evaluateJavaScript(locationOverlayBlockerSource)
    }

    private var locationOverlayBlockerSource: String {
        """
        (() => {
            if (!document.documentElement) {
                return;
            }

            const removeLocationOverlay = () => {
                const selectors = [
                    "[data-testid='launch-location-permission']",
                    "[aria-labelledby='launch-location-title']",
                    "#launch-location-title"
                ];

                for (const selector of selectors) {
                    document.querySelectorAll(selector).forEach((element) => {
                        const overlay = element.closest("[data-testid='launch-location-permission'], [role='dialog'], section") || element;
                        overlay.remove();
                    });
                }

                document.querySelectorAll("section,div").forEach((element) => {
                    const text = element.textContent || "";
                    if (
                        text.includes('Allow "Almidy" to use your location?') &&
                        text.includes("Show your location on the globe")
                    ) {
                        element.remove();
                    }
                });
            };

            if (!document.getElementById("almidy-location-overlay-blocker")) {
                const style = document.createElement("style");
                style.id = "almidy-location-overlay-blocker";
                style.textContent = [
                    "[data-testid='launch-location-permission']",
                    "[aria-labelledby='launch-location-title']"
                ].join(",") + "{display:none!important;pointer-events:none!important;}";
                document.documentElement.appendChild(style);
            }

            if (!window.__almidyLocationOverlayBlockerInstalled) {
                window.__almidyLocationOverlayBlockerInstalled = true;
                window.addEventListener("wayline:home-use-current-location", (event) => {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    removeLocationOverlay();
                }, true);

                new MutationObserver(removeLocationOverlay).observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });
            }

            removeLocationOverlay();
        })();
        """
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestGeolocationPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.deny)
    }
}

final class NativeWebFeatureViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let logger = Logger(subsystem: "app.almidy", category: "native-web-feature")
    private let route: String
    private let featureTitle: String
    private let onFinish: (NativeWebFeatureResult) -> Void
    private let onNativeRoute: (String) -> Void
    private let authStorage: NativeWebAuthStorage?
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "app.almidy.native-web-feature.network")
    private let webView: WKWebView
    private let loadingView = UIActivityIndicatorView(style: .medium)
    private let statusLabel = UILabel()
    private let retryButton = UIButton(type: .system)
    private var isOffline = false
    private var didFinish = false
    private var pendingResult: NativeWebFeatureResult = .dismissed
    private var pendingNativeRoute: String?
    private var contentDiagnosticWorkItem: DispatchWorkItem?

    init(
        route: String,
        title: String,
        onFinish: @escaping (NativeWebFeatureResult) -> Void = { _ in },
        onNativeRoute: @escaping (String) -> Void = { _ in },
        authStorage: NativeWebAuthStorage? = nil
    ) {
        self.route = route
        self.featureTitle = title
        self.onFinish = onFinish
        self.onNativeRoute = onNativeRoute
        self.authStorage = authStorage
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        self.webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
    }

    static func wrapped(
        route: String,
        title: String,
        onFinish: @escaping (NativeWebFeatureResult) -> Void = { _ in },
        onNativeRoute: @escaping (String) -> Void = { _ in },
        authStorage: NativeWebAuthStorage? = nil
    ) -> UINavigationController {
        let controller = NativeWebFeatureViewController(
            route: route,
            title: title,
            onFinish: onFinish,
            onNativeRoute: onNativeRoute,
            authStorage: authStorage
        )
        let navigationController = UINavigationController(rootViewController: controller)
        navigationController.modalPresentationStyle = .pageSheet
        if let sheet = navigationController.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        return navigationController
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureNavigation()
        configureWebView()
        configureStateViews()
        startNetworkMonitoring()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed || navigationController?.isBeingDismissed == true {
            monitor.cancel()
            finish(pendingResult)
        }
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nativeWebFeature")
        contentDiagnosticWorkItem?.cancel()
        monitor.cancel()
    }

    private func configureNavigation() {
        title = featureTitle
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(close)
        )
    }

    private func configureWebView() {
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.configuration.userContentController.add(self, name: "nativeWebFeature")
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func configureStateViews() {
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        retryButton.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.textAlignment = .center
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 0
        statusLabel.isHidden = true

        retryButton.setTitle("Retry", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)
        retryButton.isHidden = true

        view.addSubview(loadingView)
        view.addSubview(statusLabel)
        view.addSubview(retryButton)
        NSLayoutConstraint.activate([
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -24),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
            retryButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 16),
            retryButton.centerXAnchor.constraint(equalTo: view.centerXAnchor)
        ])
    }

    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isOffline = path.status != .satisfied
                if self.isOffline {
                    self.showState("You’re offline. This page needs an internet connection.", loading: false, retry: false)
                } else if self.webView.url == nil {
                    self.loadRoute()
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    private func loadRoute() {
        guard NativeWebRoutePolicy.allows(route), !isOffline else { return }
        guard let url = URL(string: route, relativeTo: NativeServiceConfiguration.appBaseURL) else {
            showState("This page could not be opened.", loading: false, retry: false)
            return
        }
        showState(nil, loading: true, retry: false)
        logger.info("Loading secondary route: \(self.route, privacy: .public)")
        guard let authStorage else {
            webView.load(URLRequest(url: url))
            return
        }
        let keyBase64 = Data(authStorage.key.utf8).base64EncodedString()
        let valueBase64 = Data(authStorage.value.utf8).base64EncodedString()
        let cookieBase64 = Data(authStorage.cookieHeader.utf8).base64EncodedString()
        let script = """
        (() => {
            const decode = (value) => decodeURIComponent(escape(atob(value)));
            localStorage.setItem(decode('\(keyBase64)'), decode('\(valueBase64)'));
            const cookies = decode('\(cookieBase64)').split(';');
            for (const cookie of cookies) {
                const separator = cookie.indexOf('=');
                if (separator > 0) document.cookie = cookie.trim() + '; path=/';
            }
        })()
        """
        webView.evaluateJavaScript(script) { [weak self] _, _ in
            self?.webView.load(URLRequest(url: url))
        }
    }

    static func exportAuthStorage(from webView: WKWebView, completion: @escaping (NativeWebAuthStorage?) -> Void) {
        let script = """
        (() => {
            const storage = (() => {
                const stores = [localStorage, sessionStorage];
                for (const store of stores) {
                    for (const key of Object.keys(store)) {
                        if (!key.includes('auth-token')) continue;
                        const value = store.getItem(key);
                        if (value) return { key, value };
                    }
                }
                return { key: '', value: '' };
            })();
            storage.cookieHeader = document.cookie || '';
            return JSON.stringify(storage);
            /*
            for (const key of Object.keys(localStorage)) {
                if (!key.includes('-auth-token')) continue;
                const value = localStorage.getItem(key);
                if (value) return JSON.stringify({ key, value });
            }
            return null;
            */
        })()
        """
        webView.evaluateJavaScript(script) { result, _ in
            guard let json = result as? String,
                  let data = json.data(using: .utf8),
                  let payload = try? JSONDecoder().decode(NativeWebAuthStoragePayload.self, from: data) else {
                completion(nil)
                return
            }
            completion(NativeWebAuthStorage(key: payload.key, value: payload.value, cookieHeader: payload.cookieHeader))
        }
    }

    private func showState(_ message: String?, loading: Bool, retry: Bool) {
        loadingView.isHidden = !loading
        if loading {
            loadingView.startAnimating()
        } else {
            loadingView.stopAnimating()
        }
        statusLabel.text = message
        statusLabel.isHidden = message == nil
        retryButton.isHidden = !retry
        webView.isHidden = loading || message != nil
    }

    @objc private func close() {
        if webView.canGoBack {
            webView.goBack()
        } else {
            finish(.dismissed)
        }
    }

    @objc private func retry() {
        loadRoute()
    }

    private func showSessionExpired() {
        logger.warning("Secondary route redirected to login")
        showState("Your Almidy session has expired. Sign in again to continue.", loading: false, retry: false)
    }

    private func scheduleContentDiagnostic() {
        contentDiagnosticWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            self?.diagnoseLoadedDocument()
        }
        contentDiagnosticWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: workItem)
    }

    private func diagnoseLoadedDocument() {
        let script = """
        JSON.stringify({
            readyState: document.readyState,
            href: window.location.href,
            title: document.title,
            bodyTextLength: (document.body?.innerText || '').trim().length,
            bodyHTMLLength: (document.body?.innerHTML || '').length
        })
        """
        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard let self else { return }
            if let error {
                self.logger.error("Document diagnostic failed: \(error.localizedDescription, privacy: .public)")
                return
            }
            self.logger.info("Document diagnostic: \(String(describing: result), privacy: .public)")
            guard let json = result as? String,
                  let data = json.data(using: .utf8),
                  let diagnostic = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let textLength = diagnostic["bodyTextLength"] as? Int,
                  let htmlLength = diagnostic["bodyHTMLLength"] as? Int else { return }
            if textLength == 0 && htmlLength < 100 {
                self.logger.error("Secondary route finished with an empty document")
                self.showState("This page loaded without content.", loading: false, retry: true)
            }
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        logger.info("Secondary navigation started: \(webView.url?.absoluteString ?? "unknown", privacy: .public)")
        showState(nil, loading: true, retry: false)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        logger.info("Secondary navigation committed: \(webView.url?.absoluteString ?? "unknown", privacy: .public)")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.info("Secondary navigation finished: \(webView.url?.absoluteString ?? "unknown", privacy: .public)")
        showState(nil, loading: false, retry: false)
        scheduleContentDiagnostic()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        logger.error("Secondary navigation failed: \(error.localizedDescription, privacy: .public)")
        showState("This page could not be loaded.", loading: false, retry: true)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        logger.error("Secondary provisional navigation failed: \(error.localizedDescription, privacy: .public)")
        showState("This page could not be loaded.", loading: false, retry: true)
    }

    func webView(_ webView: WKWebView, didReceiveServerRedirectForProvisionalNavigation navigation: WKNavigation!) {
        logger.info("Secondary server redirect: \(webView.url?.absoluteString ?? "unknown", privacy: .public)")
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.path == "/login" {
            showSessionExpired()
            decisionHandler(.cancel)
            return
        }
        if NativeWebRoutePolicy.isNativeOwned(url) {
            pendingNativeRoute = url.path
            finish(.dismissed)
            decisionHandler(.cancel)
            return
        }
        guard url.host == nil || url.host == NativeServiceConfiguration.appHost else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(NativeWebRoutePolicy.allows(url) ? .allow : .cancel)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeWebFeature",
              let payload = message.body as? [String: Any],
              let type = payload["type"] as? String else { return }
        switch type {
        case "tripDataChanged":
            pendingResult = .tripDataChanged
        case "importCompleted":
            pendingResult = .importCompleted
        case "dismiss":
            finish(.dismissed)
        default:
            break
        }
    }

    private func finish(_ result: NativeWebFeatureResult) {
        guard !didFinish else { return }
        didFinish = true
        pendingResult = result
        dismiss(animated: true) { [onFinish] in
            onFinish(result)
            if let nativeRoute = self.pendingNativeRoute {
                self.onNativeRoute(nativeRoute)
            }
        }
    }
}

private struct NativeWebAuthStoragePayload: Decodable {
    let key: String
    let value: String
    let cookieHeader: String
}
