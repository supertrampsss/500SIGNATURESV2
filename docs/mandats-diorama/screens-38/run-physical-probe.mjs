import {chromium} from '/workspace/500SIGNATURESV2/site/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:730}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4192/');await page.waitForFunction(()=>window.report,{timeout:90000});
 const report=await page.evaluate(()=>window.report);report.errors=errors;report.browser=browser.version();
 if(report.status!=='placement-and-camera-lod-passed'||errors.length)throw Error(JSON.stringify(report));
 await page.screenshot({path:'/workspace/mandats-iteration38/probe/model-board-final-ao.png'});
 await writeFile('/workspace/mandats-iteration38/probe/report-final-ao.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,houses:report.houses.length,model:report.models.architecture}));
}finally{await browser.close();}
