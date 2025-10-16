import { defineConfig } from 'cypress';
// @ts-ignore - CommonJS module without types
import mochawesome from 'cypress-mochawesome-reporter/plugin';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(on, config) {
      mochawesome(on);
      return config;
    }
  },
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'reports',
    charts: true,
    reportPageTitle: 'Cypress Report',
    embeddedScreenshots: true,
    inlineAssets: true,
    saveJson: true,
    reportFilename: 'mochawesome'
  },
  screenshotsFolder: 'reports/screenshots',
  videosFolder: 'reports/videos'
});
