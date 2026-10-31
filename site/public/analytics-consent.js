/** Mesure éditoriale facultative. Aucun Google avant acceptation. */
(() => {
 'use strict';
 const ID='G-TYHM099XE8',KEY='500signatures.audience.v1',DURATION=180*24*60*60*1000;
 const eligible=()=>/^\/(?:$|accueil\/?$|bilan\/?$|territoire\/?$|analyses(?:\/[^/]+)?\/?$|questions(?:\/[^/]+)?\/?$|sources\/?$|confidentialite\/?$)/.test(location.pathname);
 if(!eligible())return;
 let choice=null,started=false,lastPage='';
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.expires>Date.now()&&['accepted','refused'].includes(saved.choice))choice=saved.choice;}catch{/* Le refus de stockage ne bloque jamais la consultation. */}
 const style=document.createElement('style');
 style.textContent='.audience-choice{font:13px/1.45 "Public Sans",system-ui,sans-serif;color:#f4efe3}.audience-choice button,.audience-choice a{font:inherit}.audience-banner{position:fixed;inset:auto 12px 12px;z-index:1000;box-sizing:border-box;max-width:620px;margin:auto;padding:14px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#0b1422f2;border:1px solid #f4efe333;border-radius:14px;box-shadow:0 20px 60px #0009;backdrop-filter:blur(8px)}.audience-banner p{margin:0;flex:1 1 300px;color:#f4efe3cc}.audience-banner strong{display:block;margin-bottom:2px;color:#f4efe3}.audience-banner a{color:#d9b45f;text-decoration:underline}.audience-actions{display:flex;gap:8px}.audience-actions button{min-height:40px;padding:8px 16px;color:#f4efe3;background:transparent;border:1px solid #f4efe355;border-radius:999px;cursor:pointer}.audience-actions button[data-audience=accepted]{background:#d9b45f;border-color:#d9b45f;color:#060b17;font-weight:700}.audience-choice button:focus-visible{outline:2px solid #d9b45f;outline-offset:3px}.audience-settings{display:block;width:100%;padding:14px;text-align:center;color:#0b1422;background:#fbfaf6;border:0;border-top:1px solid #0b14221f;cursor:pointer}';
 document.head.append(style);
 const settings=document.createElement('button');settings.type='button';settings.className='audience-choice audience-settings';settings.textContent='Choix de mesure d’audience';document.body.append(settings);
 const disabled=()=>{window['ga-disable-'+ID]=choice!=='accepted'||!eligible();};
 const cleanReferrer=()=>{try{return new URL(document.referrer).origin+'/';}catch{return '';}};
 const view=()=>{
  disabled();if(choice!=='accepted'||!eligible())return;
  const page=location.origin+(location.pathname==='/accueil/'?'/':location.pathname.replace(/^\/territoire\/?$/,'/territoire/'));
  if(lastPage===page)return;
  lastPage=page;
  window.gtag('event','page_view',{send_to:ID,page_location:page,page_referrer:cleanReferrer(),page_title:document.title});
 };
 const start=()=>{
  disabled();if(started||choice!=='accepted'||!eligible())return;
  started=true;
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  window.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  window.gtag('js',new Date());
  window.gtag('config',ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname,page_referrer:cleanReferrer(),cookie_expires:DURATION/1000,cookie_update:false});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+ID;document.head.append(script);view();
 };
 const clearCookies=()=>{
  const names=document.cookie.split(';').map(v=>v.split('=')[0].trim()).filter(n=>/^_ga(?:_|$)/.test(n));
  const parts=location.hostname.split('.');
  for(const name of names){document.cookie=name+'=; Max-Age=0; Path=/';for(let i=0;i<parts.length-1;i++)document.cookie=name+'=; Max-Age=0; Path=/; Domain=.'+parts.slice(i).join('.');}
 };
 let banner;
 const save=value=>{
  const wasStarted=started;choice=value;disabled();
  try{localStorage.setItem(KEY,JSON.stringify({choice,expires:Date.now()+DURATION}));}catch{/* Le choix vaut pour cette page si le stockage est indisponible. */}
  banner?.remove();banner=null;settings.focus({preventScroll:true});
  if(value==='accepted')start();
  else{clearCookies();if(wasStarted)location.reload();}
 };
 const show=()=>{
  if(banner){banner.querySelector('button').focus();return;}
  banner=document.createElement('section');banner.className='audience-choice audience-banner';banner.setAttribute('role','region');banner.setAttribute('aria-label','Mesure d’audience');
  banner.innerHTML='<p><strong>Mesure d’audience facultative</strong>Acceptez-vous Google Analytics pour compter les visites du récit ? Rien de ce que vous saisissez n’est transmis, et vous pouvez changer d’avis à tout moment. <a href="/confidentialite/">Confidentialité</a></p><div class="audience-actions"><button type="button" data-audience="refused">Refuser</button><button type="button" data-audience="accepted">Accepter</button></div>';
  for(const button of banner.querySelectorAll('button'))button.addEventListener('click',()=>save(button.dataset.audience));
  document.body.append(banner);
 };
 settings.addEventListener('click',()=>{show();banner.querySelector('button').focus();});
 new MutationObserver(()=>{disabled();if(started)view();}).observe(document.head,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
 addEventListener('popstate',()=>{disabled();if(started)view();});
 addEventListener('storage',event=>{if(event.key===KEY)location.reload();});
 disabled();if(choice==='accepted')start();else if(!choice)show();
})();
