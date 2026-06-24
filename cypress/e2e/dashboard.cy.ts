/// <reference types="cypress" />

describe("Almidy live dashboard with mocked data", () => {
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
    cy.intercept("GET", "**/api/itinerary?tripId=trip_2", {
      fixture: "itinerary/trip-2.json"
    }).as("getItineraryTrip2");
    cy.intercept("GET", "**/api/trip-segments?tripId=trip_2", {
      fixture: "itinerary/trip-2-segments.json"
    }).as("getTripSegmentsTrip2");
    cy.intercept("GET", "**/api/import-sources", {
      sources: [
        {
          source_type: "email_forwarding",
          connected: true,
          source_label: "Forwarded email",
          last_synced_at: "2026-05-01T12:00:00.000Z",
          last_error: null
        },
        {
          source_type: "gmail",
          connected: false,
          source_label: "Gmail inbox sync",
          last_synced_at: null,
          last_error: null
        },
        {
          source_type: "outlook",
          connected: false,
          source_label: "Outlook inbox sync",
          last_synced_at: null,
          last_error: null
        },
        {
          source_type: "calendar",
          connected: false,
          source_label: "Calendar feed",
          last_synced_at: null,
          last_error: null
        }
      ]
    }).as("getImportSources");
    cy.intercept("GET", "**/api/unfiled-items", {
      items: []
    }).as("getUnfiledItems");
    cy.intercept("POST", "**/api/itinerary", {
      ok: true,
      source: "trip_segments",
      item: {
        id: "item_saved_1",
        title: "Saved Hotel"
      }
    }).as("saveSegment");
    cy.intercept("POST", "**/api/unfiled-items", {
      statusCode: 201,
      body: {
        item: {
          id: "unfiled_1",
          trip_id: null,
          source_type: "email",
          source_label: "United confirmation",
          raw_text: "Flight UA123\nLocation: MIA\n2026-05-10T08:30",
          parse_status: "ready",
          parse_confidence: 0.86,
          title: "Flight UA123",
          location: "MIA",
          date_time: "2026-05-10T08:30:00.000Z",
          segment_type: "flight",
          notes: "Flight UA123",
          promoted_trip_segment_id: null,
          created_at: "2026-05-01T12:00:00.000Z"
        }
      }
    }).as("createUnfiledItem");
    cy.intercept("POST", "**/api/itinerary/flight-status", (req) => {
      expect(req.body).to.include({
        tripId: "trip_1",
        itemId: "item_1",
        status: "scheduled"
      });

      req.reply({
        ok: true,
        alert: "Flight to Miami is delayed; gate C12, terminal 2.",
        item: {
          id: "item_1",
          title: "Flight to Miami",
          location: "MIA",
          lat: 25.7959,
          lng: -80.287,
          position: 1,
          date_time: "2026-05-10T09:15:00.000Z",
          notes: "Check in online",
          image_url: null,
          image_urls: null,
          segment_type: "air",
          provider: "United",
          confirmation_code: "UA123",
          booking_url: "https://example.com/booking/ua123",
          flight_number: "UA123",
          airline: "United",
          departure_airport: "EWR",
          arrival_airport: "MIA",
          scheduled_departure: "2026-05-10T08:30:00.000Z",
          estimated_departure: "2026-05-10T09:15:00.000Z",
          gate: "C12",
          terminal: "2",
          flight_status: "delayed",
          last_status_checked_at: "2026-05-01T12:00:00.000Z"
        }
      });
    }).as("refreshFlightStatus");

    cy.visit("/dashboard", {
      headers: {
        "x-cypress-dashboard": "true"
      }
    });
    cy.wait("@getTrips");
    cy.wait("@getItineraryTrip1");
    cy.wait("@getImportSources");
    cy.wait("@getUnfiledItems");
  });

  it("opens the hotel template, saves a segment, refreshes data, and returns focus to add hotel", () => {
    cy.get('[data-testid="add-hotel-segment"]').click();

    cy.get('[data-testid="segment-quick-form-hotel"]').within(() => {
      cy.get("input").first().type("Downtown Hotel");
      cy.get('input[type="datetime-local"]').eq(0).type("2026-05-10T14:00");
      cy.get('input[type="datetime-local"]').eq(1).type("2026-05-11T11:00");
      cy.get('button[type="submit"]').click();
    });

    cy.wait("@saveSegment");
    cy.wait("@getItineraryTrip1");
    cy.contains("Hotel saved successfully.").should("exist");
    cy.focused()
      .should("have.attr", "data-testid", "add-hotel-segment")
      .and("contain.text", "Add hotel");
  });

  it("keeps the live region present for accessibility messaging", () => {
    cy.get('[data-testid="dashboard-live-region"]')
      .should("exist")
      .and("have.attr", "aria-live", "assertive");
  });

  it("shows import source status separately from unfiled items", () => {
    cy.get('[data-testid="import-sources"]').should("be.visible");
    cy.get('[data-testid="import-source-email_forwarding"]')
      .should("contain.text", "Email Forwarding")
      .and("contain.text", "Connected");
    cy.get('[data-testid="import-source-gmail"]')
      .should("contain.text", "Gmail Sync")
      .and("contain.text", "Not connected");
    cy.get('[data-testid="import-source-outlook"]')
      .should("contain.text", "Outlook Sync")
      .and("contain.text", "Not connected");
    cy.get('[data-testid="import-source-calendar"]')
      .should("contain.text", "Calendar Sync")
      .and("contain.text", "Not connected");
  });

  it("connects Gmail and Outlook inbox sync sources with the expected payloads", () => {
    cy.intercept("PATCH", "**/api/import-sources", (req) => {
      if (req.body.sourceType === "gmail") {
        expect(req.body).to.deep.equal({ sourceType: "gmail", connected: true });
        req.reply({
          source: {
            source_type: "gmail",
            connected: true,
            source_label: "Gmail inbox sync",
            last_synced_at: "2026-05-01T12:00:00.000Z",
            last_error: null
          }
        });
        return;
      }

      expect(req.body).to.deep.equal({ sourceType: "outlook", connected: true });
      req.reply({
        source: {
          source_type: "outlook",
          connected: true,
          source_label: "Outlook inbox sync",
          last_synced_at: "2026-05-01T12:00:00.000Z",
          last_error: null
        }
      });
    }).as("updateImportSource");

    cy.get('[data-testid="import-source-gmail"]').within(() => {
      cy.contains("Connect Gmail").click();
      cy.contains("Connected").should("be.visible");
    });
    cy.wait("@updateImportSource");

    cy.get('[data-testid="import-source-outlook"]').within(() => {
      cy.contains("Connect Outlook").click();
      cy.contains("Connected").should("be.visible");
    });
    cy.wait("@updateImportSource");
  });

  it("adds forwarded confirmation text to Unfiled Items for review", () => {
    cy.get('[data-testid="unfiled-items"]').within(() => {
      cy.get('[data-testid="import-source-label"]').type("United confirmation");
      cy.get('[data-testid="import-raw-text"]').type(
        "Flight UA123{enter}Location: MIA{enter}2026-05-10T08:30"
      );
      cy.contains("Add to Unfiled Items").click();
    });

    cy.wait("@createUnfiledItem").its("request.body").should("deep.equal", {
      sourceType: "email",
      sourceLabel: "United confirmation",
      rawText: "Flight UA123\nLocation: MIA\n2026-05-10T08:30"
    });
    cy.get('[data-testid="unfiled-item-unfiled_1"]')
      .should("contain.text", "Flight UA123")
      .and("contain.text", "86% confidence");
  });

  it("refreshes flight updates and updates the flight card in place", () => {
    cy.get('[data-testid="flight-truth-panel"]').should("be.visible");
    cy.get('[data-testid="flight-truth-row-item_1"]')
      .should("contain.text", "Flight to Miami")
      .and("contain.text", "scheduled");

    cy.get('[data-testid="refresh-flight-statuses"]').click();

    cy.wait("@refreshFlightStatus");
    cy.get('[data-testid="flight-status-item_1"]')
      .should("contain.text", "delayed")
      .and("contain.text", "UA123")
      .and("contain.text", "Gate C12")
      .and("contain.text", "Terminal 2");
    cy.get('[data-testid="dashboard-live-region"]').should(
      "contain.text",
      "Flight to Miami is delayed"
    );
    cy.get('[data-testid="flight-alert-item_1"]')
      .should("contain.text", "Delay")
      .and("contain.text", "Flight to Miami moved");
    cy.get('[data-testid="flight-sync-preview-item_1"]').should(
      "contain.text",
      "timeline time syncs"
    );
  });

  it("supports keyboard selection", () => {
    cy.get('[data-testid="trip-card-trip_2"]').focus().type("{enter}");
    cy.wait("@getItineraryTrip2");
    cy.wait("@getTripSegmentsTrip2");

    cy.get('[data-testid="trip-card-trip_2"]').should(
      "have.attr",
      "aria-current",
      "true"
    );
  });
});
