import { readFile,writeFile } from 'node:fs/promises';
import { importInspiration,inspirationReport } from '../src/mandats/intelligence.ts';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage : node --experimental-strip-types scripts/mandats-intelligence.ts export-autorise.json rapport.json');
const report=inspirationReport(importInspiration(await readFile(input,'utf8')));
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(`${report.count} publications classées. Brouillon local, aucune action sur X.`);
