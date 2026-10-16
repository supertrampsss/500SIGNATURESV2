import { defineConfig } from '@playwright/test';
import rework from './playwright.rework.config.ts';

const phase = process.env.MANDATS_INTERFACE_PHASE || 'after';
export default defineConfig({
  ...rework,
  testMatch: ['mandats-interface.test.mjs'],
  timeout: 90_000,
  outputDir: `./interface-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./interface-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./interface-artifacts/${phase}/report.json` }],
  ],
});
