import { defineConfig } from '@playwright/test';
import rework from './playwright.rework.config.ts';

const phase = process.env.MANDATS_PRESIDENCY_PHASE ?? 'after';
export default defineConfig({
  ...rework,
  testMatch: ['mandats-presidency.test.mjs'],
  timeout: 120_000,
  outputDir: `./presidency-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./presidency-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./presidency-artifacts/${phase}/report.json` }],
  ],
  use: { ...rework.use, trace: 'on' },
  projects: rework.projects!.map(project => project.name === 'desktop'
    ? { ...project, use: { ...project.use, viewport: { width: 1672, height: 941 } } }
    : project),
});
