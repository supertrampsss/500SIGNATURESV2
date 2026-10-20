import {readFile, writeFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import assert from 'node:assert/strict';
const dir=dirname(fileURLToPath(import.meta.url));
const readJSON=async name=>JSON.parse((await readFile(resolve(dir,name),'utf8')).replace(/^\uFEFF/,''));
const report=await readJSON('audit-model/report.json').catch(error=>{
 if(error.code!=='ENOENT')throw error;
 return readJSON('audit-model/summary.json');
});
assert.equal(report.issues.length,0);
assert.equal(report.sourceChangedDuringRun,false);
assert.equal(report.trajectoryCount,36);
const reference=await readJSON('reference-version.json');
assert.equal(reference.identical,true);
const saved=await readJSON('partie-agent-mobile-seed47.json');
assert.equal(saved.version,17); assert.equal(saved.seed,47);
assert.equal(saved.choices.filter(id=>id==='live-tick').length,14);
assert.equal(saved.choices.filter(id=>id!=='live-tick').length,1);
const html=await readFile(resolve(dir,'index.html'),'utf8');
let linkChecks=0;
for(const [,path]of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
 if(/^(?:https?:|mailto:)/.test(path)||path==='verification.json')continue;
 await stat(resolve(dir,path)); linkChecks++;
}
const images=[];
for(const path of ['maquettes/01-plateau-desktop.png','maquettes/02-arbitrage-mobile.png','maquettes/03-bilan-causal.png']){
 const bytes=await readFile(resolve(dir,path));
 assert.equal(bytes.subarray(1,4).toString(),'PNG');
 images.push({path,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length});
}
const summary=Object.fromEntries(['version','scope','baseCommit','startedAt','completedAt','trajectoryCount','singleOrderCount','legislationCount','branchCount','invariantChecks','issues','sourceChangedDuringRun','coverage','legacy','pairs','sourceAtStart'].map(k=>[k,report[k]]));
await writeFile(resolve(dir,'audit-model/summary.json'),JSON.stringify(summary,null,2)+'\n');
const verification={
 date_client:'2026-10-20', reference:report.baseCommit, product_code_changes:false,
 build_client:{command:'npm run build:client',exit_code:0,scope:'Types application/scripts/functions et vite build. Build éditorial complet non relancé.'},
 model:{command:'Depuis site, définir MANDATS_STRATEGY_OUTPUT=../docs/mandats/audit-vdef-2026-10-20/audit-model, puis node --experimental-strip-types scripts/mandats-strategy-audit.ts',exit_code:0,trajectories:report.trajectoryCount,branches:report.branchCount,invariants:report.invariantChecks,issues:report.issues.length,source_changed:report.sourceChangedDuringRun,summary:'audit-model/summary.json',raw_local_report:'audit-model/report.json',note:'Traces brutes conservées localement et ignorées dans Git; audit reproductible via le script existant.'},
 replays:{command:'node --experimental-strip-types docs/mandats/audit-vdef-2026-10-20/mechanics-replay.mjs',document:'preuves-game-design.json',canonical_routes:2,autonomous_seeds:[0,1,2,19,47,143,9999]},
 browser:{tool:'cua_repl',production:'Desktop 1440x1000 et mobile 390x844. Aperçu protégé, aucune adoption de partie en production.',current_local:'Graine47,390x844CSS mesurés, un ordre santé et14ticks, arrêt en pause P15/30.',export:'partie-agent-mobile-seed47.json',full_playthrough:false,human_external:0,e2e_suite_rerun:false,webkit_rerun:false,offline_rerun:false,physical_devices:false,note:'Quelques commandes sous un viewport mal cadré ont été exclues des constats produit; captures refaites à390x844 mesurés et commandes clavier utilisées.'},
 imagegen:{mode:'outil intégré',count:3,status:'propositions non intégrées',prompts:'imagegen-prompts.json',images},
 obsolete_local:{branch:'codex/dossiers-maquette',commit:'a2e94dcb',excluded:true,note:'Les1015tests de cette ancienne copie ne constituent aucune preuve sur v17.'},
 artifact_validation:{local_link_checks:linkChecks,png_signatures_and_dimensions:true,report_and_export_parsed:true},
 unverified:['Plaisir et compréhension par joueurs externes','Recette E2E complète','Appareils physiques et safe-area iPhone','Performances terrain','Tous les assets et caches de production']
};
await writeFile(resolve(dir,'verification.json'),JSON.stringify(verification,null,2)+'\n');
await stat(resolve(dir,'verification.json'));
process.stdout.write(JSON.stringify({links:linkChecks,images:images.length,trajectories:report.trajectoryCount,invariants:report.invariantChecks,issues:report.issues.length})+'\n');
