import './style.css';
import './scene.css';
import { INITIAL, choices, decide, restore, summary, scene } from './model.ts';
import { mountScene, sceneMarkup } from './scene.ts';
import { prepareOffline, updateOffline } from '../offline.ts';
const root = document.querySelector<HTMLElement>('#winter-root')!;
const KEY = 'mandats.winter.v1';
let state = INITIAL;
let saveFailed = false;
try { const raw = localStorage.getItem(KEY); if(raw) state = restore(raw) ?? INITIAL; } catch { saveFailed = true; }
root.innerHTML = `<div class="winter-experience"><div class="winter-world">${sceneMarkup()}</div><header class="winter-header"><a href="/mandats/" class="winter-brand">MANDATS<span>FRANCE · DEUX HIVERS</span></a><div class="winter-tools"><button id="motion-toggle" aria-pressed="false">Pause</button><button id="sound-toggle" aria-pressed="false">Son</button><button id="help-toggle" aria-label="Règles et sauvegarde">Menu</button></div></header><div class="winter-scene-caption"><p id="season-label"></p><p id="scene-caption" role="status" aria-live="polite"></p><div class="winter-signals"><span id="homes-signal"></span><span id="work-signal"></span></div></div><section id="winter-decision" class="winter-decision" aria-label="Votre décision"></section><dialog id="winter-menu" aria-labelledby="winter-menu-title"><button class="winter-close" aria-label="Fermer">×</button><h2 id="winter-menu-title">Deux hivers</h2><p>Une séquence expérimentale de trois décisions. Le mandat complet conserve ses 45 décisions.</p><p>Le quartier est un décor fictif. Les crédits et les indices sont des unités de jeu, sans équivalence en euros ni valeur de prévision. Les animations représentent ces indices.</p><p>Les travaux du printemps sont livrés au retour de l’hiver. Le temps passe entre les décisions.</p><p id="save-status"></p><button id="offline">Préparer le jeu hors connexion</button><p id="offline-status" role="status"></p><button id="restart">Recommencer la séquence</button><a href="/mandats/methode/">Méthode du mandat complet</a><a href="/mandats/">Retour aux 45 décisions</a></dialog></div>`;
const stage = root.querySelector<HTMLElement>('.winter-stage')!;
const visual = mountScene(stage);
const panel = root.querySelector<HTMLElement>('#winter-decision')!;
const menu = root.querySelector<HTMLDialogElement>('#winter-menu')!;
let paused = false;
let audioContext: AudioContext | undefined;
let soundOn = false;
let offlineUpdateReady = false;
let suspendedByMenu = false;
const TITLES = ['Le froid arrive. Qui protéger ?', 'Le prochain hiver se prépare maintenant.', 'Le froid revient. Que pouvez-vous encore financer ?'];
const STORIES = ['L’énergie manque. Foyers et ateliers en ont besoin.', 'Vous pouvez réduire les besoins des logements ou renforcer le réseau.', 'Vos décisions précédentes ont changé la situation.'];
const labels = ['PREMIER HIVER', 'LE PRINTEMPS', 'LE DEUXIÈME HIVER'];
const signal = (value:number) => value >= 65 ? 'préservés' : value >= 45 ? 'sous tension' : 'en difficulté';
function updateWorld() {
  visual.update(scene(state));
  root.querySelector('#season-label')!.textContent = labels[Math.min(state.turn, 2)];
  root.querySelector('#scene-caption')!.textContent = scene(state).caption;
  root.querySelector('#homes-signal')!.textContent = `Foyers ${signal(state.comfort)}`;
  root.querySelector('#work-signal')!.textContent = `Ateliers ${signal(state.industry)}`;
}
function render(focus = false) {
  const report = summary(state);
  const phase = state.turn < 3 ? `<div class="winter-decision-top"><span>DÉCISION ${state.turn + 1}/3</span><span class="winter-reserve">Réserve <strong>${state.budget}</strong><small> crédits</small></span></div><h1 tabindex="-1">${TITLES[state.turn]}</h1><p class="winter-story">${STORIES[state.turn]}</p><div class="winter-choices">${choices(state).map(c => `<button class="winter-choice" data-choice="${c.id}" ${c.disabled ? 'disabled' : ''}><span class="winter-choice-heading"><strong>${c.title}</strong><span>${c.cost ? `−${c.cost}` : '0'}<small> crédits</small></span></span><span class="winter-choice-detail">${c.detail.replace(/^\d+ crédits? de jeu\. /,'')}</span>${c.disabled ? '<span class="winter-unavailable">Réserve insuffisante</span>' : ''}</button>`).join('')}</div>` : `<div class="winter-decision-top"><span>APRÈS DEUX HIVERS</span><span class="winter-reserve">Réserve <strong>${state.budget}</strong><small> crédits</small></span></div><h1 tabindex="-1">${report.title}</h1><p class="winter-result-benefit">${report.benefit}</p><p class="winter-result-tradeoff">${report.tradeoff}</p><div class="winter-result-actions"><button data-replay>Essayer une autre stratégie</button><a href="/mandats/">Jouer le mandat de 45 décisions</a></div>`;
  panel.innerHTML = `${phase}<p class="winter-footnote">Séquence pilote · Scénario fictif · Sauvegarde automatique</p>`;
  root.querySelector('#save-status')!.textContent = saveFailed ? 'La sauvegarde est indisponible dans ce navigateur. Cette séquence reste jouable.' : 'La progression est sauvegardée sur cet appareil.';
  if (focus) panel.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { saveFailed = true; } }
