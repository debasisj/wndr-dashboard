describe('Cypress sample', () => {
  it('loads playwright site title', () => {
    cy.visit('https://playwright.dev/');
    cy.title().should('match', /Playwright/);
  });

  it('intentional failure', () => {
    cy.visit('https://playwright.dev/');
    cy.contains('h1', 'This heading does not exist').should('be.visible');
  });
});
