import { defineConfig } from '@playwright/test';
import presidency from './playwright.presidency.config.ts';
const phase=process.env.MANDATS_LOOPS_PHASE ?? 'verified';
export default defineConfig({ ...presidency,
 testMatch:['mandats-presidency.test.mjs','mandats-crises.test.mjs'],
 workers:2,
 outputDir:`./loops-artifacts/${phase}/results`,
 use:{...presidency.use,trace:'retain-on-failure'},
 reporter:[['list'],['html',{outputFolder:`./loops-artifacts/${phase}/report`,open:'never'}],['json',{outputFile:`./loops-artifacts/${phase}/report.json`}]],
});
