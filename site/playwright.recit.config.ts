import { defineConfig } from '@playwright/test';
import mandats from './playwright.mandats.config.ts';

// Keep review iterations separate, including their JSON report and actual images.
const phase = (process.env.MANDATS_RECIT_PHASE ?? 'after').replace(/[^a-zA-Z0-9_-]/g, '_');
export default defineConfig({
  ...mandats,
  testMatch: ['accueil-recit.test.mjs'],
  projects: mandats.projects?.map(project => project.name === 'desktop-chromium'
    ? { ...project, use: { ...project.use, viewport: { width: 1440, height: 960 } } }
    : project),
  outputDir: `./recit-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./recit-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./recit-artifacts/${phase}/report.json` }],
  ],
  // The shared projects include Chromium, WebKit, touch, 320 px and landscape.
  // Their MANDATS_CHROMIUM_EXECUTABLE / MANDATS_WEBKIT_EXECUTABLE overrides also apply.
});
