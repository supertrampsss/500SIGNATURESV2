import {test,expect} from '@playwright/test';

test('Audience : refus sans Google et consentement réversible, sans paramètres personnels',async({page},info)=>{
 const requests=[],collected=[];
 // Un lien pré-rendu peut ouvrir un nouveau document avant l'hydratation.
 // Conserver les événements entre documents vérifie les deux parcours.
 await page.exposeFunction('recordAudienceView',value=>collected.push(value));
 await page.addInitScript(()=>{
  window.dataLayer=[];
  const push=window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push=(...items)=>{
   for(const value of items){const event=Array.from(value);if(event[0]==='event'&&event[1]==='page_view')window.recordAudienceView(event);}
   return push(...items);
  };
 });
 page.on('request',r=>{if(/googletagmanager|google-analytics|doubleclick|googlesyndication/.test(r.url()))requests.push(r.url());});
 await page.route('https://www.googletagmanager.com/gtag/js**',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.goto('/?salaire=8000&choix=r01a#prive');
 await expect(page.getByRole('region',{name:'Mesure d’audience'})).toBeVisible();
 expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Refuser',exact:true}).click();
 await page.reload();
 await expect(page.getByRole('region',{name:'Mesure d’audience'})).toHaveCount(0);
 expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Choix de mesure d’audience',exact:true}).click();
 await page.getByRole('button',{name:'Accepter',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(1);
 const views=async()=>collected;
 await expect.poll(async()=>(await views()).length).toBe(1);
 expect((await views())[0][2].page_location).toBe(new URL(page.url()).origin+'/');
 expect(JSON.stringify(await views())).not.toMatch(/8000|r01a|prive/);
 if(!await page.locator('#navigation-principale a[href="/bilan/"]').isVisible())await page.getByRole('button',{name:'Ouvrir le menu'}).click();
 await page.locator('#navigation-principale a[href="/bilan/"]').click();
 await expect.poll(async()=>(await views()).length).toBe(2);
 expect((await views())[1][2].page_location).toBe(new URL(page.url()).origin+'/bilan/');
 await page.screenshot({path:info.outputPath('audience-consentement.png')});
 await page.getByRole('button',{name:'Choix de mesure d’audience',exact:true}).click();
 await page.getByRole('button',{name:'Refuser',exact:true}).click();
 await expect(page.getByRole('button',{name:'Choix de mesure d’audience',exact:true})).toBeVisible();
 await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
 await page.goto('/mandats/');
 await expect(page.locator('script[src*="analytics-consent"]')).toHaveCount(0);
 await page.goto('/salaires/');
 await expect(page.locator('script[src*="analytics-consent"]')).toHaveCount(0);
});
