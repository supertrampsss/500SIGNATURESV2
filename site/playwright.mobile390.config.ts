import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "simulateur-v10-mobile.test.mjs",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4175" },
  webServer: {
    command: "npm run test:mobile390:server",
    url: "http://127.0.0.1:4175/simulateur",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
