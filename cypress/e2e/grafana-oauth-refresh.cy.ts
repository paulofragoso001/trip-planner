/// <reference types="cypress" />

const defaultRules = [
  {
    annotations: {
      description: "Stalled jobs have exceeded the critical threshold for 5 minutes.",
      summary: "Flight refresh workers are stalled"
    },
    enabled: true,
    execErrState: "Alerting",
    expr: "flight_refresh_worker_stalled_jobs_total > 5",
    folderUid: "flight-ops",
    for: "5m",
    labels: {
      queue: "flight-refresh",
      severity: "critical",
      team: "flight-ops"
    },
    noDataState: "OK",
    ruleGroup: "flight-workers",
    title: "Flight worker stalled jobs",
    uid: "flight-worker-stalled"
  }
];

describe("Grafana alert control panel auth recovery", () => {
  it("refreshes the backend session and retries when the Grafana proxy returns 401", () => {
    let alertRuleRequests = 0;

    cy.intercept("GET", "/api/grafana/alert-rules", (req) => {
      alertRuleRequests += 1;

      if (alertRuleRequests === 1) {
        req.reply({
          body: { error: "expired session" },
          statusCode: 401
        });
        return;
      }

      req.reply({
        body: {
          auditTrail: [],
          configured: true,
          rules: defaultRules,
          source: "grafana"
        },
        statusCode: 200
      });
    }).as("loadGrafanaRules");

    cy.intercept("POST", "/api/auth/refresh", {
      body: { refreshed: true },
      statusCode: 200
    }).as("refreshSession");

    cy.visit("/flight-ops");

    cy.wait("@refreshSession");
    cy.get('[data-testid="grafana-alert-control-panel"]').should("be.visible");
    cy.contains("Loaded Grafana-managed alert rules.").should("be.visible");
    cy.contains("Flight worker stalled jobs").should("be.visible");
    cy.wrap(null).then(() => {
      expect(alertRuleRequests).to.equal(2);
    });
  });

  it("refreshes before retrying a Grafana rule save", () => {
    cy.intercept("GET", "/api/grafana/alert-rules", {
      body: {
        auditTrail: [],
        configured: true,
        rules: defaultRules,
        source: "grafana"
      },
      statusCode: 200
    });

    let saveRequests = 0;
    cy.intercept("POST", "/api/grafana/alert-rules", (req) => {
      saveRequests += 1;

      if (saveRequests === 1) {
        req.reply({
          body: { error: "expired session" },
          statusCode: 401
        });
        return;
      }

      req.reply({
        body: {
          action: "dry-run",
          grafanaPayload: { title: "Flight worker stalled jobs" },
          ok: true
        },
        statusCode: 200
      });
    }).as("writeGrafanaRule");

    cy.intercept("POST", "/api/auth/refresh", {
      body: { refreshed: true },
      statusCode: 200
    }).as("refreshSession");

    cy.visit("/flight-ops");
    cy.get('[data-testid="grafana-dry-run"]').click();

    cy.wait("@refreshSession");
    cy.contains("Dry-run payload generated.").should("be.visible");
    cy.wrap(null).then(() => {
      expect(saveRequests).to.equal(2);
    });
  });
});
