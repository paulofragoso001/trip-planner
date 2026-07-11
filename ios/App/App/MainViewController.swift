import Capacitor
import WebKit

final class MainViewController: CAPBridgeViewController {
    private var didInstallLocationOverlayBlocker = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.webView?.customUserAgent = "AlmidyNativeApp/1.0"
        installLocationOverlayBlocker()
        let mapGatewayPlugin = MapGatewayPlugin()
        let nativeMapPlugin = NativeMapPlugin()
        nativeMapPlugin.mapGatewayPlugin = mapGatewayPlugin
        bridge?.registerPluginInstance(mapGatewayPlugin)
        bridge?.registerPluginInstance(nativeMapPlugin)
        bridge?.registerPluginInstance(AppleCalendarPlugin())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        installLocationOverlayBlocker()
        applyLocationOverlayBlocker()
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
