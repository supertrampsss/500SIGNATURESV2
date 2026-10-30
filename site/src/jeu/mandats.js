/* Mandats nouvelle formule : moteur et interface. Tour par tour : vingt trimestres,
   deux dossiers par trimestre, budget chaque automne, grandes réformes, escalade de la rue. */

import { VILLES, DOMAINES, D, RUE, REFORMES, PROFILS } from './contenu.js';


const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const fr = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAISONS = ['Hiver', 'Printemps', 'Été', 'Automne'];

let S, rng;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* Sauvegarde locale : l'état complet après chaque transition, plus le nombre de
   tirages aléatoires pour reprendre exactement la même suite. */
const CLE = '500signatures.mandats.jouer.v1';
function armerHasard(graine, deja) { const base = mulberry(graine); for (let i = 0; i < deja; i++) base(); rng = () => { S.nRng = (S.nRng || 0) + 1; return base(); }; }
function sauver() { if (S && S.brouillon) return; try { if (S && !S.fini) localStorage.setItem(CLE, JSON.stringify(S)); else localStorage.removeItem(CLE); } catch { /* stockage indisponible : la partie continue */ } }
function lireSauvegarde() { try { const s = JSON.parse(localStorage.getItem(CLE) || 'null'); return s && s.v === 1 && Array.isArray(s.main) && !s.fini ? s : null; } catch { return null; } }
function reprendre(s) {
  S = s; armerHasard(S.graine, S.nRng || 0);
  ferme('#e-intro'); S.donne = true; rendre(true);
  setTimeout(verifierFin, reduit ? 0 : 600);
}
function nouvellePartie(p, brouillon = false) {
  const graine = Math.floor(Math.random() * 1e6);
  S = { v: 1, nRng: 0 };
  armerHasard(graine, 0);
  S = { v: 1, nRng: 0, graine, tour: 0, def: 152.51, op: p.op, maj: p.maj, ten: p.ten, taux: 3.3,
    sante: 38, educ: 52, secu: 50, loge: 36, trans: 55, ener: 60,
    budget: { sante: 0, educ: 0, secu: 0, loge: 0, trans: 0, ener: 0, impots: 0 },
    f: {}, vus: {}, chantiers: [], journal: [], titres: [], decisions: [], main: [], n493: 0, censures: 0, rue: 0, insurrection: 0, fil: [], reformes: {}, reformeTour: -1, an493: -1, profil: p.t, fini: false, brouillon };
  tirer(); rendre(true);
}

/* ---------- Tirage ---------- */
function eligible(d) {
  if (d.saison !== undefined && S.tour % 4 !== d.saison) return false;
  if (d.quand && !d.quand(S)) return false;
  const vu = S.vus[d.id];
  if (vu !== undefined) { if (!d.recur) return false; if (S.tour - vu < d.recur) return false; }
  return true;
}
function tirer() {
  const crises = D.filter(d => d.crise && eligible(d));
  const suites = D.filter(d => d.suite && eligible(d));
  const autres = D.filter(d => !d.crise && !d.suite && eligible(d));
  const main = [];
  crises.sort((a, b) => (b.niv || 0) - (a.niv || 0));
  if (crises.length) main.push(crises[0].niv ? crises[0] : crises[Math.floor(rng() * crises.length)]);
  suites.forEach(d => { if (main.length < 2) main.push(d); });
  while (main.length < 2 && autres.length) main.push(autres.splice(Math.floor(rng() * autres.length), 1)[0]);
  S.main = main.map(d => ({ id: d.id, choix: null }));
  S.donne = true;
  main.forEach(d => S.vus[d.id] = S.tour);
}
const dossier = id => D.find(d => d.id === id);

/* ---------- Effets ---------- */
const BORNES = { op: [0, 100], ten: [0, 100], maj: [120, 420], taux: [1, 8], def: [40, 320], sante: [0, 100], educ: [0, 100], secu: [0, 100], loge: [0, 100], trans: [0, 100], ener: [0, 100] };
function appliquer(e, montrer) {
  const deltas = {};
  for (const [k, v] of Object.entries(e || {})) {
    if (!(k in BORNES)) continue;
    const avant = S[k]; S[k] = clamp(S[k] + v, ...BORNES[k]); deltas[k] = S[k] - avant;
  }
  if (montrer) flotter(deltas);
  return deltas;
}
const LIB = { def: ['Déficit', ' Md€', 1, -1], op: ['Opinion', ' pt', 0, 1], maj: ['Majorité', ' sièges', 0, 1], ten: ['Tension', '', 0, -1], taux: ['Taux', ' pt', 1, -1],
  sante: ['Santé', '', 0, 1], educ: ['Éducation', '', 0, 1], secu: ['Sécurité', '', 0, 1], loge: ['Logement', '', 0, 1], trans: ['Transports', '', 0, 1], ener: ['Énergie', '', 0, 1] };
function puces(e, plusTard) {
  return Object.entries(e || {}).filter(([k, v]) => LIB[k] && v).map(([k, v]) => {
    const [n, u, d, sens] = LIB[k]; const bon = v * sens > 0;
    const val = (v > 0 ? '+' : '−') + fr(Math.abs(v), d && Math.abs(v) % 1 ? 1 : 0) + u;
    return `<span class="puce ${plusTard ? 'plus-tard' : bon ? 'bon' : 'mal'}" data-k="${k}" data-s="${bon ? 1 : -1}">${bon ? '▲' : '▼'} ${n} ${val}</span>`;
  }).join('');
}

