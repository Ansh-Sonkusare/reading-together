import { defineConfig, devices } from '@playwright/test';

const PORT = 3107;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/dev/reader`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
