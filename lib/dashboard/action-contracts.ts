export { dashboardActionRoutes } from "./action-routes";

export type DashboardActionKind =
  | "navigation-only"
  | "client-ui-state"
  | "authenticated-mutation"
  | "external-service";

export type DashboardActionAuth = "none" | "dashboard-session" | "dashboard-session-or-test-bypass";

export type DashboardActionPermission =
  | "public"
  | "signed-in-user"
  | "trip-owner"
  | "admin"
  | "browser-geolocation"
  | "external-provider";

export type DashboardActionContract = {
  id: string;
  label: string;
  kind: DashboardActionKind;
  surface: string;
  selectorHint: string;
  intendedFunction: string;
  target: {
    type: "route" | "api" | "server-action" | "client-event" | "local-state" | "external" | "none";
    value: string;
  };
  requiredAuth: DashboardActionAuth;
  requiredPermissions: DashboardActionPermission[];
  expectedSuccessUi: string;
  expectedFailureUi: string;
};

export const dashboardActionContracts = [
  {
    id: "dashboard-shell-primary-nav",
    label: "Home / Trips / Plan",
    kind: "navigation-only",
    surface: "DashboardNav and DashboardSidebar",
    selectorHint: 'nav[aria-label="Dashboard"], nav[aria-label="Dashboard sidebar"]',
    intendedFunction: "Move between the core dashboard workspace sections.",
    target: { type: "route", value: "/dashboard, /dashboard/trips, /dashboard/plan" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "The destination dashboard section loads and the active link receives aria-current=page.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users to login."
  },
  {
    id: "dashboard-account-settings",
    label: "Account settings",
    kind: "navigation-only",
    surface: "Dashboard user menu, test user menu, and mobile launch settings",
    selectorHint: 'role=link[name="Account settings"]',
    intendedFunction: "Open account trust, legal, and deletion controls.",
    target: { type: "route", value: "/dashboard/account" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Account page loads with legal links and account deletion request controls.",
    expectedFailureUi: "Unauthenticated users are redirected to login unless a local/test dashboard bypass is active."
  },
  {
    id: "account-legal-links",
    label: "Privacy Policy / Terms of Service",
    kind: "navigation-only",
    surface: "Dashboard account page",
    selectorHint: 'role=link[name=/Privacy Policy|Terms of Service/]',
    intendedFunction: "Open public legal documents from account controls.",
    target: { type: "route", value: "/privacy, /terms" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["public"],
    expectedSuccessUi: "Selected legal document route loads.",
    expectedFailureUi: "Route-level error page appears if the document route fails."
  },
  {
    id: "first-run-try-sample",
    label: "Try sample",
    kind: "navigation-only",
    surface: "First-run onboarding",
    selectorHint: 'data-testid=first-run-onboarding role=link[name="Try sample"]',
    intendedFunction: "Open the planning surface with a seeded Miami sample idea.",
    target: { type: "route", value: "/dashboard/plan?sample=miami#saved-inspiration" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Plan page opens at saved inspiration with sample context available.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "first-run-add-own-idea",
    label: "Add my own idea",
    kind: "navigation-only",
    surface: "First-run onboarding",
    selectorHint: 'data-testid=first-run-onboarding role=link[name="Add my own idea"]',
    intendedFunction: "Open saved inspiration so the user can add their own idea.",
    target: { type: "route", value: "/dashboard/plan#saved-inspiration" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Plan page opens at saved inspiration input/review area.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "first-run-skip",
    label: "Skip for now",
    kind: "client-ui-state",
    surface: "First-run onboarding",
    selectorHint: 'data-testid=first-run-onboarding role=button[name="Skip for now"]',
    intendedFunction: "Dismiss first-run onboarding for the current browser session.",
    target: { type: "local-state", value: "sessionStorage wayline:first-run-dismissed=true" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "First-run onboarding section disappears for the session.",
    expectedFailureUi: "No network failure path; section remains visible if sessionStorage is unavailable."
  },
  {
    id: "desktop-home-primary-cta",
    label: "Continue trip / Create your first trip",
    kind: "navigation-only",
    surface: "Desktop dashboard hero",
    selectorHint: "data-testid=home-primary-cta",
    intendedFunction: "Open the latest trip or start the first-trip flow.",
    target: { type: "route", value: "latest trip href or /dashboard/trips#new-trip" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Trip workspace or new-trip section is visible.",
    expectedFailureUi: "Missing/unauthorized trip is handled by the destination route auth boundary."
  },
  {
    id: "desktop-home-start-planning",
    label: "Start planning",
    kind: "navigation-only",
    surface: "Desktop dashboard hero and trips shell",
    selectorHint: 'role=link[name="Start planning"]',
    intendedFunction: "Open the planning workspace.",
    target: { type: "route", value: "/dashboard/plan" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Plan page loads.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "desktop-home-add-idea",
    label: "Add idea",
    kind: "navigation-only",
    surface: "HomeSmartStart and desktop dashboard card stack",
    selectorHint: 'role=link[name="Add idea"]',
    intendedFunction: "Open the planning workspace for adding saved inspiration.",
    target: { type: "route", value: "/dashboard/plan" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Plan page loads with idea entry/review surfaces available.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "desktop-latest-trip-links",
    label: "Latest trip / Recent trip / Open trip pass",
    kind: "navigation-only",
    surface: "Desktop dashboard and trips wallet",
    selectorHint: 'data-testid=latest-trip-pass or role=link[name="Open trip pass"]',
    intendedFunction: "Open a selected trip pass/workspace.",
    target: { type: "route", value: "/dashboard/trips/:tripId" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Selected trip workspace loads.",
    expectedFailureUi: "Unauthorized/missing trip is rejected by destination route auth/data loading."
  },
  {
    id: "desktop-view-all-trips",
    label: "View all trips",
    kind: "navigation-only",
    surface: "Desktop dashboard recent trips card",
    selectorHint: 'role=link[name="View all trips"]',
    intendedFunction: "Open the trips list/wallet.",
    target: { type: "route", value: "/dashboard/trips" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Trips page loads with trip passes or first-trip state.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "desktop-create-trip-anchor",
    label: "Create trip / Create another trip pass",
    kind: "client-ui-state",
    surface: "Desktop trips page",
    selectorHint: 'href="#new-trip" or data-testid=desktop-create-another-trip',
    intendedFunction: "Jump to or reveal the trip creation form.",
    target: { type: "local-state", value: "#new-trip anchor or details[open]" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Trip creation form is visible.",
    expectedFailureUi: "No network failure path until the create form is submitted."
  },
  {
    id: "trip-edit-toggle",
    label: "Edit / Close edit",
    kind: "client-ui-state",
    surface: "Trip row actions",
    selectorHint: 'role=button[name=/Edit|Close edit/]',
    intendedFunction: "Open or close inline trip editing controls.",
    target: { type: "local-state", value: "editing true|false" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Inline edit form appears or closes.",
    expectedFailureUi: "No network failure path until Save changes is submitted."
  },
  {
    id: "mobile-launch-search",
    label: "Search",
    kind: "navigation-only",
    surface: "Mobile dashboard launch sheet",
    selectorHint: 'role=link[name="Search"]',
    intendedFunction: "Open dashboard search.",
    target: { type: "route", value: "/dashboard/search" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Search page loads with mobile topbar hidden and search input available.",
    expectedFailureUi: "Unauthenticated users are redirected to login by the dashboard boundary."
  },
  {
    id: "mobile-launch-continue-trip",
    label: "Continue trip",
    kind: "navigation-only",
    surface: "Mobile dashboard launch sheet",
    selectorHint: 'role=link[name=/Continue trip|Create trip/]',
    intendedFunction: "Open the most recent trip pass, or start the new trip flow when no trip exists.",
    target: { type: "route", value: "latest trip href or /dashboard/trips#new-trip" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Trip workspace or trip creation section is visible.",
    expectedFailureUi: "Missing/unauthorized trip is handled by the destination route auth boundary."
  },
  {
    id: "mobile-launch-add",
    label: "Add",
    kind: "navigation-only",
    surface: "Mobile dashboard launch sheet",
    selectorHint: 'role=link[name="Add"]',
    intendedFunction: "Open new trip creation.",
    target: { type: "route", value: "/dashboard/trips#new-trip" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Trip creation form is reachable and focusable.",
    expectedFailureUi: "Unauthenticated users are redirected to login."
  },
  {
    id: "mobile-globe-open-map",
    label: "Open map",
    kind: "navigation-only",
    surface: "Mobile globe controls",
    selectorHint: 'role=link[name="Open map"]',
    intendedFunction: "Open the map route for the current/latest trip context.",
    target: { type: "route", value: "/dashboard/map" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Map route redirects to a trip map or shows the empty map wallet state.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-globe-use-current-location",
    label: "Use current location",
    kind: "client-ui-state",
    surface: "Mobile globe controls",
    selectorHint: 'role=button[name="Use current location"]',
    intendedFunction: "Ask the globe layer to recenter on the browser/user location.",
    target: { type: "client-event", value: "wayline:home-use-current-location" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["browser-geolocation"],
    expectedSuccessUi: "Globe recenters and the location pin/label updates when geolocation is available.",
    expectedFailureUi: "Globe remains usable and may retain fallback/default camera if permission is denied."
  },
  {
    id: "mobile-launch-expand-collapse",
    label: "My Trips / sheet handle",
    kind: "client-ui-state",
    surface: "Mobile dashboard launch sheet",
    selectorHint: 'data-testid=ios-launch-sheet-handle',
    intendedFunction: "Toggle the trips sheet between collapsed and expanded views.",
    target: { type: "local-state", value: "sheetState collapsed|expanded" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Sheet data-sheet-state changes and expanded content appears/disappears.",
    expectedFailureUi: "No network failure path; interaction should remain accessible by click/tap."
  },
  {
    id: "mobile-launch-settings-open-close",
    label: "Open settings / Close settings",
    kind: "client-ui-state",
    surface: "Mobile dashboard launch settings",
    selectorHint: 'role=button[name=/Open settings|Close settings/]',
    intendedFunction: "Open and close the mobile settings panel within the launch sheet.",
    target: { type: "local-state", value: "sheetState settings|collapsed" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Settings panel appears with Pro, Automations, Customize, Help Center, and About sections.",
    expectedFailureUi: "No network failure path; focus should stay in the visible sheet controls."
  },
  {
    id: "mobile-launch-review-places",
    label: "Review places",
    kind: "navigation-only",
    surface: "Mobile dashboard launch expanded sheet",
    selectorHint: 'role=link[name="Review places"]',
    intendedFunction: "Open the planning review queue for saved/imported places.",
    target: { type: "route", value: "/dashboard/plan#ai-review" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Plan page opens at the AI review/saved inspiration area.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-launch-add-idea",
    label: "Add idea",
    kind: "navigation-only",
    surface: "Mobile dashboard launch expanded sheet",
    selectorHint: 'role=link[name="Add idea"]',
    intendedFunction: "Open the planning capture area for a note, link, screenshot, or place idea.",
    target: { type: "route", value: "/dashboard/plan#saved-inspiration" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Plan page opens at the saved inspiration capture area.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-launch-travel-book",
    label: "Travel Book",
    kind: "navigation-only",
    surface: "Mobile dashboard launch expanded sheet",
    selectorHint: 'role=link[name="Travel Book"]',
    intendedFunction: "Open travel stats/profile book.",
    target: { type: "route", value: "/dashboard/profile/stats" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Travel stats page is visible.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-launch-forward-reservation",
    label: "Forward Your Reservation",
    kind: "navigation-only",
    surface: "Mobile dashboard launch email automation card",
    selectorHint: 'role=link[name="Forward Your Reservation"]',
    intendedFunction: "Open imports/reservations workflow.",
    target: { type: "route", value: "/dashboard/imports" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Imports page opens with reservation import actions.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "dashboard-create-trip",
    label: "Create trip",
    kind: "authenticated-mutation",
    surface: "HomeSmartStart and TripCreateForm",
    selectorHint: 'data-testid=home-smart-create-trip or data-testid=mobile-trip-create-form',
    intendedFunction: "Create a trip from user-entered destination/date/style data.",
    target: { type: "api", value: "POST /api/trips" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "User is redirected to the new trip workspace or the page refreshes with the new trip visible.",
    expectedFailureUi: "Inline action error is announced and the form remains editable."
  },
  {
    id: "dashboard-edit-trip",
    label: "Save changes",
    kind: "authenticated-mutation",
    surface: "Trip row actions",
    selectorHint: 'role=button[name="Save changes"]',
    intendedFunction: "Update trip metadata, destination, dates, and travel style.",
    target: { type: "api", value: "PATCH /api/trips/:id" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Edit form closes and refreshed trip data is displayed.",
    expectedFailureUi: "Inline error message is shown and unsaved form values remain available."
  },
  {
    id: "dashboard-delete-trip",
    label: "Delete / Delete trip",
    kind: "authenticated-mutation",
    surface: "Trip row actions",
    selectorHint: 'role=button[name=/Delete|Delete trip/]',
    intendedFunction: "Delete a trip owned by the current user.",
    target: { type: "api", value: "DELETE /api/trips/:id" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "After inline confirmation, page refreshes and deleted trip is removed from lists.",
    expectedFailureUi: "Confirmation can be canceled; failed deletes roll back the optimistic removal and show an inline error."
  },
  {
    id: "trip-segment-delete",
    label: "Delete / Confirm delete",
    kind: "authenticated-mutation",
    surface: "Trip itinerary item actions",
    selectorHint: 'role=button[name="Delete"] then role=button[name="Confirm delete"]',
    intendedFunction: "Delete an itinerary item owned through the current user's trip.",
    target: { type: "api", value: "DELETE /api/trip-segments/:id" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "After inline confirmation, the itinerary item is removed on refresh.",
    expectedFailureUi: "Confirmation can be canceled; failed deletes keep the item visible and show an inline error."
  },
  {
    id: "budget-record-delete",
    label: "Delete budget record",
    kind: "authenticated-mutation",
    surface: "Budget record actions",
    selectorHint: "Budget record delete control",
    intendedFunction: "Delete a user-owned budget record.",
    target: { type: "api", value: "DELETE /api/budget-records/:id" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "After confirmation, the budget record is removed from the budget list.",
    expectedFailureUi: "Failed deletes keep the record visible and show a user-safe error."
  },
  {
    id: "dashboard-sign-out",
    label: "Sign out",
    kind: "authenticated-mutation",
    surface: "Dashboard user menu",
    selectorHint: 'form[action=signOut] button',
    intendedFunction: "End the authenticated session.",
    target: { type: "server-action", value: "signOut" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Session ends and user returns to an unauthenticated route/login state.",
    expectedFailureUi: "Server action failure should keep user in place or show framework error boundary."
  },
  {
    id: "settings-notification-preferences",
    label: "Notification preferences",
    kind: "authenticated-mutation",
    surface: "Account notification settings",
    selectorHint: "NotificationSettings checkbox inputs",
    intendedFunction: "Update email and in-app notification preferences for the signed-in user.",
    target: { type: "api", value: "POST /api/preferences" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Toggle remains in the selected state after the preference save succeeds.",
    expectedFailureUi: "Toggle rolls back, button state re-enables, and a user-safe error is shown."
  },
  {
    id: "settings-notifications-read",
    label: "Notifications / mark read",
    kind: "authenticated-mutation",
    surface: "Dashboard notification bell",
    selectorHint: 'role=button[name="Notifications"]',
    intendedFunction: "Open the notification panel and mark current user notifications as read.",
    target: { type: "api", value: "POST /api/notifications/read or PATCH /api/notifications" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Notification panel opens and unread badges clear.",
    expectedFailureUi: "Optimistic read state rolls back while the panel remains usable."
  },
  {
    id: "dashboard-refresh",
    label: "Refresh",
    kind: "client-ui-state",
    surface: "Router refresh button",
    selectorHint: "RouterRefreshButton",
    intendedFunction: "Refresh server-rendered dashboard data.",
    target: { type: "local-state", value: "router.refresh()" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Current route refreshes without navigation.",
    expectedFailureUi: "No explicit error UI; route remains on current page."
  },
  {
    id: "mobile-trips-map-list-toggle",
    label: "Show trip cards / View all trip cards",
    kind: "navigation-only",
    surface: "Mobile trips country map",
    selectorHint: 'role=link[name=/Show trip cards|View all trip cards/]',
    intendedFunction: "Switch from map-first trips view to list/card trips view.",
    target: { type: "route", value: "/dashboard/trips?view=list" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Mobile trips wallet list is visible with search and trip cards or first-trip state.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-trips-create-panel-toggle",
    label: "Create trip / Close trip setup",
    kind: "client-ui-state",
    surface: "Mobile trips wallet",
    selectorHint: 'role=button[name=/Create trip|Close trip setup/]',
    intendedFunction: "Open or close the trip creation panel.",
    target: { type: "local-state", value: "createOpen true|false" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "TripCreateForm appears or collapses.",
    expectedFailureUi: "No network failure path until the create form is submitted."
  },
  {
    id: "mobile-trips-map-sheet-toggle",
    label: "Locate trips / Expand trips map sheet / Collapse trips map sheet",
    kind: "client-ui-state",
    surface: "Mobile trips country map",
    selectorHint: 'data-testid=mobile-country-sheet-toggle',
    intendedFunction: "Expand or collapse the country map trip sheet.",
    target: { type: "local-state", value: "expanded true|false" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Country sheet height changes and trip rows become visible/hidden.",
    expectedFailureUi: "No network failure path; map remains visible."
  },
  {
    id: "mobile-trips-settings",
    label: "Trip settings",
    kind: "navigation-only",
    surface: "Mobile trips wallet and country map sheet",
    selectorHint: 'role=link[name="Trip settings"]',
    intendedFunction: "Open account/settings controls from the trips wallet.",
    target: { type: "route", value: "/dashboard/account" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Account/settings page loads.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-trips-open-stats",
    label: "Open travel stats",
    kind: "navigation-only",
    surface: "Mobile trips wallet and country map sheet",
    selectorHint: "data-testid=mobile-trips-stats-link",
    intendedFunction: "Open travel stats from the mobile trips wallet.",
    target: { type: "route", value: "/dashboard/profile/stats" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Travel stats overview opens.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "mobile-country-trip-links",
    label: "Open trip",
    kind: "navigation-only",
    surface: "Mobile country map trip list and markers",
    selectorHint: "data-testid=mobile-country-map-marker or mobile-country-trip-list links",
    intendedFunction: "Open a selected trip from the country map.",
    target: { type: "route", value: "/dashboard/trips/:tripId" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Selected trip workspace loads.",
    expectedFailureUi: "Unauthorized/missing trip is rejected by destination route auth/data loading."
  },
  {
    id: "trip-documents-navigation",
    label: "Close documents",
    kind: "navigation-only",
    surface: "Trip documents page",
    selectorHint: 'role=link[name="Close documents"]',
    intendedFunction: "Return from trip documents to the trip workspace.",
    target: { type: "route", value: "/dashboard/trips/:tripId" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Trip workspace loads.",
    expectedFailureUi: "Unauthorized/missing trip is rejected by destination route auth/data loading."
  },
  {
    id: "travel-stats-navigation",
    label: "Back to trips / Close travel stats / Back to travel stats / Close countries stats",
    kind: "navigation-only",
    surface: "Travel stats page",
    selectorHint: 'role=link[name=/Back to trips|Close travel stats|Back to travel stats|Close countries stats/]',
    intendedFunction: "Navigate between travel stats detail/overview and the trips wallet.",
    target: { type: "route", value: "/dashboard/trips or /dashboard/profile/stats" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Requested stats or trips route loads.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "travel-stats-detail-links",
    label: "Open countries stats / Open metric stats / All",
    kind: "navigation-only",
    surface: "Travel stats page",
    selectorHint: 'data-testid=travel-stats-countries-link or role=link[name=/Open .* stats|All/]',
    intendedFunction: "Open a stats detail view or change the stats year filter.",
    target: { type: "route", value: "/dashboard/profile/stats?view=:view&year=:year" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Travel stats page reloads with the requested view/year.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users."
  },
  {
    id: "admin-import-event-back",
    label: "Back to admin",
    kind: "navigation-only",
    surface: "Admin import event detail",
    selectorHint: 'data-testid=import-event-detail-route role=link[name="Back to admin"]',
    intendedFunction: "Return from an import parse event detail page to the admin dashboard.",
    target: { type: "route", value: "/dashboard/admin" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["admin"],
    expectedSuccessUi: "Admin dashboard loads.",
    expectedFailureUi: "Unauthorized users are blocked by admin route permissions."
  },
  {
    id: "imports-review-idea",
    label: "Review idea",
    kind: "authenticated-mutation",
    surface: "Plan capture / social import form",
    selectorHint: 'data-testid=plan-capture-form role=button[name="Review idea"]',
    intendedFunction: "Create a social/import record from a link, note, or screenshot and process it into reviewable places.",
    target: { type: "api", value: "POST /api/social-imports" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Inline success message announces discovered places and scrolls to the review queue.",
    expectedFailureUi: "Inline user-safe error is announced and the form remains editable."
  },
  {
    id: "imports-source-toggle",
    label: "Connect / Disconnect import source",
    kind: "authenticated-mutation",
    surface: "Imports advanced sources",
    selectorHint: "AsyncActionButton in imports source rows",
    intendedFunction: "Connect or disconnect an inbox/calendar/import source preference; disconnect requires explicit confirmation.",
    target: { type: "api", value: "PATCH /api/import-sources" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Connect runs immediately; disconnect asks for confirmation, then refreshes source status and announces success.",
    expectedFailureUi: "Confirmation can be canceled; failed disconnects keep the previous source state visible and announce a user-safe error."
  },
  {
    id: "calendar-disconnect",
    label: "Disconnect / Confirm disconnect",
    kind: "authenticated-mutation",
    surface: "Trip calendar sync panel",
    selectorHint: 'role=button[name="Disconnect"] then role=button[name="Confirm disconnect"]',
    intendedFunction: "Disconnect a connected calendar provider for the signed-in user.",
    target: { type: "api", value: "DELETE /api/calendar/connections" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "After inline confirmation, provider status refreshes to disconnected.",
    expectedFailureUi: "Confirmation can be canceled; failed disconnects keep the provider connected and show a user-safe error."
  },
  {
    id: "unfiled-item-delete",
    label: "Delete review item",
    kind: "authenticated-mutation",
    surface: "Plan review queue item actions",
    selectorHint: "Review queue item delete control",
    intendedFunction: "Delete an unfiled import/review item owned by the current user.",
    target: { type: "api", value: "DELETE /api/unfiled-items/:id" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "After confirmation, the review item is removed from the queue.",
    expectedFailureUi: "Failed deletes keep the item visible and show a user-safe error."
  },
  {
    id: "plan-promote-review-place",
    label: "Approve to draft / Promote to trip",
    kind: "authenticated-mutation",
    surface: "Plan review place cards",
    selectorHint: "data-testid=ai-review-card-* mutation buttons",
    intendedFunction: "Promote reviewed places or unfiled ideas into a user-owned trip draft/itinerary.",
    target: { type: "api", value: "POST /api/extracted-places/:id/promote or POST /api/unfiled-items/:id/promote" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Card status updates, route refreshes, and the promoted place appears in the trip context.",
    expectedFailureUi: "Inline user-safe error is announced and the card remains in the review queue."
  },
  {
    id: "plan-create-trip-plan",
    label: "Create Trip Plan",
    kind: "authenticated-mutation",
    surface: "Trip draft queue",
    selectorHint: 'role=button[name="Create Trip Plan"]',
    intendedFunction: "Promote each draft place and generate a timeline for the user-owned trip.",
    target: { type: "api", value: "POST /api/extracted-places/:id/promote then POST /api/trips/:id/itinerary/generate" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "User is routed to the generated trip timeline.",
    expectedFailureUi: "Inline user-safe error is announced and the draft remains available."
  },
  {
    id: "dashboard-generic-async-action",
    label: "AsyncActionButton action",
    kind: "authenticated-mutation",
    surface: "Reusable dashboard async action button",
    selectorHint: "AsyncActionButton",
    intendedFunction: "Run the configured authenticated API action and refresh data.",
    target: { type: "api", value: "Configured endpoint and method" },
    requiredAuth: "dashboard-session-or-test-bypass",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Success message is announced and route refreshes.",
    expectedFailureUi: "Error/timeout message is announced and button re-enables."
  },
  {
    id: "settings-pro-redeem-trial",
    label: "Redeem 15 Days Free",
    kind: "client-ui-state",
    surface: "Mobile settings Pro card",
    selectorHint: 'role=button[name="Redeem 15 Days Free"]',
    intendedFunction: "Open a trial availability sheet with an account settings route.",
    target: { type: "local-state", value: "TrialAvailabilitySheet open" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Trial availability sheet opens with an Open account settings action.",
    expectedFailureUi: "No network failure path; user remains on settings if the sheet is dismissed."
  },
  {
    id: "account-deletion-request",
    label: "Request account deletion",
    kind: "authenticated-mutation",
    surface: "Dashboard account deletion form",
    selectorHint: 'role=button[name=/Request|Requested/]',
    intendedFunction: "Submit an auditable account deletion request after explicit checkbox confirmation.",
    target: { type: "api", value: "POST /api/account/deletion-request" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Request status appears and the submit button changes to Requested.",
    expectedFailureUi: "Missing confirmation disables submit; server validation or auth errors show a user-safe message."
  },
  {
    id: "expanded-pro-accept-trial",
    label: "Accept 15 Days Free",
    kind: "client-ui-state",
    surface: "Mobile expanded Pro feature card",
    selectorHint: 'role=button[name="Accept 15 Days Free"]',
    intendedFunction: "Open a trial availability sheet with an account settings route.",
    target: { type: "local-state", value: "TrialAvailabilitySheet open" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Trial availability sheet opens with an Open account settings action.",
    expectedFailureUi: "No network failure path; user remains on the expanded trips sheet if the sheet is dismissed."
  },
  {
    id: "expanded-pro-dismiss",
    label: "Dismiss pro card",
    kind: "client-ui-state",
    surface: "Mobile expanded Pro feature card",
    selectorHint: 'role=button[name="Dismiss pro card"]',
    intendedFunction: "Dismiss the Pro upsell card for the current view.",
    target: { type: "local-state", value: "showProFeature=false" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Pro feature card disappears from the expanded trips sheet.",
    expectedFailureUi: "No network failure path; the card remains visible if React state cannot update."
  },
  {
    id: "email-automation-dismiss",
    label: "Dismiss email automation card",
    kind: "client-ui-state",
    surface: "Mobile email automation card",
    selectorHint: 'role=button[name="Dismiss email automation card"]',
    intendedFunction: "Dismiss the email automation prompt for the current view.",
    target: { type: "local-state", value: "showEmailAutomation=false" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Email automation card disappears from the expanded trips sheet.",
    expectedFailureUi: "No network failure path; the card remains visible if React state cannot update."
  },
  {
    id: "settings-force-sync",
    label: "Force Sync",
    kind: "client-ui-state",
    surface: "Mobile settings footer",
    selectorHint: 'role=button[name="Force Sync"]',
    intendedFunction: "Show that manual sync is unavailable until connected services are enabled.",
    target: { type: "local-state", value: "disabled unavailable state" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Button is disabled and visible helper text explains why sync is unavailable.",
    expectedFailureUi: "No network failure path because the unavailable action cannot be submitted."
  },
  {
    id: "settings-routed-row-actions",
    label: "Save your trips / Add Reservations via Email / TripIt Importer / Trips Timeline / My Wayline Book / Need help? / Talk to us / Your Membership / About Wayline / Terms of Service / Privacy Policy",
    kind: "navigation-only",
    surface: "Mobile settings rows",
    selectorHint: "SettingsRow links",
    intendedFunction: "Open the closest implemented account, imports, trip, profile, support, legal, or about route.",
    target: { type: "route", value: "/dashboard/account, /dashboard/imports, /dashboard/trips, /dashboard/profile/stats, mailto:support@wayline.app, /dashboard/profile, /terms, /privacy" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Selected route or mail client opens.",
    expectedFailureUi: "Dashboard auth boundary redirects unauthenticated users; external mail clients may be unavailable."
  },
  {
    id: "settings-unavailable-row-actions",
    label: "Custom Categories / Calendar Feed / Connect with Claude / MCP / Shortcuts / Currency / Distance Unit / Language / App Icon / Notifications / Widgets / Storage and Data / Review the App / App Updates / Share to a Friend",
    kind: "client-ui-state",
    surface: "Mobile settings rows",
    selectorHint: "SettingsRow disabled buttons with Soon/Pro soon badges",
    intendedFunction: "Represent settings that are intentionally unavailable until their underlying service or picker exists.",
    target: { type: "local-state", value: "disabled unavailable state" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Rows are disabled and show a visible Soon or Pro soon badge.",
    expectedFailureUi: "No network failure path because unavailable settings cannot be submitted."
  },
  {
    id: "travel-stats-share",
    label: "Share travel stats",
    kind: "client-ui-state",
    surface: "Travel stats page",
    selectorHint: 'role=button[name="Share travel stats"]',
    intendedFunction: "Represent sharing as intentionally unavailable until native/share export support is implemented.",
    target: { type: "local-state", value: "disabled unavailable state" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["signed-in-user"],
    expectedSuccessUi: "Share button is disabled and shows a visible Soon badge.",
    expectedFailureUi: "No network failure path because the unavailable action cannot be submitted."
  },
  {
    id: "documents-more-options",
    label: "More document options",
    kind: "client-ui-state",
    surface: "Trip documents page",
    selectorHint: 'role=button[name="More document options"]',
    intendedFunction: "Represent document options as intentionally unavailable until document actions exist.",
    target: { type: "local-state", value: "disabled unavailable state" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Button is disabled and shows a visible Soon badge.",
    expectedFailureUi: "No network failure path because the unavailable action cannot be submitted."
  },
  {
    id: "documents-add-document",
    label: "Add document",
    kind: "client-ui-state",
    surface: "Trip documents page",
    selectorHint: 'role=button[name="Add document"]',
    intendedFunction: "Represent document upload as intentionally unavailable until upload/storage support exists.",
    target: { type: "local-state", value: "disabled unavailable state" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["trip-owner"],
    expectedSuccessUi: "Button is disabled and shows a visible Soon badge.",
    expectedFailureUi: "No network failure path because the unavailable action cannot be submitted."
  },
  {
    id: "external-location-autocomplete",
    label: "Destination suggestion",
    kind: "external-service",
    surface: "Trip creation/edit forms",
    selectorHint: "LocationAutocomplete",
    intendedFunction: "Resolve destination metadata through Google Places for better maps.",
    target: { type: "external", value: "Google Maps Places" },
    requiredAuth: "dashboard-session",
    requiredPermissions: ["external-provider"],
    expectedSuccessUi: "Selected destination populates address and provider metadata before submit.",
    expectedFailureUi: "Manual destination fallback remains available with warning copy."
  }
] as const satisfies readonly DashboardActionContract[];

export const unwiredDashboardActionContracts = dashboardActionContracts.filter(
  (contract: DashboardActionContract) => contract.target.type === "none"
);

export const dashboardActionDomains = {
  globe: [
    "mobile-globe-open-map",
    "mobile-globe-use-current-location"
  ],
  imports: [
    "mobile-launch-forward-reservation",
    "email-automation-dismiss",
    "imports-review-idea",
    "imports-source-toggle",
    "unfiled-item-delete"
  ],
  plan: [
    "desktop-home-start-planning",
    "desktop-home-add-idea",
    "first-run-try-sample",
    "first-run-add-own-idea",
    "mobile-launch-review-places",
    "imports-review-idea",
    "plan-promote-review-place",
    "plan-create-trip-plan"
  ],
  settings: [
    "dashboard-account-settings",
    "settings-notification-preferences",
    "settings-notifications-read",
    "settings-pro-redeem-trial",
    "expanded-pro-accept-trial",
    "settings-force-sync",
    "settings-routed-row-actions",
    "settings-unavailable-row-actions",
    "calendar-disconnect",
    "account-deletion-request"
  ],
  trips: [
    "desktop-home-primary-cta",
    "desktop-latest-trip-links",
    "desktop-view-all-trips",
    "desktop-create-trip-anchor",
    "dashboard-create-trip",
    "dashboard-edit-trip",
    "dashboard-delete-trip",
    "trip-segment-delete",
    "budget-record-delete",
    "mobile-launch-continue-trip",
    "mobile-launch-add",
    "mobile-launch-travel-book",
    "mobile-trips-open-stats",
    "mobile-country-trip-links"
  ]
} as const;

export const dashboardActionRolloutSlices = {
  navigationClientState: [
    "dashboard-shell-primary-nav",
    "dashboard-account-settings",
    "account-legal-links",
    "first-run-try-sample",
    "first-run-add-own-idea",
    "first-run-skip",
    "desktop-home-primary-cta",
    "desktop-home-start-planning",
    "desktop-home-add-idea",
    "desktop-latest-trip-links",
    "desktop-view-all-trips",
    "desktop-create-trip-anchor",
    "trip-edit-toggle",
    "mobile-launch-search",
    "mobile-launch-continue-trip",
    "mobile-launch-add",
    "mobile-globe-open-map",
    "mobile-globe-use-current-location",
    "mobile-launch-expand-collapse",
    "mobile-launch-settings-open-close",
    "mobile-launch-review-places",
    "mobile-launch-travel-book",
    "mobile-launch-forward-reservation",
    "dashboard-refresh",
    "mobile-trips-map-list-toggle",
    "mobile-trips-create-panel-toggle",
    "mobile-trips-map-sheet-toggle",
    "mobile-trips-settings",
    "mobile-trips-open-stats",
    "mobile-country-trip-links",
    "trip-documents-navigation",
    "travel-stats-navigation",
    "travel-stats-detail-links",
    "admin-import-event-back",
    "settings-pro-redeem-trial",
    "expanded-pro-accept-trial",
    "expanded-pro-dismiss",
    "email-automation-dismiss",
    "settings-force-sync",
    "settings-routed-row-actions",
    "settings-unavailable-row-actions",
    "travel-stats-share",
    "documents-more-options",
    "documents-add-document"
  ],
  tripImportMutations: [
    "dashboard-create-trip",
    "dashboard-edit-trip",
    "imports-review-idea",
    "imports-source-toggle",
    "plan-promote-review-place",
    "plan-create-trip-plan",
    "dashboard-generic-async-action"
  ],
  settingsPreferencesSync: [
    "dashboard-sign-out",
    "settings-notification-preferences",
    "settings-notifications-read",
    "settings-pro-redeem-trial",
    "expanded-pro-accept-trial",
    "settings-force-sync",
    "settings-routed-row-actions",
    "settings-unavailable-row-actions"
  ],
  destructiveConfirmFlows: [
    "dashboard-delete-trip",
    "trip-segment-delete",
    "budget-record-delete",
    "unfiled-item-delete",
    "imports-source-toggle",
    "calendar-disconnect",
    "account-deletion-request"
  ]
} as const satisfies Record<string, readonly DashboardActionId[]>;

export type DashboardActionId = (typeof dashboardActionContracts)[number]["id"];
export type DashboardActionDomain = keyof typeof dashboardActionDomains;
export type DashboardActionRolloutSlice = keyof typeof dashboardActionRolloutSlices;

export function getDashboardActionContract(id: DashboardActionId) {
  return dashboardActionContracts.find((contract) => contract.id === id);
}
