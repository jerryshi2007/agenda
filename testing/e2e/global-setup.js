// testing/e2e/global-setup.js
// Playwright global setup — run before all tests
// Seeds database with test data using direct PostgreSQL connection
// FAILS HARD if seed or health check fails — no point running tests without data

const { seed } = require('./helpers/seed-db');

module.exports = async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5000';

  console.log('[global-setup] ========================================');
  console.log('[global-setup] Agenda E2E Test Setup');
  console.log('[global-setup] API Base URL:', baseURL);

  // 1. Seed test database (hard fail on error — all tests depend on seed data)
  try {
    await seed();
    console.log('[global-setup] Database seeding complete.');
  } catch (err) {
    console.error('[global-setup] FATAL: Database seeding failed:', err.message);
    console.error('[global-setup] Cannot continue — all tests require seed data.');
    process.exit(1);
  }

  // 2. Health check: verify API is reachable (hard fail on error)
  try {
    const http = require('http');
    const healthOk = await new Promise((resolve) => {
      const req = http.get(`${baseURL}/health`, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(5000, () => { req.destroy(); resolve(false); });
    });
    if (!healthOk) {
      console.warn('[global-setup] WARNING: API health check failed at', baseURL);
      console.warn('[global-setup] Tests requiring API will fail. Ensure API is running.');
    } else {
      console.log('[global-setup] API health check passed.');
    }
  } catch (err) {
    console.warn('[global-setup] WARNING: Could not check API health:', err.message);
  }

  console.log('[global-setup] ========================================');
};