/* ---------- Rendu ---------- */
const anime = new WeakMap();
function compter(el, cible, d) {
  const dep = anime.get(el) ?? cible; anime.set(el, cible);
  if (reduit) { el.textContent = fr(cible, d); return; }
  const t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 700), k = 1 - Math.pow(1 - p, 3); el.textContent = fr(dep + (cible - dep) * k, d); if (p < 1 && anime.get(el) === cible) requestAnimationFrame(f); })(t0);
}
function jauge(id, val, d, pct, alerte) {
  const j = $(id); compter(j.querySelector('[data-v]'), val, d);
  j.querySelector('.barre b').style.width = clamp(pct, 0, 100) + '%';
  j.classList.toggle('alerte', !!alerte);
}
function flotter(deltas) {
  const map = { def: '#j-def', op: '#j-op', maj: '#j-maj', ten: '#j-ten' };
  for (const [k, sel] of Object.entries(map)) {
    const v = deltas[k]; if (!v || Math.abs(v) < .05) continue;
    const [, , d, sens] = LIB[k]; const s = document.createElement('span');
    s.className = 'flottant ' + (v * sens > 0 ? 'bon' : 'mal'); s.textContent = (v > 0 ? '+' : '−') + fr(Math.abs(v), d);
    $(sel).appendChild(s); setTimeout(() => s.remove(), 1700);
  }
}
function rendre(premier) {
  sauver();
  const an = Math.floor(S.tour / 4) + 1;
  $('#date').textContent = `Année ${an} · ${SAISONS[S.tour % 4]}`;
  $('#temps').innerHTML = Array.from({ length: 20 }, (_, i) => `<i class="${i < S.tour ? 'fait' : i === S.tour ? 'ici' : ''}${i && i % 4 === 0 ? ' an' : ''}"></i>`).join('');
  jauge('#j-def', S.def, 1, S.def / 250 * 100, S.def > 165);
  jauge('#j-op', S.op, 0, S.op, S.op < 25);
  jauge('#j-maj', S.maj, 0, S.maj / 577 * 100, S.maj < 250);
  jauge('#j-ten', S.ten, 0, S.ten, S.ten >= 63);
  $('#rue-niv').textContent = RUE[S.rue][0]; $('#rue-niv').style.color = S.rue >= 3 ? 'var(--argile)' : S.rue ? 'var(--or)' : 'var(--iv3)';
  $('#services').innerHTML = Object.entries(DOMAINES).map(([k, n]) => {
    const v = Math.round(S[k]); const c = v < 30 ? 'var(--argile)' : v < 50 ? 'var(--or)' : 'var(--bleu)';
    return `<div class="serv"><span>${n}</span><div class="barre"><b style="width:${v}%;background:${c}"></b></div><b class="v tab">${v}</b></div>`;
  }).join('');
  $('#chantiers').innerHTML = S.chantiers.length ? S.chantiers.map(c => `<li><span>${c.t}</span><div class="pips" aria-label="${c.fait} sur ${c.n} trimestres">${Array.from({ length: c.n }, (_, i) => `<i class="${i < c.fait ? 'ok' : ''}"></i>`).join('')}</div></li>`).join('') : '<p class="vide">Aucun chantier lancé.</p>';
  $('#journal').innerHTML = S.fil.slice(-7).reverse().map(j => `<li><span>${j.q}</span>${j.t}</li>`).join('') || '<li class="vide">Le mandat commence.</li>';
  const dispo = S.reformeTour !== S.tour;
  $('#b-reformes').textContent = dispo ? 'Grandes réformes' : 'Réforme présentée ce trimestre';
  $('#b-reformes').disabled = !dispo;
  $('#feu').style.opacity = clamp((S.ten - 30) / 60, 0, 1);
  // points de la carte
  const pts = [];
  S.main.forEach(m => { const d = dossier(m.id); if (m.choix === null) pts.push({ v: d.ville, c: d.crise ? 'crise' : '', l: d.titre, id: d.id }); });
  S.chantiers.forEach(c => c.ville && pts.push({ v: c.ville, c: 'chantier', l: c.t }));
  $('#points').innerHTML = pts.map(p => { const [x, y] = VILLES[p.v] || [50, 50]; return `<div class="point ${p.c}" data-id="${p.id || ''}" style="left:${x}%;top:${y}%"><i></i><span>${p.v}</span></div>`; }).join('');
  // main
  const restants = S.main.filter(m => m.choix === null).length;
  $('#reste').textContent = restants ? `${restants} dossier${restants > 1 ? 's' : ''} à trancher` : 'tout est signé';
  $('#cartes').innerHTML = S.main.map(m => {
    const d = dossier(m.id); const o = m.choix !== null ? d.options[m.choix] : null;
    return `<button type="button" class="dossier ${d.crise ? 'crise' : ''} ${d.suite ? 'suite' : ''} ${o ? 'signe' : ''}" data-id="${d.id}" ${o ? 'aria-disabled="true"' : ''}>
      <span class="sur"><span>${d.crise ? 'Crise · ' : ''}${d.dom} · ${d.ville}</span></span>
      <span class="t">${d.titre}</span>
      ${o ? `<span class="x choix-fait">${o.t}</span><span class="tampon">Signé</span>` : `<span class="x">${d.texte}</span>`}
    </button>`;
  }).join('');
  if (S.donne) {
    S.donne = false;
    document.querySelectorAll('.dossier').forEach((c, i) => { c.classList.add('donne'); c.style.animationDelay = (reduit ? 0 : 150 + i * 160) + 'ms'; c.style.setProperty('--r', (i % 2 ? 6 : -6) + 'deg'); });
    if (S.main.some(m => dossier(m.id).crise) && !premier) setTimeout(alerte, reduit ? 0 : 300);
    if (S.flash) { S.flash.forEach((v, i) => setTimeout(() => onde(v, 'var(--bleu)'), 500 + i * 300)); S.flash = null; }
  }
  document.querySelectorAll('.dossier:not(.signe)').forEach(b => {
    b.addEventListener('click', () => ouvrir(b.dataset.id));
    b.addEventListener('mouseenter', () => surligner(b.dataset.id, true));
    b.addEventListener('mouseleave', () => surligner(b.dataset.id, false));
    b.addEventListener('focus', () => surligner(b.dataset.id, true));
    b.addEventListener('blur', () => surligner(b.dataset.id, false));
  });
}
function surligner(id, on) { document.querySelectorAll(`.point[data-id="${id}"]`).forEach(p => p.classList.toggle('actif', on)); }

