import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  dashboardActionDomains,
  dashboardActionRolloutSlices,
  dashboardActionContracts,
  unwiredDashboardActionContracts
} from "../fixtures/dashboard-action-contracts";
import {
  adminJobsPayloadSchema,
  adminSyncPayloadSchema,
  parseMutationPayload,
  parseRouteId,
  tripMutationPayloadSchema
} from "../../lib/server/mutation-schemas";
import { isAllowedSessionMutationRequest } from "../../lib/request-protection-core";
import { appVersion } from "../../lib/app-metadata";
import { dashboardActionRoutes } from "../../lib/dashboard/action-routes";

test("settings routes and metadata remain canonical and truthful", () => {
  expect(dashboardActionRoutes.settings).toEqual({
    about: "/about",
    account: "/dashboard/account",
    help: "/dashboard/account#help",
    membership: "/dashboard/account#membership",
    preferences: "/dashboard/account#preferences",
    privacy: "/privacy",
    sync: "/dashboard/account#sync",
    talkToUs: "mailto:support@almidy.app",
    terms: "/terms"
  });
  expect(dashboardActionRoutes.trips.list).toBe("/dashboard/trips");
  expect(dashboardActionRoutes.trips.stats).toBe("/dashboard/profile/stats");
  expect(dashboardActionRoutes.imports.manualReservations).toBe("/dashboard/imports");
  expect(appVersion).toMatch(/^\d+\.\d+\.\d+/);
  expect(appVersion).not.toBe("1.0.0");
});

test("visible settings launch controls cannot regress to empty callbacks", () => {
  const launchSource = readFileSync(
    resolve(process.cwd(), "components/dashboard/almidy-launch-globe.tsx"),
    "utf8"
  );
  const walletSource = readFileSync(
    resolve(process.cwd(), "components/dashboard/mobile-trips-wallet-sheet.tsx"),
    "utf8"
  );
  const overviewSource = readFileSync(
    resolve(process.cwd(), "components/trip/trip-overview-page.tsx"),
    "utf8"
  );
  const timelineSource = readFileSync(
    resolve(process.cwd(), "components/trip/trip-timeline-page.tsx"),
    "utf8"
  );

  expect(launchSource).not.toContain("onOpenSettings={() => {}}");
  expect(launchSource).not.toContain("onOpenStats={() => {}}");
  expect(launchSource).toContain("settingsHref={dashboardActionRoutes.settings.account}");
  expect(walletSource).toContain("settingsHref = dashboardActionRoutes.settings.account");
  expect(overviewSource).toContain('href={dashboardActionRoutes.settings.account}');
  expect(timelineSource).toContain('href={dashboardActionRoutes.settings.account}');
});

test("dashboard action contracts stay well-formed", () => {
  const ids = new Set<string>();

  for (const contract of dashboardActionContracts) {
    expect(contract.id, "contract id").toMatch(/^[a-z0-9-]+$/);
    expect(ids.has(contract.id), `duplicate dashboard action contract id ${contract.id}`).toBe(false);
    ids.add(contract.id);

    expect(contract.label, `${contract.id} label`).not.toHaveLength(0);
    expect(contract.surface, `${contract.id} surface`).not.toHaveLength(0);
    expect(contract.selectorHint, `${contract.id} selector hint`).not.toHaveLength(0);
    expect(contract.intendedFunction, `${contract.id} intended function`).not.toHaveLength(0);
    expect(contract.target.value, `${contract.id} target value`).not.toHaveLength(0);
    expect(contract.expectedSuccessUi, `${contract.id} success UI`).not.toHaveLength(0);
    expect(contract.expectedFailureUi, `${contract.id} failure UI`).not.toHaveLength(0);

    if (contract.kind === "authenticated-mutation") {
      expect(contract.requiredAuth, `${contract.id} mutation auth`).not.toBe("none");
      expect(contract.target.type, `${contract.id} mutation target`).toMatch(/^(api|server-action)$/);
    }

    expect(contract.target.type, `${contract.id} target should be wired or visibly unavailable`).not.toBe("none");
  }

  expect(unwiredDashboardActionContracts, "no dashboard action should drift back to a no-op target").toHaveLength(0);
});

