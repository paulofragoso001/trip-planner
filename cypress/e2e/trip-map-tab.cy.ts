/// <reference types="cypress" />

type TimelineItem = {
  id: string;
  title: string;
  location: string | null;
  segment_type?: string | null;
  provider?: string | null;
  confirmation_code?: string | null;
  date_time?: string | null;
};

const selectedTripSelector = '[data-testid="trip-preview"]';
const mapTabSelector = '[data-testid="trip-map-tab"]';
const mapViewSelector = '[data-testid="trip-map-view"]';
const carouselSelector = '[data-testid="map-carousel"]';
const pinSelector = (id: string) => `[data-testid="map-pin-${id}"]`;
const cardSelector = (id: string) => `[data-testid="map-card-${id}"]`;

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
  },
  {
    id: "pin-3",
    title: "Hotel Alma",
    location: "Barcelona, Spain",
    segment_type: "hotel",
    provider: "Hotel Alma",
    confirmation_code: "H9876",
    date_time: "2026-06-23T15:00:00+02:00"
  }
];

function visitDashboardWithItinerary(itineraryItems: TimelineItem[]) {
  cy.intercept("GET", "**/api/trips", {
    fixture: "trips/dashboard-trips.json"
  }).as("getTrips");
  cy.intercept("GET", "**/api/itinerary?tripId=trip_1", {
    statusCode: 200,
    body: itineraryItems
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
}

describe("TripIt-style map tab", () => {
  it("renders the map tab and shows pins for geocodable itinerary items", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).should("be.visible").click();
    cy.get(mapTabSelector).should("have.attr", "aria-selected", "true");
    cy.get('[data-testid="trip-timeline-tab"]').should(
      "have.attr",
      "aria-selected",
      "false"
    );
    cy.get(mapViewSelector).should("be.visible");
    cy.get(carouselSelector).should("be.visible");

    cy.get(pinSelector("pin-1")).should("be.visible");
    cy.get(pinSelector("pin-2")).should("be.visible");
    cy.get(pinSelector("pin-3")).should("be.visible");
  });

  it("shows an empty state when there are no valid addresses", () => {
    visitDashboardWithItinerary([
      { ...items[0], location: null },
      { ...items[1], location: "" }
    ]);

    cy.get(mapTabSelector).click();
    cy.contains("Add an itinerary item with a valid address").should("be.visible");
  });

  it("selects a pin from the map and updates the carousel card", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).click();
    cy.get(pinSelector("pin-2")).click();
    cy.get(cardSelector("pin-2")).should("have.attr", "aria-current", "true");
    cy.get(cardSelector("pin-2")).should("contain.text", "Roteiro Francys");
  });

  it("selects a card from the carousel and highlights the matching pin", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).click();
    cy.get(cardSelector("pin-3")).click();
    cy.get(pinSelector("pin-3")).should("have.class", "scale-110");
    cy.get(cardSelector("pin-3")).should("have.attr", "aria-current", "true");
  });

  it("allows keyboard selection of map cards", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).click();
    cy.get(cardSelector("pin-2")).focus().trigger("keydown", { key: "Enter" });

    cy.get(cardSelector("pin-2")).should("have.attr", "aria-current", "true");
    cy.get(pinSelector("pin-2")).should("have.class", "scale-110");

    cy.get(cardSelector("pin-3")).focus().trigger("keydown", { key: " " });

    cy.get(cardSelector("pin-3")).should("have.attr", "aria-current", "true");
    cy.get(pinSelector("pin-3")).should("have.class", "scale-110");
  });

  it("opens transport options for the selected item", () => {
    visitDashboardWithItinerary(items);

    cy.window().then((win) => {
      cy.stub(win, "open").as("windowOpen");
    });

    cy.get(mapTabSelector).click();
    cy.get(cardSelector("pin-1")).within(() => {
      cy.contains("Transport").click();
    });

    cy.get("@windowOpen").should("have.been.called");
  });

  it("supports carousel navigation controls on every card", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).click();

    cy.get(carouselSelector).within(() => {
      cy.contains("View on map").click({ multiple: true });
    });

    cy.get(cardSelector("pin-1")).should("be.visible");
    cy.get(cardSelector("pin-2")).should("be.visible");
    cy.get(cardSelector("pin-3")).should("be.visible");
  });

  it("keeps timeline reorder intact when switching between timeline and map tabs", () => {
    visitDashboardWithItinerary(items);

    cy.get('[data-testid="timeline-list"]').should("be.visible");
    cy.get(mapTabSelector).click();
    cy.get(pinSelector("pin-1")).should("be.visible");
    cy.get('[role="tab"]').contains("Timeline").click();
    cy.get('[data-testid="timeline-list"]').should("be.visible");
    cy.get('[data-testid="timeline-item-pin-1"]').should("exist");
  });

  it("shows details and transport actions for each carousel card", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).click();

    cy.get(cardSelector("pin-1")).within(() => {
      cy.contains("See details").should("be.visible");
      cy.contains("Transport").should("be.visible");
    });

    cy.get(cardSelector("pin-3")).within(() => {
      cy.contains("See details").should("be.visible");
      cy.contains("Transport").should("be.visible");
    });
  });

  it("updates the active selection when clicking a pin after a card", () => {
    visitDashboardWithItinerary(items);

    cy.get(mapTabSelector).click();

    cy.get(cardSelector("pin-1")).click();
    cy.get(pinSelector("pin-1")).should("have.class", "scale-110");

    cy.get(pinSelector("pin-3")).click();
    cy.get(cardSelector("pin-3")).should("have.attr", "aria-current", "true");
    cy.get(pinSelector("pin-3")).should("have.class", "scale-110");
  });

  it("does not break the selected-trip preview panel", () => {
    visitDashboardWithItinerary(items);

    cy.get(selectedTripSelector).should("be.visible");
    cy.get(mapTabSelector).click();
    cy.get(selectedTripSelector).should("be.visible");
  });
});
