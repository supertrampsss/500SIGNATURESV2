import { defineConfig } from '@playwright/test';
import strategy, { vdefProjects } from './playwright.strategy.config.ts';
const phase = process.env.MANDATS_VDEF_PHASE ?? 'verified';
export default defineConfig({
  ...strategy,
  testMatch: ['mandats-vdef.test.mjs'],
  timeout: 60_000,
  expect: { timeout: 6_000 },
  outputDir: `./vdef-artifacts/${phase}/results`,
  reporter: [['list'], ['html', { outputFolder: `./vdef-artifacts/${phase}/report`, open: 'never' }], ['json', { outputFile: `./vdef-artifacts/${phase}/report.json` }]],
  projects: vdefProjects,
});
