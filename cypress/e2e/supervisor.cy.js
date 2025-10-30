describe('Supervisor/Operador', () => {
  beforeEach(() => {
    cy.login('supervisor', 'senha123');
    cy.url().should('include', '/dashboard');
  });

  it('deve visualizar dashboard operacional', () => {
    cy.contains('Dashboard Operacional');
  });

  it('deve monitorar motoristas', () => {
    cy.contains('Rastreamento').click();
    cy.get('.leaflet-container').should('exist');
  });

  it('deve gerar relatórios básicos', () => {
    cy.contains('Relatórios').click();
    cy.contains('Relatório Diário');
  });
}); 