import { ANALYTICS_EVENTS } from './operations.ts';
export type LocalEvent = { event:typeof ANALYTICS_EVENTS[number]; mode:'municipal'|'national'|null; at:string };
const KEY='mandats.pilot.events.v1', CONSENT='mandats.pilot.consent.v1';
export function pilotEnabled(storage:Pick<Storage,'getItem'>): boolean { try { return storage.getItem(CONSENT)==='true'; } catch { return false; } }
export function setPilotConsent(storage:Pick<Storage,'setItem'|'removeItem'>,enabled:boolean) { storage.setItem(CONSENT,String(enabled)); if(!enabled)storage.removeItem(KEY); }
export function recordPilot(storage:Pick<Storage,'getItem'|'setItem'>,event:LocalEvent['event'],mode:LocalEvent['mode'],now=new Date()) {
  if(!pilotEnabled(storage)||!ANALYTICS_EVENTS.includes(event)||!['municipal','national',null].includes(mode))return;
  try { const events=readPilot(storage,now);events.push({event,mode,at:now.toISOString()});storage.setItem(KEY,JSON.stringify(events.slice(-500))); } catch { /* Optional measurement never blocks a decision. */ }
}
export function readPilot(storage:Pick<Storage,'getItem'>,now=new Date()):LocalEvent[] {
  try { const raw=storage.getItem(KEY);if(!raw||raw.length>80000)return [];const list:unknown=JSON.parse(raw);if(!Array.isArray(list))return [];return list.filter((v):v is LocalEvent=>!!v&&typeof v==='object'&&ANALYTICS_EVENTS.includes(v.event)&&['municipal','national',null].includes(v.mode)&&typeof v.at==='string'&&Date.parse(v.at)<=+now&&Date.parse(v.at)>+now-30*86400000).slice(-500).map(v=>({event:v.event,mode:v.mode,at:v.at})); } catch{return [];}
}
