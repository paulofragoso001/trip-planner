import { expect, test } from "@playwright/test";
import {
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
