import { expect, test } from "@playwright/test";
import {
  dashboardActionContracts,
  unwiredDashboardActionContracts
} from "../fixtures/dashboard-action-contracts";

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