test("dashboard action domains reference real wired contracts", () => {
  const contractIds = new Set(dashboardActionContracts.map((contract) => contract.id));

  for (const [domain, actionIds] of Object.entries(dashboardActionDomains)) {
    expect(actionIds.length, `${domain} has actions`).toBeGreaterThan(0);

    for (const actionId of actionIds) {
      expect(contractIds.has(actionId), `${domain} action ${actionId} exists`).toBe(true);
      const contract = dashboardActionContracts.find((item) => item.id === actionId);
      expect(contract?.target.type, `${domain} action ${actionId} is wired`).not.toBe("none");
    }
  }
});

test("navigation and client-state rollout slice has no server writes", () => {
  const contractIds = new Set(dashboardActionContracts.map((contract) => contract.id));

  for (const actionId of dashboardActionRolloutSlices.navigationClientState) {
    expect(contractIds.has(actionId), `first-slice action ${actionId} exists`).toBe(true);
    const contract = dashboardActionContracts.find((item) => item.id === actionId);
    expect(contract?.kind, `${actionId} stays safe for slice one`).toMatch(/^(navigation-only|client-ui-state)$/);
    expect(contract?.target.type, `${actionId} does not write through a server boundary`).not.toMatch(
      /^(api|server-action)$/
    );
  }

  for (const contract of dashboardActionContracts) {
    if (contract.kind === "authenticated-mutation") {
      expect(
        dashboardActionRolloutSlices.navigationClientState.includes(contract.id),
        `${contract.id} should not be in the navigation/client-state slice`
      ).toBe(false);
    }
  }
});

test("trip and import mutation rollout slice uses authenticated server boundaries", () => {
  const contractIds = new Set(dashboardActionContracts.map((contract) => contract.id));

  for (const actionId of dashboardActionRolloutSlices.tripImportMutations) {
    expect(contractIds.has(actionId), `mutation-slice action ${actionId} exists`).toBe(true);
    const contract = dashboardActionContracts.find((item) => item.id === actionId);
    expect(contract?.kind, `${actionId} is an authenticated mutation`).toBe("authenticated-mutation");
    expect(contract?.requiredAuth, `${actionId} requires auth`).toMatch(/^dashboard-session/);
    expect(contract?.target.type, `${actionId} uses a server boundary`).toMatch(/^(api|server-action)$/);
  }

  expect(
    dashboardActionRolloutSlices.tripImportMutations.includes("dashboard-delete-trip"),
    "destructive delete remains in the confirm-flow slice"
  ).toBe(false);
});

test("settings preferences sync rollout slice is routed, disabled, or server-bound", () => {
  const contractIds = new Set(dashboardActionContracts.map((contract) => contract.id));

  for (const actionId of dashboardActionRolloutSlices.settingsPreferencesSync) {
    expect(contractIds.has(actionId), `settings-slice action ${actionId} exists`).toBe(true);
    const contract = dashboardActionContracts.find((item) => item.id === actionId);
    expect(contract?.requiredAuth, `${actionId} requires an account/session boundary`).toMatch(/^dashboard-session/);
    expect(
      ["authenticated-mutation", "client-ui-state", "navigation-only"].includes(contract?.kind || ""),
      `${actionId} is either routed, disabled/client state, or a server mutation`
    ).toBe(true);

    if (contract?.kind === "authenticated-mutation") {
      expect(contract.target.type, `${actionId} mutates through a server boundary`).toMatch(/^(api|server-action)$/);
    }

    if (contract?.kind === "client-ui-state") {
      expect(
        contract.target.value,
        `${actionId} is explicit local UI state, not an inert action`
      ).toMatch(/disabled unavailable state|TrialAvailabilitySheet|show[A-Za-z]+=false/);
    }
  }
});

