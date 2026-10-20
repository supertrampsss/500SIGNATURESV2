import { defineConfig } from '@playwright/test';
import strategy from './playwright.strategy.config.ts';
const port = process.env.MANDATS_MAP_PORT ?? '4180';
const phase = process.env.MANDATS_MAP_PHASE ?? 'map-actions';
export default defineConfig({ ...strategy,
  outputDir: `./strategy-artifacts/${phase}/results`,
  reporter: [['list'], ['json', {outputFile:`./strategy-artifacts/${phase}/report.json`}]],
  use: {...strategy.use, baseURL:`http://127.0.0.1:${port}`, video:'off'},
  webServer: {...strategy.webServer, command:`npx vite preview --host 127.0.0.1 --port ${port} --strictPort`, url:`http://127.0.0.1:${port}/mandats/`},
});
