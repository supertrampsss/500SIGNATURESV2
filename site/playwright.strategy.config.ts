import { defineConfig, type Project } from '@playwright/test';
import presidency from './playwright.presidency.config.ts';

const phase = process.env.MANDATS_STRATEGY_PHASE ?? 'verified';

// Shared with the focused local configuration so CI runs the same five viewports.
export const vdefProjects: Project[] = [
  { name: 'desktop', use: { viewport: { width: 1672, height: 941 } } },
  { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'compact', use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
  { name: 'landscape', use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions: process.env.MANDATS_WEBKIT_EXECUTABLE ? { executablePath: process.env.MANDATS_WEBKIT_EXECUTABLE } : {} } },
];

export default defineConfig({
  ...presidency,
  testMatch: ['mandats-strategy.test.mjs', 'mandats-vdef.test.mjs'],
  timeout: 150_000,
  workers: 1,
  outputDir: `./strategy-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./strategy-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./strategy-artifacts/${phase}/report.json` }],
  ],
  use: { ...presidency.use, trace: 'retain-on-failure', video: 'on' },
  projects: [
    ...presidency.projects!.map(project => ({ ...project, testMatch: ['mandats-strategy.test.mjs'] })),
    ...vdefProjects.map(project => ({ ...project, name: `vdef-${project.name}`, testMatch: ['mandats-vdef.test.mjs'], timeout: 60_000, expect: { timeout: 6_000 } })),
  ],
});
