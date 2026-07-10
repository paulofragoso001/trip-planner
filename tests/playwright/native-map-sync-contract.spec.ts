import { expect, test } from "@playwright/test";
import {
  NativeMapRevisionGate,
  parseNativeMapSyncPayload
} from "../../lib/native-map-sync";

const payloadFixture = {
  revisionId: 1_714_312_800_000,
  routeId: "rte_9f82c4",
  status: "active",
  trip: {
    tripId: "trp_alpha_01",
    origin: { lat: 37.7749, lng: -122.4194, name: "SF Transit Hub" },
    destination: { lat: 34.0522, lng: -118.2437, name: "LA Terminal" }
  },
  wallet: {
    passId: "pass_wallet_881",
    isPassInstalled: true,
    balance: "42.50",
    currency: "USD"
  },
  camera: {
    center: { lat: 36, lng: -120 },
    altitude: 10_000_000,
    pitch: 0,
    heading: 0
  }
} as const;

test("native map sync payload validates the shared contract", () => {
  const payload = parseNativeMapSyncPayload(payloadFixture);

  expect(payload.routeId).toBe("rte_9f82c4");
  expect(payload.wallet.balance).toBe("42.50");
  expect(payload.camera.altitude).toBe(10_000_000);
});

test("native map revision gate rejects duplicate and stale payloads", () => {
  const gate = new NativeMapRevisionGate();
  const payload = parseNativeMapSyncPayload(payloadFixture);

  expect(gate.accept(payload)).toBe(true);
  expect(gate.accept(payload)).toBe(false);
  expect(gate.accept({ ...payload, revisionId: payload.revisionId - 1 })).toBe(false);
  expect(gate.accept({ ...payload, revisionId: payload.revisionId + 1 })).toBe(true);
});
