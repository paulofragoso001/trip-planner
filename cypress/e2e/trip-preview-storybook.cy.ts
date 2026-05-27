/// <reference types="cypress" />

import "cypress-axe";

const storybookUrl =
  "http://localhost:6006/iframe.html?id=trip-preview-tripit-style--desktop";

describe("Trip preview Storybook fixture", () => {
  it("renders the TripIt-style story with accessible fixture wiring", () => {
    cy.visit(storybookUrl);
    cy.injectAxe();

    cy.get('[data-testid="trip-preview-page"]').should("exist");
    cy.get('[data-testid="trip-preview-weather-strip"]').should("exist");
    cy.get('[data-testid="trip-preview-day-group"]').should("have.length.at.least", 2);
    cy.get('[data-testid^="trip-preview-plan-"]').should("have.length.at.least", 3);
    cy.get('[data-testid^="trip-preview-pin-"]').should("have.length.at.least", 1);
    cy.checkA11y();
  });
});
