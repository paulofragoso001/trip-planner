/// <reference types="cypress" />

type DragToOptions = {
  force?: boolean;
};

declare global {
  namespace Cypress {
    interface Chainable {
      dragTo(
        target: string,
        options?: DragToOptions
      ): Chainable<JQuery<HTMLElement>>;
      reorderWithKeyboard(
        direction?: "ArrowUp" | "ArrowDown"
      ): Chainable<JQuery<HTMLElement>>;
    }
  }
}

Cypress.Commands.add(
  "assertDescribedError",
  (fieldSelector: string, expectedText: string) => {
    cy.get(fieldSelector)
      .should("have.attr", "aria-invalid", "true")
      .invoke("attr", "aria-describedby")
      .then((describedBy) => {
        expect(describedBy).to.be.a("string").and.not.be.empty;
        const errorId = String(describedBy);

        cy.get(fieldSelector)
          .invoke("attr", "aria-errormessage")
          .should("equal", errorId);
        cy.get(`[id="${errorId}"]`)
          .should("be.visible")
          .and("not.be.empty")
          .and("contain.text", expectedText);
      });

    return cy.get(fieldSelector);
  }
);

Cypress.Commands.add(
  "dragTo",
  { prevSubject: "element" },
  (subject, target: string, options: DragToOptions = {}) => {
    const dataTransfer = new DataTransfer();
    const force = options.force ?? true;

    cy.wrap(subject)
      .trigger("dragstart", { dataTransfer, force })
      .trigger("drag", { dataTransfer, force });

    cy.get(target)
      .trigger("dragenter", { dataTransfer, force })
      .trigger("dragover", { dataTransfer, force })
      .trigger("drop", { dataTransfer, force });

    cy.wrap(subject).trigger("dragend", { dataTransfer, force });

    return cy.wrap(subject);
  }
);

Cypress.Commands.add(
  "reorderWithKeyboard",
  { prevSubject: "element" },
  (subject, direction: "ArrowUp" | "ArrowDown" = "ArrowDown") => {
    const directionToken = direction === "ArrowUp" ? "{uparrow}" : "{downarrow}";

    return cy
      .wrap(subject)
      .focus()
      .type("{space}")
      .type(directionToken)
      .type("{space}");
  }
);

export {};
