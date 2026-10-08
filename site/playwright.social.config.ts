import { defineConfig } from "@playwright/test";
import story from "./playwright.story.config.ts";

export default defineConfig({
  ...story,
  testMatch: ["mandats-social.test.mjs"],
  timeout: 180_000,
  outputDir: "./social-artifacts/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "./social-artifacts/report", open: "never" }],
    ["json", { outputFile: "./social-artifacts/report.json" }],
  ],
});
