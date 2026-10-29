import { defineConfig } from '@playwright/test';
import presidency from './playwright.presidency.config.ts';
import { vdefProjects } from './playwright.strategy.config.ts';

const phase = process.env.MANDATS_DESK_PHASE ?? 'after';
export default defineConfig({
  ...presidency,
  projects: vdefProjects,
  testMatch: ['mandats-desk.test.mjs'],
  outputDir: `./desk-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./desk-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./desk-artifacts/${phase}/report.json` }],
  ],
});
