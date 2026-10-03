import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';

// La balise distante est exclusivement chargée par le choix du visiteur.
const dist=new URL('../dist/',import.meta.url);
let count=0;
async function walk(directory){
 for(const item of await readdir(directory,{withFileTypes:true})){
  const file=new URL(item.name+(item.isDirectory()?'/':''),directory);
  if(item.isDirectory())await walk(file);
  else if(item.name.endsWith('.html')){
   const relative=path.relative(dist.pathname,file.pathname);
   if(/^(?:mandats|salaires|simulateur)\//.test(relative))continue;
   const html=await readFile(file,'utf8');
   if(/content=["'][^"']*noindex/.test(html)||!html.includes('</body>'))continue;
   if(!html.includes('src="/analytics-consent.js"')){
    await writeFile(file,html.replace('</body>','<script src="/analytics-consent.js" defer></script>\n</body>'));count++;
   }
  }
 }
}
await walk(dist);console.log(`Audience facultative : ${count} documents préparés, aucune balise Google chargée sans acceptation.`);
