import { defineConfig } from '@playwright/test';
import rework from './playwright.rework.config.ts';

const phase = process.env.MANDATS_COMMAND_PHASE || 'after';
export default defineConfig({
  ...rework,
  testMatch: ['mandats-command.test.mjs'],
  timeout: 90_000,
  outputDir: `./interface-artifacts/command-${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./interface-artifacts/command-${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./interface-artifacts/command-${phase}/report.json` }],
  ],
});
