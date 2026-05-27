/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Asserts a field has a visible, non-empty described error.
       * Verifies aria-invalid, aria-describedby, and aria-errormessage.
       */
      assertDescribedError(
        fieldSelector: string,
        expectedText: string
      ): Chainable<JQuery<HTMLElement>>;
    }
  }
}

export {};