test("destructive rollout slice requires confirmations and server boundaries", () => {
  const contractIds = new Set(dashboardActionContracts.map((contract) => contract.id));

  for (const actionId of dashboardActionRolloutSlices.destructiveConfirmFlows) {
    expect(contractIds.has(actionId), `destructive action ${actionId} exists`).toBe(true);
    const contract = dashboardActionContracts.find((item) => item.id === actionId);

    expect(contract?.kind, `${actionId} is an authenticated mutation`).toBe("authenticated-mutation");
    expect(contract?.requiredAuth, `${actionId} requires auth`).toMatch(/^dashboard-session/);
    expect(contract?.target.type, `${actionId} uses a server boundary`).toMatch(/^(api|server-action)$/);
    expect(
      `${contract?.expectedSuccessUi} ${contract?.expectedFailureUi}`.toLowerCase(),
      `${actionId} documents confirmation/cancel behavior`
    ).toMatch(/confirm|confirmation|cancel/);
  }
});

test("dashboard mutation schemas reject drift and normalize server inputs", () => {
  const validTripPayload = {
    budget: "1200",
    destination: " Miami ",
    destination_lat: "25.7617",
    destination_lng: "-80.1918",
    destination_status: "resolved",
    end_date: "2026-07-07",
    name: " Puerto Rico ",
    start_date: "2026-07-01",
    travelStyle: "relaxed"
  };

  const parsedTrip = parseMutationPayload(tripMutationPayloadSchema, validTripPayload);
  expect(parsedTrip.ok).toBe(true);
  if (parsedTrip.ok) {
    expect(parsedTrip.value.name).toBe("Puerto Rico");
    expect(parsedTrip.value.destination).toBe("Miami");
    expect(parsedTrip.value.destination_lat).toBe(25.7617);
    expect(parsedTrip.value.destination_lng).toBe(-80.1918);
    expect(parsedTrip.value.start_date).toBe("2026-07-01");
    expect(parsedTrip.value.travel_style).toBe("relaxed");
  }

  expect(parseMutationPayload(tripMutationPayloadSchema, {
    ...validTripPayload,
    owner_id: "client-side-spoof"
  }).ok).toBe(false);
  expect(parseMutationPayload(tripMutationPayloadSchema, {
    ...validTripPayload,
    start_date: "07/01/2026"
  }).ok).toBe(false);
  expect(parseRouteId(" trip_123 ", "Trip id")).toEqual({ ok: true, value: "trip_123" });
  expect(parseRouteId("../trip_123", "Trip id").ok).toBe(false);

  expect(parseMutationPayload(adminJobsPayloadSchema, { action: "run" })).toEqual({
    ok: true,
    value: { action: "run" }
  });
  expect(parseMutationPayload(adminJobsPayloadSchema, { action: "run", userId: "spoof" }).ok).toBe(false);
  expect(parseMutationPayload(adminSyncPayloadSchema, {})).toEqual({
    ok: true,
    value: { action: "health" }
  });
  expect(parseMutationPayload(adminSyncPayloadSchema, { action: "delete" }).ok).toBe(false);
});

test("dashboard session mutations require same-site or same-origin requests", async () => {
  const sameOriginRequest = new Request("https://app.wayline.test/api/trips", {
    headers: { origin: "https://app.wayline.test" },
    method: "POST"
  });
  expect(isAllowedSessionMutationRequest(sameOriginRequest)).toBe(true);

  const sameSiteRequest = new Request("https://app.wayline.test/api/trips", {
    headers: { "sec-fetch-site": "same-site" },
    method: "POST"
  });
  expect(isAllowedSessionMutationRequest(sameSiteRequest)).toBe(true);

  const crossSiteRequest = new Request("https://app.wayline.test/api/trips", {
    headers: { origin: "https://evil.example" },
    method: "POST"
  });
  expect(isAllowedSessionMutationRequest(crossSiteRequest)).toBe(false);

  const testBypassRequest = new Request("https://app.wayline.test/api/trips", {
    headers: { "x-cypress-dashboard": "true" },
    method: "POST"
  });
  expect(isAllowedSessionMutationRequest(testBypassRequest)).toBe(false);
  expect(
    isAllowedSessionMutationRequest(testBypassRequest, { allowTestBypass: true })
  ).toBe(true);
});