function chime() {
  if (!soundOn || !audioContext || document.hidden) return;
  const t = audioContext.currentTime;
  for(const [i,f] of [220,330,440].entries()) {
    const oscillator=audioContext.createOscillator(), gain=audioContext.createGain();
    oscillator.type='sine'; oscillator.frequency.value=f; gain.gain.setValueAtTime(0,t+i*.04);gain.gain.linearRampToValueAtTime(.024,t+.03+i*.04);gain.gain.exponentialRampToValueAtTime(.0001,t+.6);
    oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(t+i*.04);oscillator.stop(t+.65);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
panel.addEventListener('click', event => {
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-choice]');
  if(button && !button.disabled) {
    const previous=state;
    state=decide(state,button.dataset.choice!);persist();render(true);chime();
    const works=previous.turn === 1 && (button.dataset.choice==='isoler'||button.dataset.choice==='reseau');
    updateWorld();
    stage.classList.toggle('winter-delivery',works && !matchMedia('(prefers-reduced-motion: reduce)').matches && !paused);
  } else if ((event.target as HTMLElement).closest('[data-replay]')) restart();
});
function restart() {stage.classList.remove('winter-delivery');state=INITIAL;persist();updateWorld();render(true);if(menu.open)menu.close();}
root.querySelector('#restart')!.addEventListener('click',restart);
root.querySelector('#help-toggle')!.addEventListener('click',()=>{suspendedByMenu=true;visual.setPaused(true);menu.showModal();});
root.querySelector('.winter-close')!.addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>{suspendedByMenu=false;visual.setPaused(paused);});
root.querySelector('#motion-toggle')!.addEventListener('click',event=>{paused=!paused;visual.setPaused(paused);const b=event.currentTarget as HTMLButtonElement;b.setAttribute('aria-pressed',String(paused));b.textContent=paused?'Animer':'Pause';});
root.querySelector('#sound-toggle')!.addEventListener('click',async event=>{const b=event.currentTarget as HTMLButtonElement;try{audioContext??=new AudioContext();await audioContext.resume();soundOn=!soundOn;b.setAttribute('aria-pressed',String(soundOn));b.textContent=soundOn?'Son activé':'Son';if(soundOn)chime();}catch{b.textContent='Son indisponible';b.disabled=true;}});
root.querySelector('#offline')!.addEventListener('click',async event=>{const b=event.currentTarget as HTMLButtonElement,status=root.querySelector('#offline-status')!;b.disabled=true;status.textContent='Préparation…';try{if(offlineUpdateReady){await updateOffline();return;}const r=await prepareOffline();if(r.update){b.textContent='Appliquer la mise à jour';offlineUpdateReady=true;status.textContent='La nouvelle version est prête. Appliquez-la pour l’utiliser hors ligne.';}else status.textContent='Le jeu est prêt pour le mode hors connexion.';}catch{status.textContent='Préparation indisponible. Réessayez avec une connexion stable.';}finally{b.disabled=false;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void audioContext?.suspend();else if(soundOn)void audioContext?.resume();});
window.addEventListener('pagehide',()=>{visual.setPaused(true);void audioContext?.suspend();});
window.addEventListener('pageshow',()=>{visual.setPaused(paused||suspendedByMenu);updateWorld();});
updateWorld();render();
