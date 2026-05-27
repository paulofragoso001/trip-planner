/// <reference types="cypress" />
/// <reference types="cypress-axe" />

type TimelineItem = {
  id: string;
  title: string;
  location: string | null;
  segment_type?: string | null;
  provider?: string | null;
  confirmation_code?: string | null;
  date_time?: string | null;
};

const items: TimelineItem[] = [
  {
    id: "pin-1",
    title: "Capinhas Passaporte",
    location: "Little Havana, Miami, FL, USA",
    segment_type: "activity",
    provider: "TripIt",
    confirmation_code: "A12B3",
    date_time: "2026-04-20T19:00:00-04:00"
  },
  {
    id: "pin-2",
    title: "Roteiro Francys",
    location: "Little Havana, Miami, FL, USA",
    segment_type: "meeting",
    provider: "Zoom",
    confirmation_code: null,
    date_time: "2026-04-21T12:00:00-04:00"
  }
];

function visitDashboard() {
  cy.intercept("GET", "**/api/trips", {
    fixture: "trips/dashboard-trips.json"
  }).as("getTrips");
  cy.intercept("GET", "**/api/itinerary?tripId=trip_1", {
    statusCode: 200,
    body: items
  }).as("loadItinerary");
  cy.intercept("GET", "**/api/trip-segments?tripId=trip_1", {
    statusCode: 200,
    body: []
  }).as("loadFallbackSegments");
  cy.intercept("GET", "**/api/unfiled-items", {
    statusCode: 200,
    body: { items: [] }
  }).as("loadUnfiledItems");
  cy.intercept("POST", "**/api/itinerary/reorder", {
    statusCode: 200,
    body: { ok: true }
  }).as("reorderItinerary");

  cy.visit("/dashboard", {
    headers: {
      "x-cypress-dashboard": "true"
    }
  });
  cy.wait("@getTrips");
  cy.wait("@loadItinerary");
  cy.injectAxe();
}

describe("Itinerary form accessibility", () => {
  it("has no detectable a11y violations on the itinerary form surface", () => {
    visitDashboard();

    cy.get('[data-testid="trip-timeline-tab"]').click();
    cy.get('[data-testid="add-plan"]').click();
    cy.get('[data-testid="add-plan-form"]').should("be.visible");

    cy.checkA11y('[data-testid="add-plan-form"]');
  });

  it("announces validation errors and focuses the first invalid field", () => {
    visitDashboard();

    cy.get('[data-testid="trip-timeline-tab"]').click();
    cy.get('[data-testid="add-plan"]').click();
    cy.get('[data-testid="add-plan-submit"]').click();

    cy.get('[data-testid="form-live-region"]')
      .should("have.attr", "aria-live", "assertive")
      .and("contain.text", "Hotel name is required.");

    cy.focused().should("have.attr", "name", "segmentTitle");

    cy.assertDescribedError('[name="segmentTitle"]', "Hotel name is required.");
    cy.get('[data-testid="segment-title-error"]').should(
      "contain.text",
      "Hotel name is required."
    );

    cy.get('[name="segmentTitle"]').type("Hotel X");
    cy.get('[name="segmentTitle"]')
      .should("not.have.attr", "aria-invalid")
      .and("not.have.attr", "aria-describedby")
      .and("not.have.attr", "aria-errormessage");
    cy.get('[data-testid="segment-title-error"]').should("not.exist");

    cy.checkA11y('[data-testid="add-plan-form"]');
  });

  it("keeps map and timeline controls keyboard-activatable without trapping focus", () => {
    visitDashboard();

    cy.get('[data-testid="trip-map-tab"]').focus().type("{enter}");
    cy.get('[data-testid="trip-map-tab"]').should(
      "have.attr",
      "aria-selected",
      "true"
    );

    cy.get('[data-testid="map-card-pin-2"]')
      .should("have.attr", "tabindex", "0")
      .focus()
      .trigger("keydown", { key: " " });
    cy.get('[data-testid="map-card-pin-2"]').should(
      "have.attr",
      "aria-current",
      "true"
    );
    cy.get('[data-testid="map-pin-pin-2"]').should("have.class", "scale-110");

    cy.get('[data-testid="trip-timeline-tab"]').focus().type("{enter}");
    cy.get('[data-testid="trip-timeline-tab"]').should(
      "have.attr",
      "aria-selected",
      "true"
    );
    cy.get('[data-testid="add-plan"]').focus().type("{enter}");
    cy.get('[data-testid="segment-quick-form-hotel"]').should("be.visible");
    cy.get('[data-testid="add-plan-submit"]').focus().should("be.focused");
  });
});
