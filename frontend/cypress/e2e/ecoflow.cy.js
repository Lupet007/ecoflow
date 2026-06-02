describe('EcoFlow End-to-End Testing', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token')

    cy.intercept('GET', 'http://localhost:8080/api/copernicus-products', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'S3A_SL_2_LST_TEST_PRODUCT',
          contentType: 'application/octet-stream',
          contentLength: 12345,
          publicationDate: '2026-06-01T10:00:00'
        }
      ]
    }).as('getProducts')

    cy.intercept('GET', 'http://localhost:8080/api/routes', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'test-route.gpx',
          pointCount: 3,
          ecoScore: 86,
          ecoScoreLabel: 'Excellent',
          uploadedAt: '2026-06-01T10:00:00',
          coordinates: JSON.stringify([
            { lat: 46.5547, lon: 15.6459 },
            { lat: 46.5560, lon: 15.6470 },
            { lat: 46.5602, lon: 15.6487 }
          ])
        }
      ]
    }).as('getRoutes')

    cy.visit('http://localhost:5173')
  })

  it('displays main EcoFlow map page', () => {
    cy.contains('EcoFlow').should('be.visible')
    cy.contains('Route planner').should('be.visible')
    cy.get('.leaflet-container').should('exist')
  })

  it('displays personalized route recommendations', () => {
    cy.contains('Personalized Route Recommendations').should('be.visible')
  })

  it('displays uploaded GPX routes', () => {
    cy.contains('Uploaded GPX Routes').should('be.visible')
    cy.contains('test-route.gpx').should('be.visible')
    cy.contains('Eco-score: 86/100').should('be.visible')
  })

  it('can show environmental heatmap', () => {
    cy.contains('Show heatmap').click()
    cy.contains('Hide heatmap').should('be.visible')
  })

  it('can select demo route and calculate route', () => {
    cy.contains('Demo route').click()
    cy.contains('Calculate route').click()
    cy.contains('Route recommendation').should('be.visible')
  })

  it('can navigate to GPX upload page', () => {
    cy.contains('Upload GPX').click()
    cy.url().should('include', '/gpx-upload')
    cy.contains('EcoFlow GPX Route Upload').should('be.visible')
  })

  it('can navigate to dashboard page', () => {
    cy.contains('Dashboard').click()
    cy.url().should('include', '/dashboard')
    cy.contains('Environmental Dashboard').should('be.visible')
  })

  it('can navigate to eco profile page', () => {
    cy.contains('Eco Profile').click()
    cy.url().should('include', '/profile')
    cy.contains('Eco Profile').should('be.visible')
  })
})