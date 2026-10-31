/**
 * Contrôleur de l'histoire de l'accueil (rendu : histoire.ts).
 * Une étape à la fois : bouton Suivant, toucher (moitié droite / gauche), glisser, flèches,
 * un geste de molette = une étape tant que la scène occupe l'écran ; aux deux bouts, la page
 * reprend son défilement normal. Mouvement réduit : mêmes états, sans animation.
 */
const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const VILLES: [string, number, number][] = [["Paris", 59, 27], ["Lille", 61, 15], ["Strasbourg", 79, 30], ["Rennes", 43, 36], ["Nantes", 43, 46], ["Bordeaux", 47, 62], ["Toulouse", 55, 75], ["Montpellier", 65, 74], ["Marseille", 72, 77], ["Lyon", 70, 52], ["Nice", 81, 71], ["Clermont-Fd", 61, 55]];
const PAIE_PILES = [[0, 0, 0], [26.7, 0, 0], [26.7, 8.3, 0], [26.7, 8.3, 12.2]];
const PAIE_TUBE = [100, 73.3, 65, 52.8];

let detacher: (() => void) | null = null;

export function brancherHistoire(): void {
  detacher?.(); detacher = null;
  const trouve = document.querySelector<HTMLElement>("[data-histoire]");
  if (!trouve) return;
  const racine: HTMLElement = trouve;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => racine.querySelector<T>(s)!;
  const etapes = [...racine.querySelectorAll<HTMLElement>(".histoire__etape")];
  if (!etapes.length) return;
  racine.classList.add("histoire--active");
  const nettoyages: (() => void)[] = [];
  const ecoute = <K extends keyof WindowEventMap>(cible: Window | Element, type: K | string, f: (e: any) => void, opt?: AddEventListenerOptions) => { cible.addEventListener(type, f, opt); nettoyages.push(() => cible.removeEventListener(type, f, opt)); };

  // Lumières des villes
  const lum = $(".histoire__lumieres");
  if (!lum.childElementCount) VILLES.forEach(([n, x, y], i) => { const l = document.createElement("i"); l.style.left = x + "%"; l.style.top = y + "%"; l.style.transitionDelay = i * .08 + "s"; l.style.animationDelay = i * .3 + "s"; l.dataset.n = n; lum.append(l); });

  // Arbre des dépenses
  const vArbre = racine.querySelector<HTMLElement>("[data-viz=arbre]");
  const postes: [string, number][] = vArbre ? JSON.parse(vArbre.dataset.postes || "[]") : [];
  function arbre() {
    if (!vArbre) return; vArbre.innerHTML = ""; const W = vArbre.clientWidth, H = vArbre.clientHeight; if (!W || !H) return;
    const tot = postes.reduce((s, p) => s + p[1], 0); const rangs = W < 600 ? [[0], [1], [2, 3], [4, 5, 6, 7, 8, 9]] : [[0], [1], [2, 3], [4, 5, 6], [7, 8, 9]]; let x = 0;
    rangs.forEach(r => { const ok = r.filter(i => postes[i]); const som = ok.reduce((s, i) => s + postes[i][1], 0); if (!som) return; const w = W * som / tot; let y = 0; ok.forEach(i => { const h = H * postes[i][1] / som; const d = document.createElement("div"); d.className = "histoire__tuile"; d.dataset.i = String(i); Object.assign(d.style, { left: x + 4 + "px", top: y + 4 + "px", width: Math.max(0, w - 8) + "px", height: Math.max(0, h - 8) + "px", transitionDelay: i * .05 + "s" }); const mini = h < 64 || w < 84; if (mini) d.classList.add("mini"); d.innerHTML = `<span>${postes[i][0]}</span><b>${fr(postes[i][1], mini ? 0 : 2)} €</b>`; vArbre.append(d); y += h; }); x += w; });
    majArbre();
  }
  function majArbre() { const s = etapes[cur]?.dataset; racine.querySelectorAll<HTMLElement>(".histoire__tuile").forEach(t => { const i = +t.dataset.i!, k = Number(s?.k), tous = k === 9, on = s?.tableau === "arbre"; t.classList.toggle("vue", on && (tous || i <= k)); t.classList.toggle("cle", on && !tous && i === k); t.classList.toggle("attenue", on && !tous && i < k); }); }

  // Canvas : billets et pièces
  const cv = $<HTMLCanvasElement>(".histoire__fx"), g = cv.getContext("2d")!; const zone = $(".histoire__zone");
  let W = 0, H = 0; const dpr = Math.min(2, devicePixelRatio || 1);
  type Billet = { x: number; y: number; z: number; r: number; vr: number; vx: number; ph: number; c: string[] };
  let billets: Billet[] = [], pieces: { j: number; t: number; x0: number; y0: number; y1: number; fini?: boolean }[] = [], piles = [0, 0, 0], tube = 100, scene = "", raf = 0; const t0 = performance.now();
  function taille() { const b = racine.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); arbre(); }
  function semer() { billets = Array.from({ length: reduit() ? 18 : 60 }, () => ({ x: Math.random() * W, y: reduit() ? Math.random() * H : -Math.random() * H * 1.2 - 40, z: .35 + Math.random() * .9, r: Math.random() * 6.28, vr: (Math.random() - .5) * .025, vx: (Math.random() - .5) * .5, ph: Math.random() * 6.28, c: Math.random() < .5 ? ["#7cae8c", "#d9e6cc", "#4f7f60"] : ["#8ba6cc", "#e1e8f3", "#5a7299"] })); }
  function billet(b: Billet, t: number) { g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.scale(b.z, b.z * (.35 + .65 * Math.abs(Math.cos(t * 1.3 + b.ph)))); g.globalAlpha = Math.min(1, .35 + b.z * .7); const w = 128, h = 66; g.fillStyle = b.c[2]; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = b.c[0]; g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); g.fillStyle = b.c[1]; g.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20); g.fillStyle = b.c[0]; g.beginPath(); g.arc(w / 2 - 30, 0, 16, 0, 7); g.fill(); g.fillStyle = "#1b2638"; g.font = "900 20px 'Public Sans', sans-serif"; g.fillText("100", -w / 2 + 16, h / 2 - 16); g.restore(); }
  function geo() { const zr = zone.getBoundingClientRect(), rr = racine.getBoundingClientRect(); const mob = W < 760; const r = Math.max(16, Math.min(mob ? 22 : 36, zr.height / 14)); const ep = Math.max(1.4, Math.min(3.6, (zr.height - 70) / 104)); return { r, ep, bx: zr.left - rr.left + r + 30, base: zr.bottom - rr.top - 40, gap: mob ? Math.max(66, (zr.width - 2 * r - 70) / 3) : Math.min(170, zr.width / 6), mob }; }
  const pileX = (j: number, o: ReturnType<typeof geo>) => o.bx + o.r + (o.mob ? 40 : 110) + o.gap * (j + .5);
  function piece(x: number, y: number, r: number) { g.fillStyle = "#6d4f17"; g.beginPath(); g.ellipse(x, y + r * .12, r, r * .3, 0, 0, 7); g.fill(); const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, "#9c7425"); gr.addColorStop(.45, "#f6dc93"); gr.addColorStop(1, "#9c7425"); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * .3, 0, 0, 7); g.fill(); g.strokeStyle = "#5a4012"; g.lineWidth = .6; g.stroke(); }
  const VAL = [26.7, 8.3, 12.2], LIB = ["Cotisations patronales", "Cotisations salariales", "Impôt"], LIBC = ["Patronales", "Salariales", "Impôt"];
  function dessinerPieces() {
    const o = geo(), { r, ep, bx, base, mob } = o; const th = 100 * ep + 24;
    const grd = g.createLinearGradient(bx - r - 8, 0, bx + r + 8, 0); grd.addColorStop(0, "#f4efe314"); grd.addColorStop(.5, "#f4efe306"); grd.addColorStop(1, "#f4efe318"); g.fillStyle = grd; g.strokeStyle = "#f4efe340"; g.beginPath(); (g as any).roundRect ? (g as any).roundRect(bx - r - 8, base - th, 2 * r + 16, th + 12, [r, r, 6, 6]) : g.rect(bx - r - 8, base - th, 2 * r + 16, th + 12); g.fill(); g.stroke();
    const n = Math.round(tube); for (let i = 0; i < n; i++) piece(bx, base - i * ep, r);
    g.textAlign = "left"; g.fillStyle = "#b9b2a3"; g.font = "500 10px 'IBM Plex Mono', monospace"; g.fillText("IL RESTE", bx + r + 16, base - n * ep - 18); g.fillStyle = "#f4efe3"; g.font = "800 17px 'Public Sans', sans-serif"; g.fillText(fr(tube, 2) + " €", bx + r + 16, base - n * ep + 2);
    piles.forEach((p, j) => { if (p < .5) return; const x = pileX(j, o); for (let i = 0; i < Math.round(p); i++) piece(x, base - i * ep, r * .82); g.textAlign = "center"; g.fillStyle = j === 2 ? "#e07a55" : "#f4efe3"; g.font = `800 ${mob ? 13 : 16}px 'Public Sans', sans-serif`; g.fillText("−" + fr(VAL[j], 2) + " €", x, base + 24); g.fillStyle = "#b9b2a3"; g.font = "500 9px 'IBM Plex Mono', monospace"; g.fillText((mob ? LIBC[j] : LIB[j]).toUpperCase(), x, base + 38); g.textAlign = "left"; });
    for (const p of pieces) { p.t += reduit() ? 1 : .035; if (p.t <= 0) continue; const e = 1 - Math.pow(1 - Math.min(1, p.t), 3); const x = p.x0 + (pileX(p.j, o) - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e - Math.sin(e * Math.PI) * 90; piece(x, y, r * .82); if (p.t >= 1) { piles[p.j] = Math.min(VAL[p.j], piles[p.j] + 1); p.fini = true; } }
    pieces = pieces.filter(p => !p.fini);
  }
  function boucle(t: number) {
    g.clearRect(0, 0, W, H); const s = (t - t0) / 1000;
    if (scene === "billets") for (const b of billets) { if (!reduit()) { b.y += .5 + b.z * 1.4; b.x += b.vx + Math.sin(s + b.ph) * .4; b.r += b.vr; if (b.y > H + 90) { b.y = -90; b.x = Math.random() * W; } } billet(b, s); }
    if (scene === "pieces") dessinerPieces();
    raf = (scene === "billets" || scene === "pieces") && !reduit() && !document.hidden ? requestAnimationFrame(boucle) : 0;
  }
  const relancer = () => { if (!raf) raf = requestAnimationFrame(boucle); };
  function verser(k: number) {
    const cibles = PAIE_PILES[k]; const o = geo();
    if (reduit()) { piles = cibles.slice(); pieces = []; tube = PAIE_TUBE[k]; return; }
    cibles.forEach((c, j) => { const deja = Math.round(piles[j]) + pieces.filter(p => p.j === j).length; const manque = Math.round(c) - deja; if (manque > 0) { for (let m = 0; m < manque; m++) pieces.push({ j, t: -m * .05, x0: o.bx, y0: o.base - (Math.round(tube) - m) * o.ep, y1: o.base - (Math.round(piles[j]) + m) * o.ep }); } else if (manque < 0) { piles[j] = c; pieces = pieces.filter(p => p.j !== j); } });
    tube = PAIE_TUBE[k]; relancer();
  }

  // Titre mot à mot et compteur
  function motAMot(h: HTMLElement) { if (h.dataset.mots) return; h.dataset.mots = "1"; let k = 0; const walk = (n: Node) => { [...n.childNodes].forEach(c => { if (c.nodeType === 3) { const frag = document.createDocumentFragment(); (c.textContent || "").split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) { frag.append(w); return; } const s = document.createElement("span"); s.className = "m"; s.style.setProperty("--k", String(k++)); s.textContent = w; frag.append(s); }); c.replaceWith(frag); } else walk(c); }); }; walk(h); }
  function odometre(el: HTMLElement) {
    const v = Number(el.dataset.valeur), d = Number(el.dataset.decimales || 0), u = el.dataset.unite || ""; const txt = fr(v, d);
    if (el.dataset.txt === txt) return; el.dataset.txt = txt;
    el.innerHTML = ""; [...txt].forEach((ch, i) => { if (/\d/.test(ch)) { const o = document.createElement("span"); o.className = "odo"; const col = document.createElement("span"); col.style.setProperty("--k", String(i)); col.innerHTML = Array.from({ length: 10 }, (_, x) => `<b>${x}</b>`).join(""); o.append(col); el.append(o); requestAnimationFrame(() => requestAnimationFrame(() => { col.style.transform = `translateY(-${+ch}em)`; })); } else { const c = document.createElement("span"); c.className = "car"; c.textContent = ch; el.append(c); } });
    const un = document.createElement("span"); un.className = "histoire__u"; un.textContent = u; el.append(un); el.setAttribute("aria-label", `${txt} ${u}`);
  }
  let direct: ReturnType<typeof setInterval> | undefined;

  // Navigation
  const segs = [...racine.querySelectorAll<HTMLElement>(".histoire__seg")];
  const CH = [...racine.querySelectorAll<HTMLElement>(".histoire__index [data-aller-chapitre] b")].map(b => b.textContent || "");
  let cur = -1;
  function aller(i: number) {
    i = Math.max(0, Math.min(etapes.length - 1, i)); if (i === cur) return; const avant = etapes[cur]?.dataset; cur = i; const el = etapes[i], s = el.dataset, ch = Number(s.chapitre);
    etapes.forEach((x, j) => { x.classList.toggle("est-courante", j === i); x.setAttribute("aria-hidden", String(j !== i)); });
    segs.forEach((seg, j) => { const du = etapes.filter(x => Number(x.dataset.chapitre) === j); const fait = du.filter(x => Number(x.dataset.i) <= i).length; (seg.firstElementChild as HTMLElement).style.width = (j < ch ? 100 : j > ch ? 0 : fait / du.length * 100) + "%"; seg.classList.toggle("actif", j === ch); });
    const suiv = etapes[i + 1]; $(".histoire__ici").textContent = `${String(ch + 1).padStart(2, "0")} · ${CH[ch] || ""}`; $(".histoire__ensuite").textContent = suiv && Number(suiv.dataset.chapitre) !== ch ? `Ensuite : ${CH[Number(suiv.dataset.chapitre)]}` : "";
    $(".histoire__num").textContent = `${String(i + 1).padStart(2, "0")} / ${etapes.length}`;
    $<HTMLButtonElement>(".histoire__prec").disabled = i === 0; $(".histoire__suiv-t").textContent = i === 0 ? "Commencer" : i === etapes.length - 1 ? "Recommencer" : "Suivant"; $(".histoire__suiv-s").textContent = i > 0 && suiv && Number(suiv.dataset.chapitre) !== ch ? CH[Number(suiv.dataset.chapitre)] : "";
    $(".histoire__astuce").hidden = i > 1;
    const titre = el.querySelector<HTMLElement>(".histoire__titre"); if (titre) { motAMot(titre); titre.classList.remove("vu"); requestAnimationFrame(() => requestAnimationFrame(() => titre.classList.add("vu"))); }
    clearInterval(direct); const gros = el.querySelector<HTMLElement>(".histoire__gros");
    if (gros?.hasAttribute("data-direct")) { const parSec = Number(gros.dataset.valeur), debut = performance.now(); const tick = () => { gros.innerHTML = fr((performance.now() - debut) / 1000 * parSec) + `<span class="histoire__u">€</span>`; }; tick(); direct = setInterval(tick, 60); } else if (gros) odometre(gros);
    $(".histoire__note-bas").textContent = el.querySelector(".histoire__note")?.textContent || "";
    racine.dataset.tableau = s.tableau!; racine.dataset.k = s.k ?? "";
    racine.querySelectorAll<HTMLElement>("[data-viz]").forEach(v => v.classList.toggle("on", v.dataset.viz === s.tableau || (v.dataset.viz === "ecart" && s.tableau === "ecart")));
    racine.classList.toggle("ecart-ouvert", s.tableau === "ecart" && s.k === "1");
    racine.querySelector(".histoire__cent")?.classList.toggle("on", s.tableau === "bercy"); majArbre();
    if (s.tableau === "billets" && avant?.tableau !== "billets") semer();
    if (s.tableau === "pieces") { if (avant?.tableau !== "pieces") { piles = [0, 0, 0]; pieces = []; tube = 100; } verser(Number(s.k)); }
    scene = s.tableau!; g.clearRect(0, 0, W, H); relancer(); if (reduit()) boucle(performance.now());
  }
  const suivant = () => { cur === etapes.length - 1 ? aller(0) : aller(cur + 1); };
  const precedent = () => aller(cur - 1);
  ecoute($(".histoire__suiv"), "click", (e: Event) => { e.stopPropagation(); suivant(); });
  ecoute($(".histoire__prec"), "click", (e: Event) => { e.stopPropagation(); precedent(); });
  segs.forEach(seg => ecoute(seg, "click", (e: Event) => { e.stopPropagation(); aller(etapes.findIndex(x => x.dataset.chapitre === seg.dataset.chapitre)); }));
  const index = $(".histoire__index");
  const fermerIndex = () => { index.hidden = true; $<HTMLButtonElement>("[data-histoire-index]").focus(); };
  ecoute($("[data-histoire-index]"), "click", (e: Event) => { e.stopPropagation(); index.hidden = false; index.querySelector<HTMLButtonElement>("button[data-aller-chapitre]")?.focus(); });
  ecoute($(".histoire__fermer"), "click", (e: Event) => { e.stopPropagation(); fermerIndex(); });
  index.querySelectorAll<HTMLButtonElement>("[data-aller-chapitre]").forEach(b => ecoute(b, "click", (e: Event) => { e.stopPropagation(); index.hidden = true; aller(etapes.findIndex(x => x.dataset.chapitre === b.dataset.allerChapitre)); }));
  // Toucher : moitié droite = suivant, moitié gauche = précédent, hors éléments interactifs
  ecoute(racine, "click", (e: MouseEvent) => { const t = e.target as HTMLElement; if (t.closest("a,button,input,form,label,dialog,.histoire__index")) return; const b = racine.getBoundingClientRect(); if (e.clientX - b.left > b.width * .4) suivant(); else precedent(); });
  let tx = 0, ty = 0;
  ecoute(racine, "touchstart", (e: TouchEvent) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  ecoute(racine, "touchend", (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return; if (dx < 0) suivant(); else precedent(); });
  // Molette : un geste = une étape, tant que la scène remplit l'écran ; aux bouts, la page défile.
  let accu = 0, verrou = 0;
  ecoute(window, "wheel", (e: WheelEvent) => {
    const b = racine.getBoundingClientRect(); if (!index.hidden) return;
    const pleine = b.top <= 2 && b.bottom >= innerHeight - 2;
    const vers = e.deltaY > 0 ? 1 : -1;
    if (!pleine || (vers > 0 && cur === etapes.length - 1) || (vers < 0 && cur === 0)) return;
    e.preventDefault(); const now = performance.now(); if (now < verrou) { accu = 0; return; }
    accu += e.deltaY; if (Math.abs(accu) > 30) { accu > 0 ? suivant() : precedent(); accu = 0; verrou = now + 750; }
  }, { passive: false });
  ecoute(window, "keydown", (e: KeyboardEvent) => {
    if (!index.hidden) { if (e.key === "Escape") fermerIndex(); return; }
    const t = e.target as HTMLElement; if (t.closest("input,textarea,select,dialog") || document.querySelector("dialog[open]")) return;
    const b = racine.getBoundingClientRect(); if (b.bottom < innerHeight * .5 || b.top > innerHeight * .5) return;
    if (["ArrowRight", "PageDown"].includes(e.key) || (e.key === " " && cur < etapes.length - 1)) { e.preventDefault(); suivant(); }
    if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); precedent(); }
  });
  ecoute(window, "resize", () => { taille(); if (scene === "pieces") relancer(); });
  const ro = new ResizeObserver(() => arbre()); if (vArbre) ro.observe(vArbre); nettoyages.push(() => ro.disconnect());
  ecoute(document as any, "visibilitychange", () => { if (!document.hidden) relancer(); });
  // Le formulaire de commune ouvre Ville ; les puces ouvrent directement une commune.
  taille(); aller(0); (document as any).fonts?.ready?.then(() => taille());
  detacher = () => { nettoyages.forEach(f => f()); cancelAnimationFrame(raf); clearInterval(direct); racine.classList.remove("histoire--active"); };
}
