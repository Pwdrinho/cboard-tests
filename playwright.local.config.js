const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['a11y/**/*.spec.js', 'exploratory/**/*.spec.js'],
  timeout: 90 * 1000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: process.env.CHROME_PATH || undefined }
      }
    }
  ]
});
