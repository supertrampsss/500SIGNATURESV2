import { defineConfig } from '@playwright/test';
import command from './playwright.command.config.ts';

const phase = process.env.MANDATS_REPORTS_PHASE ?? 'after';
export default defineConfig({
  ...command,
  testMatch: ['mandats-reports.test.mjs'],
  timeout: 120_000,
  outputDir: `./reports-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./reports-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./reports-artifacts/${phase}/report.json` }],
  ],
  projects: command.projects!.map(project => project.name === 'desktop'
    ? { ...project, use: { ...project.use, viewport: { width: 1672, height: 941 } } }
    : project),
});
