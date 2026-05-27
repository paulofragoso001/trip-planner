/// <reference types="cypress" />

import "cypress-axe";

describe("Trip preview", () => {
  beforeEach(() => {
    cy.visit("/trip-preview-demo");
    cy.injectAxe();
  });

  it("renders day groupings and weather", () => {
    cy.get('[data-testid="trip-preview-page"]').should("exist");
    cy.get('[data-testid="trip-preview-day-group"]').should("have.length.at.least", 2);
    cy.get('[data-testid="trip-preview-weather-strip"]').should("exist");
    cy.checkA11y();
  });

  it("renders map pins for mappable plans without asserting map pixels", () => {
    cy.get('[data-testid^="trip-preview-pin-"]').should("have.length.at.least", 1);
    cy.get('[data-testid="trip-preview-map-panel"]').should("exist");
  });

  it("syncs selected plan state from carousel/card clicks", () => {
    cy.get('[data-testid^="trip-preview-plan-"]').eq(1).click();
    cy.get('[data-testid^="trip-preview-plan-"]')
      .eq(1)
      .should("have.attr", "aria-pressed", "true");
  });

  it("toggles print/export map and directions sections", () => {
    cy.contains("button", "Hide maps").click();
    cy.get('[data-testid="trip-preview-map-panel"]').should("not.exist");
    cy.contains("button", "Show maps").click();
    cy.get('[data-testid="trip-preview-map-panel"]').should("exist");

    cy.contains("button", "Hide directions").click();
    cy.get('[data-testid="trip-preview-directions"]').should("not.exist");
  });
});
