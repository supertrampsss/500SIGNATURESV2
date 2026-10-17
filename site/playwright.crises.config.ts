import { defineConfig } from '@playwright/test';
import presidency from './playwright.presidency.config.ts';
const phase = process.env.MANDATS_CRISES_PHASE ?? 'after';
export default defineConfig({ ...presidency,
  testMatch: ['mandats-crises.test.mjs'],
  outputDir: `./crises-artifacts/${phase}/results`,
  reporter: [['list'], ['html', {outputFolder:`./crises-artifacts/${phase}/report`,open:'never'}], ['json',{outputFile:`./crises-artifacts/${phase}/report.json`}]],
});
