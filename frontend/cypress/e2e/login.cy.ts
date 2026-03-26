describe('Login page', () => {
  it('shows a validation error for an empty email login submission', () => {
    cy.visit('/login');

    cy.get('[data-testid="email-login-submit"]').click();

    cy.get('[data-testid="auth-error"]').should('contain', 'Please fill in all fields');
  });
});