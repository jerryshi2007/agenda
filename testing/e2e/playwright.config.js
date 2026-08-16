// testing/e2e/playwright.config.js
// Playwright API testing config for Agenda .NET Web API

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './specs',
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalSetup: './global-setup.js',
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
  },
  // API testing only (no browser projects needed)
  projects: [
    {
      name: 'api-tests',
    },
  ],
});
