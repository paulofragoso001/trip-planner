/// <reference types="cypress" />

describe("Wayline itinerary drag and drop", () => {
  beforeEach(() => {
    cy.intercept("GET", "**/api/trips", {
      fixture: "trips/dashboard-trips.json"
    }).as("getTrips");
    cy.intercept("GET", "**/api/itinerary?tripId=trip_1", {
      fixture: "itinerary/trip-1.json"
    }).as("getItineraryTrip1");
    cy.intercept("GET", "**/api/trip-segments?tripId=trip_1", {
      fixture: "itinerary/trip-1-segments.json"
    }).as("getTripSegmentsTrip1");
    cy.intercept("POST", "**/api/itinerary/reorder", (req) => {
      expect(req.body).to.deep.equal({
        tripId: "trip_1",
        orderedItemIds: ["item_2", "item_1"]
      });

      req.reply({
        ok: true,
        tripId: "trip_1",
        orderedItemIds: ["item_2", "item_1"],
        updated: true
      });
    }).as("reorderItinerary");

    cy.visit("/dashboard", {
      headers: {
        "x-cypress-dashboard": "true"
      }
    });
    cy.wait("@getTrips");
    cy.wait("@getItineraryTrip1");
  });

  it("reorders itinerary items and persists the payload", () => {
    cy.get('[data-testid="timeline-item-item_1"]').should(
      "contain.text",
      "Flight to Miami"
    );
    cy.get('[data-testid="timeline-item-item_2"]').should(
      "contain.text",
      "Downtown Hotel"
    );

    cy.get('[data-testid="timeline-drag-handle-item_2"]')
      .trigger("mousedown", { which: 1, force: true });
    cy.get('[data-testid="timeline-item-item_1"]').trigger("mousemove", {
      clientX: 10,
      clientY: 200,
      force: true
    });
    cy.get('[data-testid="timeline-drag-handle-item_2"]').trigger("mouseup", {
      force: true
    });

    cy.wait("@reorderItinerary");
    cy.get('[aria-live="assertive"]').should("exist");
  });
});
