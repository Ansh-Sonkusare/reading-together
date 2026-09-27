import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// Each worktree gets its own port so parallel agents' e2e runs never share a dev server.
const PORT = Number(process.env.E2E_PORT) || 3100 + (parseInt(createHash('sha1').update(process.cwd()).digest('hex').slice(0, 6), 16) % 800);

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
