/** Offline operator workbench. No X API, account lookup, publishing or profiling. */
export const TOPICS=['municipal','national','gameplay','mobile','desktop','design','dataviz','content','seo','social','monetization','automation'] as const;
export type Inspiration = {url:string;author:string;date:string;language:string;summary:string;idea:string;topics:typeof TOPICS[number][];verification:'unverified'|'verified';sources:string[];novelty:number;relevance:number;confidence:number;sensitivity:number};
function httpsURL(value:unknown):value is string {try{return typeof value==='string'&&new URL(value).protocol==='https:'&&value.length<2048;}catch{return false;}}
export function importInspiration(raw:string):Inspiration[] {
 if(raw.length>500000)throw new Error('Corpus trop volumineux.');
 const data=JSON.parse(raw);
 if(data?.authorized!==true||!Array.isArray(data.posts)||data.posts.length>500)throw new Error('Export autorisé requis, limité à 500 publications.');
 const seen=new Set<string>();
 return data.posts.map((p:unknown)=>{
  if(!p||typeof p!=='object')throw new Error('Publication invalide.');
  const v=p as Record<string,unknown>;
  if(!httpsURL(v.url)||!/^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+$/.test(v.url)||seen.has(v.url))throw new Error('URL X invalide ou dupliquée.');
  for(const key of ['author','date','language','summary','idea'])if(typeof v[key]!=='string'||!v[key]||String(v[key]).length>2000)throw new Error('Texte invalide : '+key);
  if(!Number.isFinite(Date.parse(String(v.date))))throw new Error('Date invalide.');
  if(!Array.isArray(v.topics)||!v.topics.length||!v.topics.every(t=>TOPICS.includes(t))||!Array.isArray(v.sources)||!v.sources.every(httpsURL))throw new Error('Thèmes ou sources invalides.');
  for(const key of ['novelty','relevance','confidence','sensitivity'])if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<0||v[key]>5)throw new Error('Score hors limites.');
  if(!['verified','unverified'].includes(String(v.verification))||(v.verification==='verified'&&!v.sources.length))throw new Error('Vérification non sourcée.');
  seen.add(v.url);
  return Object.fromEntries(['url','author','date','language','summary','idea','topics','verification','sources','novelty','relevance','confidence','sensitivity'].map(k=>[k,v[k]])) as Inspiration;
 });
}
export function inspirationReport(posts:Inspiration[]) {
 return { generatedAt:new Date().toISOString(), count:posts.length, notice:'Signaux d’inspiration seulement. Aucune inférence personnelle ou politique. Aucune publication automatique.', clusters:TOPICS.map(topic=>({topic,evidence:posts.filter(p=>p.topics.includes(topic)).map(p=>p.url)})).filter(c=>c.evidence.length), opportunities:posts.map(p=>({source:p.url,idea:p.idea,topics:p.topics,priority:p.relevance+p.novelty-p.sensitivity,verification:p.verification,next:p.sensitivity>=3?'human-risk-review':p.verification==='unverified'?'research-first':'human-product-review',approved:false})).sort((a,b)=>b.priority-a.priority) };
}
export type ReviewItem={id:string;thread:string;account:string;text:string;sourceURLs:string[];status:'pending'|'approved'|'rejected';reviewedAt?:string;note?:string};
export function reviewDraft(item:ReviewItem,decision:'approved'|'rejected',note:string,now=new Date()):ReviewItem {
 if(!note.trim()||note.length>1000||!item.sourceURLs.length||!item.sourceURLs.every(httpsURL))throw new Error('Une note humaine et des sources approuvées sont requises.');
 return {...item,status:decision,reviewedAt:now.toISOString(),note};
}
export function eligibleForReview(item:ReviewItem,history:ReviewItem[],rules:{paused:boolean;blockedAccounts:string[];optedOutAccounts:string[]},now=new Date()) {
 if(rules.paused||rules.blockedAccounts.includes(item.account)||rules.optedOutAccounts.includes(item.account))return false;
 if(!item.sourceURLs.length||!item.sourceURLs.every(httpsURL)||item.text.length>500||!item.text.trim())return false;
 const normalized=(s:string)=>s.toLocaleLowerCase('fr').replace(/\s+/g,' ').trim();
 return !history.some(old=>normalized(old.text)===normalized(item.text)||(old.thread===item.thread&&old.status==='approved')||(old.account===item.account&&old.reviewedAt&&Date.parse(old.reviewedAt)>+now-86400000));
}