/* ---------- Décision ---------- */
let ouvert = null, retourFocus = null;
function ouvrir(id) {
  if (enCours) return;
  const d = dossier(id); ouvert = id; retourFocus = document.activeElement;
  $('#d-sur').textContent = `${d.crise ? 'Crise · ' : d.suite ? 'Conséquence · ' : ''}${d.dom} · ${d.ville}`;
  $('#d-titre').textContent = d.titre; $('#d-texte').textContent = d.texte;
  $('#d-options').classList.remove('verrou');
  $('#d-options').innerHTML = d.options.map((o, i) => `<button type="button" class="option" data-i="${i}"><b>${o.t}</b>${o.d ? `<span>${o.d}</span>` : ''}<span class="puces">${puces(o.e)}${o.risque ? `<span class="puce risque">⚠ Risque ${Math.round(o.risque.p * 100)} % : ${o.risque.titre.toLowerCase()}</span>` : ''}${o.special === 'dissolution' ? '<span class="puce plus-tard">Nouvelle Assemblée selon votre opinion</span>' : ''}${o.special === 'demission' ? '<span class="puce mal">Fin du mandat</span>' : ''}${o.ch ? puces(o.ch.e, true).replace(/(<span class="puce plus-tard"[^>]*>)/g, `$1Dans ${o.ch.n} trim. · `) : ''}</span></button>`).join('') + '<p class="note-hyp">Effets : hypothèses de jeu. Les pointillés arrivent plus tard, sur la frise des chantiers.</p>';
  $('#d-options').querySelectorAll('.option').forEach(b => b.addEventListener('click', () => decider(+b.dataset.i)));
  const p = $('#decision'); p.hidden = false; requestAnimationFrame(() => { p.classList.add('ouvert'); $('#voile-dec').classList.add('ouvert'); });
  surligner(id, true);
  setTimeout(() => $('#d-options .option').focus(), reduit ? 0 : 250);
}
function fermer() {
  const p = $('#decision'); p.classList.remove('ouvert'); $('#voile-dec').classList.remove('ouvert');
  setTimeout(() => { p.hidden = true; }, reduit ? 0 : 350);
  const etaitReforme = ouvert === '__reformes';
  if (ouvert && !etaitReforme) surligner(ouvert, false); ouvert = null; mode = 'dossier';
  if (etaitReforme) setTimeout(verifierFin, reduit ? 0 : 900);
  if (retourFocus && document.contains(retourFocus)) retourFocus.focus();
}
let enCours = false;
function decider(i) {
  if (enCours) return; enCours = true;
  const d = dossier(ouvert); const o = d.options[i];
  const btn = document.querySelector(`#d-options .option[data-i="${i}"]`);
  btn.classList.add('choisie'); $('#d-options').classList.add('verrou');
  btn.insertAdjacentHTML('beforeend', '<svg class="encre" viewBox="0 0 150 44" aria-hidden="true"><path d="M4 30 C 18 6, 30 6, 32 26 S 40 44, 52 22 C 60 8, 70 10, 70 28 C 70 40, 84 38, 92 20 C 98 8, 110 10, 112 26 C 113 36, 126 34, 146 18"/></svg>');
  const pucesEl = [...btn.querySelectorAll('.puce:not(.plus-tard)')];
  setTimeout(() => {
    const rects = pucesEl.map(p => ({ p, r: p.getBoundingClientRect() }));
    fermer(); onde(d.ville, d.crise ? 'var(--argile)' : 'var(--or)');
    rects.forEach(({ p, r }, j) => voler(p, r, j));
    setTimeout(() => { appliquerDecision(d, o, i); enCours = false; }, reduit ? 0 : 760);
  }, reduit ? 0 : 480);
}
function cible(k) { return { def: '#j-def', taux: '#j-def', op: '#j-op', maj: '#j-maj', ten: '#j-ten' }[k] || '#services'; }
function voler(p, r, j) {
  if (reduit) return;
  const t = $(cible(p.dataset.k)).getBoundingClientRect();
  const c = p.cloneNode(true); c.classList.add('vol');
  Object.assign(c.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' }); document.body.appendChild(c);
  const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
  c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * .5}px,${dy * .5 - 60}px) scale(1.08)`, opacity: 1, offset: .55 }, { transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0 }],
    { duration: 720, delay: j * 70, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => c.remove();
}
function pulser(deltas) {
  const map = { def: '#j-def', op: '#j-op', maj: '#j-maj', ten: '#j-ten' };
  for (const [k, sel] of Object.entries(map)) { const v = deltas[k]; if (!v || Math.abs(v) < .05) continue; const el = $(sel); el.classList.remove('pulse', 'negatif'); void el.offsetWidth; el.classList.add('pulse'); if (v * LIB[k][3] < 0) el.classList.add('negatif'); }
}
function onde(ville, couleur) {
  if (reduit) return; const [x, y] = VILLES[ville] || [50, 50]; const carte = $('#carte');
  ['', 'b'].forEach(cl => { const o = document.createElement('span'); o.className = 'onde ' + cl; o.style.left = x + '%'; o.style.top = y + '%'; o.style.setProperty('--c', couleur); carte.appendChild(o); setTimeout(() => o.remove(), 1600); });
  if (window.__etincelles) window.__etincelles(x, y, couleur);
}
function alerte() {
  if (reduit) return;
  const a = document.createElement('div'); a.className = 'alerte-ecran'; document.body.appendChild(a);
  const b = document.createElement('div'); b.className = 'bandeau'; b.textContent = 'Alerte · crise en cours'; document.body.appendChild(b);
  setTimeout(() => { a.remove(); b.remove(); }, 2100);
}
function appliquerDecision(d, o, i) {
  const m = S.main.find(x => x.id === d.id); m.choix = i;
  const deltas = appliquer(o.e, true); pulser(deltas);
  let derapage = null;
  if (o.risque && rng() < o.risque.p) { derapage = o.risque; pulser(appliquer(o.risque.e, true)); S.titres.push({ k: 'c', l: 'Dérapage', t: o.risque.h }); }
  if (o.special === 'dissolution') { const avant = S.maj; S.maj = clamp(Math.round(289 + (S.op - 40) * 5 + (rng() - .5) * 60), 120, 420); S.censures = 0; S.n493 = 0; S.titres.push({ k: S.maj >= avant ? 'b' : 'c', l: 'Législatives', t: `Nouvelle Assemblée : ${S.maj} sièges pour votre camp` }); }
  if (o.special === 'demission') { setTimeout(() => fin('abandon'), reduit ? 0 : 600); }
  const suite = () => { if (!S.fini && S.main.every(x => x.choix !== null)) setTimeout(verifierFin, reduit ? 300 : 1100); };
  if (o.special === 'demission') S.fini = true;
  if (derapage) { alerte(); evenement('Dérapage', derapage.titre, derapage.texte, null, '/mandats/art/rupture.webp', [['Faire face', suite]]); } else suite();
  if (o.ch) S.chantiers.push({ t: o.ch.t, n: o.ch.n, fait: 0, e: o.ch.e, ville: d.ville });
  if (o.f) S.f[o.f] = S.tour;
  S.titres.push({ k: d.crise ? 'c' : '', l: d.dom, t: o.h });

  S.decisions.push({ tour: S.tour, dossier: d.titre, choix: o.t, poids: Object.values(o.e).reduce((a, v) => a + Math.abs(v), 0) + (o.ch ? 6 : 0) });
  rendre();
  const suivant = document.querySelector('.dossier:not(.signe)'); if (suivant) suivant.focus();
}
$('#d-fermer').addEventListener('click', fermer);
$('#voile-dec').addEventListener('click', fermer);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ouvert) fermer(); });

/* ---------- Fin de trimestre ---------- */
function moyenneServices() { return Object.keys(DOMAINES).reduce((a, k) => a + S[k], 0) / 6; }
function evoluer() {
  const avant = { op: S.op, ten: S.ten, def: S.def };
  // chantiers
  const livres = [];
  S.chantiers.forEach(c => { c.fait++; if (c.fait >= c.n) { appliquer(c.e); livres.push(c); } });
  S.chantiers = S.chantiers.filter(c => c.fait < c.n);
  livres.forEach(c => S.titres.push({ k: 'b', l: 'Livré', t: c.t }));
  S.flash = livres.map(c => c.ville);
  // budget voté : effets permanents par trimestre
  for (const k of Object.keys(DOMAINES)) S[k] = clamp(S[k] - .7 + S.budget[k] * .9 + (rng() - .5) * 1.4, 0, 100);
  // dynamiques
  const ms = moyenneServices();
  S.ten = clamp(S.ten + (50 - ms) * .09 + (40 - S.op) * .05 - (S.ten - 40) * .06 + (rng() - .5) * 3, 0, 100);
  S.op = clamp(S.op + (ms - 50) * .06 - (S.ten - 50) * .04 - (S.op - 42) * .07 - .3 + (rng() - .5) * 2, 0, 100);
  if (S.def > 165) S.taux = clamp(S.taux + .12, 1, 8); else if (S.def > 158) S.taux = clamp(S.taux + .06, 1, 8); else if (S.def < 135) S.taux = clamp(S.taux - .05, 1, 8);
  if (S.op < 30) S.maj = clamp(S.maj - 3, 120, 420);
  if (S.tour % 4 === 3) S.def = clamp(S.def + (S.taux - 3.3) * 5, 40, 320);
  // la rue : un niveau par trimestre vers la cible
  const cibleN = S.ten < 52 ? 0 : S.ten < 63 ? 1 : S.ten < 73 ? 2 : S.ten < 84 ? 3 : 4;
  if (cibleN > S.rue) { S.rue++; S.titres.push({ k: 'c', l: 'La rue', t: RUE[S.rue][1] }); }
  else if (cibleN < S.rue) { S.rue--; S.titres.push({ k: 'b', l: 'La rue', t: S.rue ? `La mobilisation reflue : ${RUE[S.rue][0].toLowerCase()}` : 'Le calme revient dans le pays' }); }
  S.insurrection = S.rue === 4 ? S.insurrection + 1 : 0;
  // titres de tendance
  if (S.ten - avant.ten >= 4) S.titres.push({ k: 'c', l: 'Société', t: 'La colère monte dans le pays' });
  if (S.op - avant.op <= -3) S.titres.push({ k: 'c', l: 'Sondage', t: `La cote de confiance recule à ${fr(S.op)} %` });
  if (S.op - avant.op >= 3) S.titres.push({ k: 'b', l: 'Sondage', t: `La cote de confiance remonte à ${fr(S.op)} %` });
  if (S.taux >= 4) S.titres.push({ k: 'c', l: 'Marchés', t: `La France emprunte à ${fr(S.taux, 1)} %` });
}
function finSiPerdu() {
  if (S.op <= 8 && S.ten >= 88) return fin('demission');
  if (S.def >= 215) return fin('tutelle');
  if (S.insurrection >= 2) return fin('renverse');
  return false;
}
function verifierFin() { if (!S.fini && !ouvert && !enCours && !document.querySelector('.ecran.ouvert') && S.main.every(m => m.choix !== null)) clore(); }
function clore() {
  if (S.cloture === S.tour) return; S.cloture = S.tour;
  if (S.tour % 4 === 3 && S.tour < 19) return ouvrirBudget();
  passer();
}
function passer() {
  evoluer();
  if (finSiPerdu()) return;
  if (S.tour === 19) return fin('terme');
  const titres = S.titres.slice(); S.titres = [];
  S.tour++;
  const q = `A${Math.floor(S.tour / 4) + 1}`;
  titres.forEach(t => S.fil.push({ q, t: t.t }));
  tirer(); rendre(); bandeau(titres);
  if (innerWidth <= 900) scrollTo({ top: 0, behavior: reduit ? 'auto' : 'smooth' });
}
let minuteur;
function bandeau(titres) {
  const tk = $('#ticker'); clearTimeout(minuteur);
  const duree = reduit ? 7000 : 4200 + titres.length * 500;
  $('#ticker-sur').textContent = `${S.tour % 4 === 0 ? 'Nouvelle année · ' : 'Trois mois plus tard · '}Année ${Math.floor(S.tour / 4) + 1} · ${SAISONS[S.tour % 4]}`;
  $('#ticker-l').innerHTML = (titres.length ? titres.slice(-5) : [{ k: '', l: 'Calme', t: 'Un trimestre sans remous' }]).map((t, i) => `<li style="animation-delay:${reduit ? 0 : 150 + i * 140}ms"><span class="${t.k}">${t.l}</span>${t.t}</li>`).join('') + `<li class="barre-t" style="display:block;opacity:1;animation:none"><b style="animation-duration:${duree}ms"></b></li>`;
  tk.hidden = false; tk.classList.remove('sort');
  minuteur = setTimeout(cacherBandeau, duree);
}
function cacherBandeau() { const tk = $('#ticker'); if (tk.hidden) return; tk.classList.add('sort'); setTimeout(() => { tk.hidden = true; tk.classList.remove('sort'); }, reduit ? 0 : 450); }
$('#ticker').addEventListener('click', cacherBandeau);


/* ---------- Budget ---------- */
const POSTES = [['sante', 'Santé', 'Hôpitaux, soins'], ['educ', 'Éducation', 'Écoles, universités'], ['secu', 'Sécurité', 'Police, justice'], ['loge', 'Logement', 'Construction, aides'], ['trans', 'Transports', 'Rail, routes'], ['ener', 'Énergie', 'Réseaux, transition']];
let projet;
function ouvrirBudget() {
  projet = { ...S.budget };
  const an = Math.floor(S.tour / 4) + 2;
  $('#t-budget').innerHTML = `Le budget de <em>l’année ${an}</em>`;
  $('#lignes-b').innerHTML = POSTES.map(([k, n, s]) => `<div class="ligne-b"><div><b>${n}</b><small>${s}</small></div><div class="pas"><button type="button" data-k="${k}" data-s="-1" aria-label="Baisser ${n}">−</button><output id="o-${k}" class="tab"></output><button type="button" data-k="${k}" data-s="1" aria-label="Augmenter ${n}">+</button></div></div>`).join('') +
    `<div class="ligne-b"><div><b>Impôts</b><small>Un cran = 5 Md€ de recettes</small></div><div class="pas"><button type="button" data-k="impots" data-s="-1" aria-label="Baisser les impôts">−</button><output id="o-impots" class="tab"></output><button type="button" data-k="impots" data-s="1" aria-label="Augmenter les impôts">+</button></div></div>`;
  $('#lignes-b').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const k = b.dataset.k; projet[k] = clamp(projet[k] + +b.dataset.s, k === 'impots' ? -2 : -3, 3); majBudget(); }));
  majBudget(); ecran('#e-budget');
}
function calculBudget() {
  const dep = POSTES.reduce((a, [k]) => a + projet[k] - S.budget[k], 0) * 2;
  const rec = (projet.impots - S.budget.impots) * 5;
  const def = S.def + dep - rec;
  const recettes = 1561.63 + projet.impots * 5;
  const pour100 = (recettes + def) / recettes * 100;
  const coupes = POSTES.reduce((a, [k]) => a + Math.min(0, projet[k]), 0);
  const abst = clamp(Math.round(95 + (S.op - 40) * 2 - Math.max(0, projet.impots) * 18 + coupes * 6 - S.n493 * 8), 10, 180);
  const pour = clamp(Math.round(S.maj + Math.max(0, POSTES.reduce((a, [k]) => a + Math.max(0, projet[k]), 0)) * 3), 0, 577 - abst);
  const contre = 577 - pour - abst;
  return { def, pour100, pour, abst, contre, passe: pour > contre, dep, rec };
}
function majBudget() {
  POSTES.forEach(([k]) => { const v = projet[k]; $('#o-' + k).textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + fr(Math.abs(v) * 2) + ' Md€'; });
  $('#o-impots').textContent = (projet.impots > 0 ? '+' : projet.impots < 0 ? '−' : '') + fr(Math.abs(projet.impots) * 5) + ' Md€';
  const b = calculBudget();
  $('#b-depense').textContent = fr(b.pour100, 2); $('#b-deficit').textContent = fr(b.def, 1) + ' Md€';
  $('#b-barre').innerHTML = `<i style="flex-basis:${100 / b.pour100 * 100}%;background:var(--or)"></i><i style="flex-basis:${(b.pour100 - 100) / b.pour100 * 100}%;background:var(--argile)"></i>`;
  $('#v-pour').textContent = b.pour; $('#v-abs').textContent = b.abst; $('#v-contre').textContent = b.contre;
  $('#v-pronostic').textContent = b.passe ? 'Pronostic : le texte passerait.' : 'Pronostic : le texte serait rejeté.';
  $('#v-pronostic').style.color = b.passe ? 'var(--bleu)' : 'var(--argile)';
}
function adopter(b) {
  const dImp = projet.impots - S.budget.impots;
  S.def = clamp(b.def, 40, 320);
  S.op = clamp(S.op - Math.max(0, dImp) * 3 + Math.max(0, -dImp) * 2, 0, 100);
  S.ten = clamp(S.ten + Math.max(0, dImp) * 3 - POSTES.reduce((a, [k]) => a + Math.min(0, projet[k] - S.budget[k]), 0) * 1.5, 0, 100);
  S.budget = { ...projet };
}
$('#b-voter').addEventListener('click', () => {
  const b = calculBudget(); ferme('#e-budget');
  if (b.passe) { adopter(b); S.titres.push({ k: 'b', l: 'Assemblée', t: `Budget adopté : ${b.pour} pour, ${b.contre} contre` }); evenement('Assemblée nationale', 'Budget adopté', `${b.pour} voix pour, ${b.contre} contre, ${b.abst} abstentions.`, b, '/mandats/art/parliament.webp', [['Continuer', passer]]); }
  else { S.op = clamp(S.op - 4, 0, 100); S.titres.push({ k: 'c', l: 'Assemblée', t: 'Le budget rejeté par les députés' }); evenement('Assemblée nationale', 'Budget rejeté', `${b.pour} voix pour, ${b.contre} contre. Le budget de l’année en cours est reconduit et votre autorité en sort affaiblie.`, b, '/mandats/art/parliament.webp', [['Revenir au budget', ouvrirBudget], ['Reconduire et continuer', passer]]); }
});
$('#b-493').addEventListener('click', () => {
  const b = calculBudget(); ferme('#e-budget');
  adopter(b); S.titres.push({ k: 'c', l: '49.3', t: 'Budget : le gouvernement engage sa responsabilité' });
  motionCensure(passer);
});
function motionCensure(apres) {
  S.n493++; S.op = clamp(S.op - 4, 0, 100); S.ten = clamp(S.ten + 5, 0, 100);
  const abst = clamp(Math.round(130 + (S.op - 40) * 2 - S.n493 * 18), 0, 200);
  const censure = clamp(577 - S.maj - abst, 0, 577);
  if (censure >= 289) {
    S.censures++; S.maj = clamp(S.maj + 12, 120, 420); S.op = clamp(S.op - 4, 0, 100); S.ten = clamp(S.ten - 6, 0, 100);
    S.titres.push({ k: 'c', l: 'Censure', t: `Le gouvernement renversé par ${censure} voix` });
    if (S.censures >= 3) return fin('censure');
    evenement('Motion de censure', 'Gouvernement renversé', `${censure} députés votent la censure. Vous nommez un nouveau Premier ministre, plus ouvert au compromis. Le texte reste adopté.`, { pour: censure, abst, contre: 577 - censure - abst }, '/mandats/art/rupture.webp', [['Nommer un nouveau gouvernement', apres]]);
  } else {
    evenement('Motion de censure', 'La censure échoue', `${censure} voix sur les 289 nécessaires. Le texte est adopté sans vote, mais l’opinion n’oublie pas.`, { pour: censure, abst, contre: 577 - censure - abst }, '/mandats/art/parliament.webp', [['Continuer', apres]]);
  }
}

/* ---------- Grandes réformes ---------- */
let mode = 'dossier';
function ouvrirReformes() {
  if (enCours || S.reformeTour === S.tour) return;
  mode = 'reforme'; ouvert = '__reformes'; retourFocus = document.activeElement;
  $('#d-sur').textContent = 'Grandes réformes · une par trimestre';
  $('#d-titre').textContent = 'Les réformes qui pèsent';
  $('#d-texte').textContent = 'Des économies de plusieurs milliards par an, au prix de votre majorité et de la rue. Chaque texte passe devant l’Assemblée.';
  $('#d-options').classList.remove('verrou');
  $('#d-options').innerHTML = REFORMES.filter(r => !S.reformes[r.id] || S.reformes[r.id] === 'rejet' && S.tour - (S.reformes[r.id + '_t'] || 0) >= 4).map(r => {
    const v = voteReforme(r);
    return `<button type="button" class="option" data-r="${r.id}"><span class="reforme-eco tab">−${fr(r.eco, r.eco % 1 ? 1 : 0)} Md€/an</span><b>${r.t}</b>${r.d ? `<span>${r.d}</span>` : ''}<span class="puces">${puces(r.e)}${r.risque ? `<span class="puce risque">⚠ Risque ${Math.round(r.risque.p * 100)} % : ${r.risque.titre.toLowerCase()}</span>` : ''}${r.ch ? puces(r.ch.e, true).replace(/<span class="puce plus-tard"/g, `<span class="puce plus-tard" data-pt`).replace(/data-pt([^>]*)>/g, `$1>Dans ${r.ch.n} trim. · `) : ''}<span class="puce ${v.passe ? 'bon' : 'mal'}">Pointage : ${v.pour} pour, ${v.contre} contre</span></span></button>`;
  }).join('') + '<p class="note-hyp">Montants : ordres de grandeur, hypothèses de jeu. Le pointage dépend de votre majorité et de votre popularité.</p>';
  $('#d-options').querySelectorAll('.option').forEach(b => b.addEventListener('click', () => presenter(REFORMES.find(r => r.id === b.dataset.r))));
  const p = $('#decision'); p.hidden = false; requestAnimationFrame(() => { p.classList.add('ouvert'); $('#voile-dec').classList.add('ouvert'); });
  setTimeout(() => { const o = $('#d-options .option'); if (o) o.focus(); }, reduit ? 0 : 250);
}
function voteReforme(r) {
  const abst = clamp(Math.round(80 + (S.op - 40) * 2), 10, 170);
  const pour = clamp(S.maj + r.vote, 0, 577 - abst);
  const contre = 577 - pour - abst;
  return { pour, abst, contre, passe: pour > contre };
}
function presenter(r) {
  if (enCours) return; enCours = true;
  S.reformeTour = S.tour; fermer(); mode = 'dossier';
  const v = voteReforme(r);
  setTimeout(() => {
    enCours = false;
    if (v.passe) { adopterReforme(r); evenement('Assemblée nationale', 'Réforme adoptée', `${r.t}. ${v.pour} voix pour, ${v.contre} contre.`, v, '/mandats/art/parliament.webp', [['Continuer', apresReforme]]); }
    else {
      const actions = [['Renoncer', () => { S.reformes[r.id] = 'rejet'; S.reformes[r.id + '_t'] = S.tour; S.op = clamp(S.op - 3, 0, 100); S.titres.push({ k: 'c', l: 'Assemblée', t: `Réforme rejetée : ${r.t.toLowerCase()}` }); apresReforme(); }]];
      if (S.an493 !== Math.floor(S.tour / 4)) actions.unshift(['Passer en force avec le 49.3', () => { S.an493 = Math.floor(S.tour / 4); adopterReforme(r); S.titres.push({ k: 'c', l: '49.3', t: `49.3 sur la réforme : ${r.t.toLowerCase()}` }); motionCensure(apresReforme); }]);
      evenement('Assemblée nationale', 'Réforme rejetée', `${v.pour} voix pour, ${v.contre} contre. Vous pouvez engager la responsabilité du gouvernement, une fois par an hors budget.`, v, '/mandats/art/parliament.webp', actions);
    }
  }, reduit ? 0 : 400);
}
function adopterReforme(r) {
  S.reformes[r.id] = 'adoptee';
  pulser(appliquer(r.e, true));
  if (r.ch) S.chantiers.push({ t: r.ch.t, n: r.ch.n, fait: 0, e: r.ch.e, ville: 'Paris' });
  S.titres.push({ k: '', l: 'Réforme', t: `${r.t} : adoptée` });
  S.decisions.push({ tour: S.tour, dossier: 'Grande réforme', choix: r.t, poids: r.eco + 10 });
  S.fil.push({ q: `A${Math.floor(S.tour / 4) + 1}`, t: `Réforme adoptée : ${r.t}` });
  if (r.risque && rng() < r.risque.p) { appliquer(r.risque.e, true); S.titres.push({ k: 'c', l: 'Dérapage', t: r.risque.h }); S.fil.push({ q: `A${Math.floor(S.tour / 4) + 1}`, t: r.risque.h }); }
  onde('Paris', 'var(--or)');
}
function apresReforme() { rendre(); if (finSiPerdu()) return; setTimeout(verifierFin, reduit ? 0 : 900); }
$('#b-reformes').addEventListener('click', ouvrirReformes);

/* ---------- Hémicycle ---------- */
function hemicycle(pour, abst, contre, libs) {
  const rangs = [26, 32, 38, 44, 50, 56, 62, 68, 76, 84, 92];
  const sieges = []; rangs.forEach((n, r) => { const R = 60 + r * 12; for (let i = 0; i < n; i++) { const a = Math.PI * (1 - i / (n - 1)); sieges.push({ x: 200 + R * Math.cos(a), y: 200 - R * Math.sin(a), a }); } });
  sieges.sort((p, q) => q.a - p.a);
  const total = sieges.length, k = total / 577;
  const nP = Math.round(pour * k), nA = Math.round(abst * k);
  return `<svg class="hemi" viewBox="0 0 400 210" role="img" aria-label="${libs[0]} ${pour}, ${libs[1]} ${abst}, ${libs[2]} ${contre}">${sieges.map((s, i) => `<circle class="siege" style="animation-delay:${reduit ? 0 : 300 + i * 2.2}ms" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="3.6" fill="${i < nP ? 'var(--bleu)' : i < nP + nA ? 'rgba(244,239,227,.35)' : 'var(--argile)'}"/>`).join('')}</svg>`;
}
function evenement(sur, titre, texte, v, fond, actions) {
  $('#evt-sur').textContent = sur; lettres($('#t-evt'), titre); $('#evt-texte').textContent = texte;
  $('#evt-fond').style.backgroundImage = `url(${fond})`;
  $('#evt-hemi').innerHTML = v ? `<div style="max-width:620px">${hemicycle(v.pour, v.abst, v.contre, sur.includes('censure') ? ['Censure', 'Abstention', 'Contre la censure'] : ['Pour', 'Abstention', 'Contre'])}</div>` : '';
  $('#evt-actions').innerHTML = '';
  actions.forEach(([l, f], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cta' + (i ? ' second' : ''); b.textContent = l; b.addEventListener('click', () => { ferme('#e-evt'); f(); }); $('#evt-actions').appendChild(b); });
  ecran('#e-evt'); $('#evt-actions button').focus();
}

/* ---------- Fins ---------- */
function fin(type) {
  S.fini = true; sauver();
  const ms = moyenneServices();
  const score = Math.round(clamp(50 + (S.op - 40) * .8 + (ms - 50) * .5 - (S.ten - 40) * .3 - (S.def - 152.51) * .35, 2, 98));
  const T = {
    terme: score >= 55 ? ['Réélu', 'Les Français vous renouvellent leur confiance.'] : score >= 40 ? ['Second tour serré', 'Un bilan défendable, une campagne indécise.'] : ['Battu', 'Le pays tourne la page de votre mandat.'],
    demission: ['Démission', 'La rue et les sondages ont eu raison de votre mandat.'],
    tutelle: ['Sous tutelle', 'Les créanciers imposent leur programme. Le mandat s’achève sur une crise de la dette.'],
    censure: ['Crise de régime', 'Trois gouvernements renversés. Vous dissolvez et perdez le contrôle du Parlement.'],
    renverse: ['Renversé par la rue', 'L’insurrection a duré deux trimestres. Vous quittez l’Élysée sous les huées.'],
    abandon: ['Démission', 'Vous avez choisi de partir. Une élection anticipée est convoquée.']
  }[type];
  $('#fin-sur').textContent = type === 'terme' ? `Fin du mandat · ${S.profil}` : `Fin prématurée · année ${Math.floor(S.tour / 4) + 1}`;
  lettres($('#t-fin'), T[0]); $('#fin-texte').textContent = T[1] + (type === 'terme' ? ` Intentions de vote : ${score} % au second tour.` : '');
  $('#fin-fond').style.backgroundImage = `url(${type === 'terme' && score >= 40 ? '/mandats/art/legacy.webp' : '/mandats/art/rupture.webp'})`;
  $('#fin-chiffres').innerHTML = [['Déficit', fr(S.def, 1) + ' Md€', `152,51 au départ`], ['Opinion', fr(S.op) + ' %', ''], ['Services publics', fr(ms) + ' / 100', ''], ['Tension sociale', fr(S.ten) + ' / 100', '']].map(([a, b, c]) => `<div><span>${a}</span><b class="tab">${b}</b><small>${c}</small></div>`).join('');
  $('#fin-decisions').innerHTML = S.decisions.slice().sort((a, b) => b.poids - a.poids).slice(0, 5).map((d, i) => `<li style="animation-delay:${reduit ? 0 : i * 150}ms"><span>Année ${Math.floor(d.tour / 4) + 1}</span><b>${d.dossier} · ${d.choix}</b></li>`).join('');
  ecran('#e-fin'); $('#b-rejouer').focus();
  if (type === 'terme') { const sp = document.createElement('b'); sp.className = 'tab'; sp.style.color = 'var(--or)'; $('#fin-texte').innerHTML = T[1] + ' Intentions de vote au second tour : '; $('#fin-texte').append(sp, ' %'); anime.set(sp, 0); compter(sp, score, 0); if (score >= 55) poussiere(); }
  return true;
}
$('#b-rejouer').addEventListener('click', () => { ferme('#e-fin'); ecran('#e-intro'); });
function poussiere() {
  if (reduit) return;
  const cv = document.createElement('canvas'); cv.id = 'poussiere'; document.body.appendChild(cv);
  const x = cv.getContext('2d'), dpr = devicePixelRatio || 1; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; x.scale(dpr, dpr);
  const P = Array.from({ length: 160 }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight, v: 1 + Math.random() * 2.2, r: 1 + Math.random() * 2.6, o: Math.random() * 6.28 }));
  const t0 = performance.now();
  (function f(t) { const e = t - t0; x.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => { p.y += p.v; p.x += Math.sin((t / 600) + p.o) * .6; x.globalAlpha = Math.max(0, 1 - e / 5200); x.fillStyle = '#e8c870'; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.28); x.fill(); });
    if (e < 5400) requestAnimationFrame(f); else cv.remove(); })(t0);
}

function lettres(el, txt) {
  if (reduit) { el.textContent = txt; return; }
  el.setAttribute('aria-label', txt);
  el.innerHTML = txt.split(' ').map((m, mi) => `<span style="display:inline-block;white-space:nowrap" aria-hidden="true">${[...m].map((c, ci) => `<span class="lettre" style="animation-delay:${(mi * 4 + ci) * 28}ms">${c}</span>`).join('')}</span>`).join(' ');
}
/* ---------- Écrans ---------- */
function ecran(sel) { document.querySelectorAll('.ecran.ouvert').forEach(e => e.classList.remove('ouvert')); $(sel).classList.add('ouvert'); $(sel).scrollTop = 0; }
function ferme(sel) { $(sel).classList.remove('ouvert'); }
$('#profils').innerHTML = PROFILS.map((p, i) => `<button type="button" class="profil" data-i="${i}"><span class="mono">${p.maj} sièges · opinion ${p.op} %</span><b>${p.t}</b><span>${p.d}</span></button>`).join('');
$('#profils').querySelectorAll('.profil').forEach(b => b.addEventListener('click', () => { ferme('#e-intro'); nouvellePartie(PROFILS[+b.dataset.i]); const c = document.querySelector('.dossier'); if (c) c.focus(); }));
$('#b-regles').addEventListener('click', () => evenement('Règles', 'Comment jouer', 'Chaque trimestre, tranchez deux dossiers : un choix, un geste. Les effets s’affichent avant de signer ; les pointillés arrivent plus tard. Chaque automne, faites passer le budget. Surveillez la tension sociale (au-delà de 75, grève générale) et le déficit (au-delà de 175 Md€, les marchés réagissent). Le mandat dure vingt trimestres.', null, '/mandats/art/council.webp', [['Retour au jeu', verifierFin]]));
/* Carte vivante : villes qui scintillent, braises quand la tension monte, étincelles sur décision */
(function ciel() {
  if (reduit) return;
  const carte = $('#carte'), cv = document.createElement('canvas'); carte.insertBefore(cv, $('#points'));
  const x = cv.getContext('2d'); let W = 0, H = 0;
  function taille() { const r = carte.getBoundingClientRect(), dpr = devicePixelRatio || 1; W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
  new ResizeObserver(taille).observe(carte); taille();
  const lumieres = Object.values(VILLES).flatMap(([vx, vy]) => Array.from({ length: 5 }, () => ({ x: vx + (Math.random() - .5) * 4, y: vy + (Math.random() - .5) * 4, ph: Math.random() * 6.28, r: .6 + Math.random() * 1.2 })));
  let braises = [], etincelles = [];
  window.__etincelles = (px, py, c) => { const col = c.includes('argile') ? '224,122,85' : c.includes('bleu') ? '134,183,255' : '232,200,112'; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, v = .6 + Math.random() * 2.4; etincelles.push({ x: px / 100 * W, y: py / 100 * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .6, vie: 1, col }); } };
  (function f(t) {
    if (document.hidden) return requestAnimationFrame(f);
    x.clearRect(0, 0, W, H);
    lumieres.forEach(l => { const a = .35 + .35 * Math.sin(t / 900 + l.ph); x.fillStyle = `rgba(240,216,151,${a})`; x.beginPath(); x.arc(l.x / 100 * W, l.y / 100 * H, l.r, 0, 6.28); x.fill(); });
    const ten = S ? S.ten : 0;
    if (ten > 50 && Math.random() < (ten - 50) / 120) { const v = Object.values(VILLES)[Math.floor(Math.random() * 15)]; braises.push({ x: v[0] / 100 * W + (Math.random() - .5) * 30, y: v[1] / 100 * H, vy: -.3 - Math.random() * .7, vie: 1 }); }
    braises = braises.filter(b => (b.vie -= .008) > 0); braises.forEach(b => { b.y += b.vy; b.x += Math.sin(t / 400 + b.y) * .3; x.fillStyle = `rgba(224,122,85,${b.vie * .8})`; x.beginPath(); x.arc(b.x, b.y, 1.6, 0, 6.28); x.fill(); });
    etincelles = etincelles.filter(e => (e.vie -= .02) > 0); etincelles.forEach(e => { e.x += e.vx; e.y += e.vy; e.vy += .03; x.fillStyle = `rgba(${e.col},${e.vie})`; x.beginPath(); x.arc(e.x, e.y, 1.8, 0, 6.28); x.fill(); });
    requestAnimationFrame(f);
  })(0);
})();
const sauvegarde = lireSauvegarde();
nouvellePartie(PROFILS[0], true);
if (sauvegarde) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'profil reprise';
  b.innerHTML = `<span class="mono">Partie en cours</span><b>Reprendre mon mandat</b><span>Année ${Math.floor(sauvegarde.tour / 4) + 1} · ${SAISONS[sauvegarde.tour % 4]} · ${sauvegarde.profil}</span>`;
  b.addEventListener('click', () => reprendre(sauvegarde));
  $('#profils').prepend(b);
}
/* Hors connexion, sur demande : le même service que l'ancien jeu, qui précharge aussi cette page. */
const horsLigne = $('#b-hors-ligne');
if (horsLigne) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) horsLigne.hidden = true;
  horsLigne.addEventListener('click', async () => {
    horsLigne.disabled = true; horsLigne.textContent = 'Préparation…';
    try { const r = await navigator.serviceWorker.register('/mandats/sw.js', { scope: '/mandats/', updateViaCache: 'none' }); await navigator.serviceWorker.ready; horsLigne.textContent = r ? 'Prêt à jouer hors connexion' : 'Indisponible'; }
    catch { horsLigne.textContent = 'Hors connexion indisponible'; horsLigne.disabled = false; }
  });
}
