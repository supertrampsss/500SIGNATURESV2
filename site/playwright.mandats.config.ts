import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:['mandats-mobile.test.mjs','editorial-tabs.test.mjs'],timeout:60000,expect:{timeout:10000},fullyParallel:true,workers:2,retries:process.env.CI?1:0,
 reporter:[['list'],['html',{outputFolder:'playwright-report-mandats',open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4180',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'android-chromium',use:{launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},...devices['Pixel 5'],viewport:{width:390,height:844}}},
  {name:'iphone-webkit',use:{...devices['iPhone 13']}},
  {name:'compact-chromium',use:{browserName:'chromium',viewport:{width:320,height:568},isMobile:true,hasTouch:true,deviceScaleFactor:1}},
  {name:'landscape-webkit',use:{...devices['iPhone 13'],viewport:{width:844,height:390}}},
  {name:'desktop-chromium',use:{launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},browserName:'chromium',viewport:{width:1280,height:900}}}
 ],
 webServer:{command:'npm run test:mandats:serve',url:'http://127.0.0.1:4180/mandats/',reuseExistingServer:false,timeout:120000}
});
