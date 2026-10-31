/**
 * Contrôleur du récit défilant (rendu : rendu.ts). Le défilement reste celui du navigateur :
 * l'étape qui croise le milieu de l'écran devient courante et pilote la scène collée derrière.
 * Mouvement réduit : mêmes états, sans animation.
 */
import { indexRecherche, initialiser, territoires } from "../donnees.ts";
import { ville as calculVille } from "./calculs.ts";
import { renduVille } from "./ville.ts";

const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const normaliser = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function brancherRecit(): void {
  const trouve = document.querySelector<HTMLElement>("[data-recit]");
  if (!trouve) return;
  const racine: HTMLElement = trouve;
  const sceneEl = racine.querySelector<HTMLElement>(".recit__scene")!;
  const $ = <T extends Element = HTMLElement>(s: string) => racine.querySelector<T>(s);
  racine.classList.add("recit--actif");
  let etapes = [...racine.querySelectorAll<HTMLElement>(".etape")];
  let courante: HTMLElement | undefined;

  /* ---------- Carte : lumières ---------- */
  /* ---------- Arbre des dépenses ---------- */
  const vArbre = $<HTMLElement>("[data-viz=arbre]");
  const postes: [string, number][] = vArbre ? JSON.parse(vArbre.dataset.postes || "[]") : [];
  function arbre() {
    if (!vArbre) return; vArbre.innerHTML = ""; const W = vArbre.clientWidth, H = vArbre.clientHeight; if (!W || !H) return;
    const tot = postes.reduce((s, p) => s + p[1], 0); const rangs = W < 520 ? [[0], [1], [2, 3], [4, 5, 6, 7, 8, 9]] : [[0], [1], [2, 3], [4, 5, 6], [7, 8, 9]]; let x = 0;
    rangs.forEach(r => { const ok = r.filter(i => postes[i]); const som = ok.reduce((s, i) => s + postes[i][1], 0); if (!som) return; const w = W * som / tot; let y = 0; ok.forEach(i => { const h = H * postes[i][1] / som; const d = document.createElement("div"); d.className = "tuile"; d.dataset.i = String(i); Object.assign(d.style, { left: x + 3 + "px", top: y + 3 + "px", width: Math.max(0, w - 6) + "px", height: Math.max(0, h - 6) + "px", transitionDelay: i * .05 + "s" }); const mini = h < 60 || w < 80; if (mini) d.classList.add("mini"); d.innerHTML = `<span>${postes[i][0]}</span><b>${fr(postes[i][1], mini ? 0 : 2)} €</b>`; vArbre.append(d); y += h; }); x += w; });
    majArbre();
  }
  function majArbre() {
    const s = courante?.dataset; const on = s?.tableau === "arbre", k = Number(s?.k), tous = k === 9;
    vArbre?.querySelectorAll<HTMLElement>(".tuile").forEach(t => { const i = +t.dataset.i!; t.classList.toggle("vue", on && (tous || i <= k)); t.classList.toggle("cle", on && !tous && i === k); t.classList.toggle("attenue", on && !tous && i < k); });
  }

  /* ---------- Dette, Europe, ville ---------- */
  function dette(el: HTMLElement) {
    const v = $<HTMLElement>("[data-viz=dette]"); if (!v) return;
    const d = Number(el.dataset.dette || v.dataset.dette), r = Number(el.dataset.recettes || v.dataset.recettes); if (!d || !r) return;
    v.dataset.dette = String(d); v.dataset.recettes = String(r);
    const m = Math.max(d, r);
    v.querySelector<HTMLElement>(".barre.dette")!.style.setProperty("--h", (d / m * 100).toFixed(2) + "%");
    v.querySelector<HTMLElement>(".barre.rec")!.style.setProperty("--h", (r / m * 100).toFixed(2) + "%");
    v.querySelector<HTMLElement>("[data-v=dette]")!.textContent = `${fr(d)} Md€`;
    v.querySelector<HTMLElement>("[data-v=recettes]")!.textContent = `${fr(r, 1)} Md€`;
  }
  function europe(el: HTMLElement) {
    const v = $<HTMLElement>("[data-viz=europe]"); if (!v || !el.dataset.europe) return;
    const valeurs: [string, number][] = JSON.parse(el.dataset.europe); const m = Math.max(...valeurs.map(x => x[1]));
    v.innerHTML = valeurs.slice().sort((a, b) => b[1] - a[1]).map(([nom, val], i) => `<div class="pays${nom === "France" ? " fr" : ""}" style="--w:${(val / m * 100).toFixed(1)}%;--k:${i}"><span>${nom}</span><i></i><b>${fr(val, 1)} %</b></div>`).join("");
  }
  function villeViz(el: HTMLElement) {
    const v = $<HTMLElement>("[data-viz=ville]"); if (!v) return;
    const x = el.dataset.ville ? JSON.parse(el.dataset.ville) : null;
    if (!x) { v.innerHTML = ""; return; }
    const M = (n: number) => `${fr(n / 1e6, 1)} M€`;
    if (x.mode === "ecart") {
      const m = Math.max(x.rec, x.dep);
      v.innerHTML = `<div class="viz--ecart${x.ouvert ? " ouvert" : ""}"><div class="col"><div class="barre rec" style="--h:${(x.rec / m * 100).toFixed(2)}%"></div><p>Recettes<b>${M(x.rec)}</b></p></div><div class="col"><div class="barre dep" style="--h:${(x.dep / m * 100).toFixed(2)}%"></div><p>Dépenses<b>${M(x.dep)}</b></p></div></div>`;
    } else if (x.mode === "parts") {
      v.innerHTML = `<div class="parts">${x.morceaux.map(([n, p, c]: [string, number, string], i: number) => `<div class="part ${c}" style="--p:${p};--k:${i}"><b>${fr(p, 2)} €</b><span>${n}</span></div>`).join("")}</div>`;
    } else if (x.mode === "dette") {
      const lignes = [["Dette", x.stock, "dette"], ["Nouveaux emprunts", x.emprunts, "rec"], ["Capital remboursé", x.remboursements, "dep"]].filter(l => Number.isFinite(l[1]));
      const m = Math.max(...lignes.map(l => l[1] as number));
      v.innerHTML = `<div class="hbarres">${lignes.map(([n, val, c], i) => `<div class="pays ${c}" style="--w:${((val as number) / m * 100).toFixed(1)}%;--k:${i}"><span>${n}</span><i></i><b>${M(val as number)}</b></div>`).join("")}</div>`;
    } else if (x.mode === "invest") {
      const m = Math.max(x.montant, x.recettes);
      v.innerHTML = `<div class="viz--ecart"><div class="col"><div class="barre inv" style="--h:${(x.montant / m * 100).toFixed(2)}%"></div><p>Investissement<b>${M(x.montant)}</b></p></div><div class="col"><div class="barre rec" style="--h:${(x.recettes / m * 100).toFixed(2)}%"></div><p>Recettes de fonctionnement<b>${M(x.recettes)}</b></p></div></div>`;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => v.firstElementChild?.classList.add("on")));
  }

  /* ---------- Canvas : billets et pièces ---------- */
  const cv = $<HTMLCanvasElement>("canvas.fx")!, g = cv.getContext("2d")!; const zone = $<HTMLElement>(".zone")!;
  let W = 0, H = 0; const dpr = Math.min(2, devicePixelRatio || 1);
  type Billet = { x: number; y: number; z: number; r: number; vr: number; vx: number; ph: number; c: string[] };
  let billets: Billet[] = [], pieces: { j: number; t: number; x0: number; y0: number; y1: number; fini?: boolean }[] = [];
  let piles = [0, 0, 0], cibles = [0, 0, 0], tube = 100, tableau = "", raf = 0; const t0 = performance.now();
  function taille() { const b = sceneEl.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); arbre(); }
  function semer() { billets = Array.from({ length: reduit() ? 16 : 46 }, () => ({ x: Math.random() * W, y: reduit() ? Math.random() * H : -Math.random() * H * 1.2 - 40, z: .35 + Math.random() * .85, r: Math.random() * 6.28, vr: (Math.random() - .5) * .025, vx: (Math.random() - .5) * .5, ph: Math.random() * 6.28, c: Math.random() < .5 ? ["#7cae8c", "#d9e6cc", "#4f7f60"] : ["#8ba6cc", "#e1e8f3", "#5a7299"] })); }
  function billet(b: Billet, t: number) { g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.scale(b.z, b.z * (.35 + .65 * Math.abs(Math.cos(t * 1.3 + b.ph)))); g.globalAlpha = Math.min(1, .3 + b.z * .6); const w = 128, h = 66; g.fillStyle = b.c[2]; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = b.c[0]; g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); g.fillStyle = b.c[1]; g.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20); g.fillStyle = b.c[0]; g.beginPath(); g.arc(w / 2 - 30, 0, 16, 0, 7); g.fill(); g.fillStyle = "#1b2638"; g.font = "900 20px 'Public Sans', sans-serif"; g.fillText("100", -w / 2 + 16, h / 2 - 16); g.restore(); }
  function geo() { const zr = zone.getBoundingClientRect(), rr = sceneEl.getBoundingClientRect(); const mob = zr.width < 520; const r = Math.max(14, Math.min(mob ? 20 : 34, zr.height / 14)); const ep = Math.max(1.2, Math.min(3.4, (zr.height - 80) / 104)); return { r, ep, bx: zr.left - rr.left + r + 12, base: zr.bottom - rr.top - 44, gap: (zr.width - 2 * r - (mob ? 60 : 110)) / 3, mob }; }
  const pileX = (j: number, o: ReturnType<typeof geo>) => o.bx + o.r + (o.mob ? 36 : 90) + o.gap * (j + .5);
  function piece(x: number, y: number, r: number) { g.fillStyle = "#6d4f17"; g.beginPath(); g.ellipse(x, y + r * .12, r, r * .3, 0, 0, 7); g.fill(); const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, "#9c7425"); gr.addColorStop(.45, "#f6dc93"); gr.addColorStop(1, "#9c7425"); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * .3, 0, 0, 7); g.fill(); g.strokeStyle = "#5a4012"; g.lineWidth = .6; g.stroke(); }
  const LIB = ["Patronales", "Salariales", "Impôt"];
  function dessinerPieces() {
    const o = geo(), { r, ep, bx, base, mob } = o; const th = 100 * ep + 24;
    g.fillStyle = "#f4efe30d"; g.strokeStyle = "#f4efe33a"; g.beginPath(); g.rect(bx - r - 8, base - th, 2 * r + 16, th + 12); g.fill(); g.stroke();
    const n = Math.round(tube); for (let i = 0; i < n; i++) piece(bx, base - i * ep, r);
    g.textAlign = "left"; g.fillStyle = "#f4efe3"; g.font = "800 16px 'Public Sans', sans-serif"; g.fillText(fr(tube, 2) + " €", bx + r + 14, base - n * ep + 4);
    piles.forEach((p, j) => { if (p < .5) return; const x = pileX(j, o); for (let i = 0; i < Math.round(p); i++) piece(x, base - i * ep, r * .82); g.textAlign = "center"; g.fillStyle = j === 2 ? "#e07a55" : "#f4efe3"; g.font = `800 ${mob ? 12 : 15}px 'Public Sans', sans-serif`; g.fillText("−" + fr(cibles[j], 2) + " €", x, base + 24); g.fillStyle = "#b9b2a3"; g.font = "500 9px 'IBM Plex Mono', monospace"; g.fillText(LIB[j].toUpperCase(), x, base + 38); g.textAlign = "left"; });
    for (const p of pieces) { p.t += reduit() ? 1 : .04; if (p.t <= 0) continue; const e = 1 - Math.pow(1 - Math.min(1, p.t), 3); const x = p.x0 + (pileX(p.j, o) - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e - Math.sin(e * Math.PI) * 80; piece(x, y, r * .82); if (p.t >= 1) { piles[p.j] = Math.min(cibles[p.j], piles[p.j] + 1); p.fini = true; } }
    pieces = pieces.filter(p => !p.fini);
  }
  function boucle(t: number) {
    g.clearRect(0, 0, W, H); const s = (t - t0) / 1000;
    if (tableau === "billets") for (const b of billets) { if (!reduit()) { b.y += .5 + b.z * 1.3; b.x += b.vx + Math.sin(s + b.ph) * .4; b.r += b.vr; if (b.y > H + 90) { b.y = -90; b.x = Math.random() * W; } } billet(b, s); }
    if (tableau === "pieces") dessinerPieces();
    raf = (tableau === "billets" || tableau === "pieces") && !reduit() && !document.hidden && visible ? requestAnimationFrame(boucle) : 0;
  }
  const relancer = () => { if (!raf) raf = requestAnimationFrame(boucle); };
  function verser(nouvelles: number[]) {
    const o = geo(); cibles = nouvelles.slice(); const total = nouvelles.reduce((a, b) => a + b, 0);
    if (reduit()) { piles = nouvelles.slice(); pieces = []; tube = 100 - total; return; }
    nouvelles.forEach((c, j) => { const deja = Math.round(piles[j]) + pieces.filter(p => p.j === j).length; const manque = Math.round(c) - deja; if (manque > 0) { for (let k = 0; k < manque; k++) pieces.push({ j, t: -k * .05, x0: o.bx, y0: o.base - (Math.round(tube) - k) * o.ep, y1: o.base - (Math.round(piles[j]) + k) * o.ep }); } else if (manque < 0) { piles[j] = c; pieces = pieces.filter(p => p.j !== j); } });
    tube = 100 - total; relancer();
  }

  /* ---------- Chiffres ---------- */
  function odometre(el: HTMLElement) {
    if (el.hasAttribute("data-direct")) return;
    const v = Number(el.dataset.valeur), d = Number(el.dataset.decimales || 0), u = el.dataset.unite || ""; const txt = fr(v, d);
    if (el.dataset.txt === txt) return; el.dataset.txt = txt; el.setAttribute("aria-label", `${txt} ${u}`);
    el.innerHTML = ""; [...txt].forEach((ch, i) => { if (/\d/.test(ch)) { const o = document.createElement("span"); o.className = "odo"; o.setAttribute("aria-hidden", "true"); const col = document.createElement("span"); col.style.setProperty("--k", String(i)); col.innerHTML = Array.from({ length: 10 }, (_, x) => `<b>${x}</b>`).join(""); o.append(col); el.append(o); requestAnimationFrame(() => requestAnimationFrame(() => { col.style.transform = `translateY(-${+ch}em)`; })); } else { const c = document.createElement("span"); c.className = "car"; c.setAttribute("aria-hidden", "true"); c.textContent = ch; el.append(c); } });
    const un = document.createElement("span"); un.className = "etape__u"; un.setAttribute("aria-hidden", "true"); un.textContent = u; el.append(un);
  }
  let direct: ReturnType<typeof setInterval> | undefined, arrivee = performance.now();

  /* ---------- Étape courante ---------- */
  const rail = [...racine.querySelectorAll<HTMLElement>("[data-rail]")];
  function activer(el: HTMLElement) {
    if (el === courante) return; const avant = courante?.dataset; courante = el; const s = el.dataset;
    etapes.forEach(x => x.classList.toggle("est-courante", x === el));
    tableau = s.tableau || ""; racine.dataset.tableau = tableau; racine.dataset.k = s.k ?? "";
    racine.querySelectorAll<HTMLElement>("[data-viz]").forEach(v => v.classList.toggle("on", v.dataset.viz === tableau));
    racine.classList.toggle("ecart-ouvert", tableau === "ecart" && s.k === "1");
    $(".cent")?.classList.toggle("on", tableau === "bercy");
    majArbre();
    if (tableau === "dette") dette(el);
    if (tableau === "europe") europe(el);
    if (tableau === "ville") villeViz(el);
    if (tableau === "billets" && avant?.tableau !== "billets") semer();
    if (tableau === "pieces") verser(JSON.parse(s.piles || "[0,0,0]"));
    g.clearRect(0, 0, W, H); relancer(); if (reduit()) boucle(performance.now());
    const gros = el.querySelector<HTMLElement>(".etape__gros"); clearInterval(direct);
    if (gros?.hasAttribute("data-direct")) { const parSec = Number(gros.dataset.valeur); const tick = () => { gros.innerHTML = fr((performance.now() - arrivee) / 1000 * parSec) + `<span class="etape__u">€</span>`; }; tick(); direct = setInterval(tick, 80); }
    else if (gros && !reduit()) odometre(gros);
    const ch = s.chapitre; let passe = true;
    rail.forEach(a => { const ici = a.dataset.rail === ch; if (ici) passe = false; a.classList.toggle("actif", ici); a.classList.toggle("passe", passe && !ici); });
  }
  let visible = true;
  const obsScene = new IntersectionObserver(([x]) => { visible = x.isIntersecting; if (visible) relancer(); });
  obsScene.observe(sceneEl);
  // L'étape qui croise le milieu de l'écran devient courante. Calculé à chaque défilement
  // (une fois par image) plutôt qu'observé : une restauration de position ou une insertion
  // d'étapes ne peut pas laisser la scène sur une étape périmée.
  function mesurer() {
    const milieu = innerHeight / 2;
    const ici = etapes.find(x => { const r = x.getBoundingClientRect(); return r.top <= milieu && r.bottom > milieu; });
    if (ici) activer(ici);
  }
  // Lecture directe à chaque défilement : quelques rectangles, et aucune image d'animation
  // à attendre (une image suspendue laissait la scène sur l'étape précédente).
  addEventListener("scroll", mesurer, { passive: true });
  addEventListener("resize", () => { taille(); relancer(); mesurer(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) relancer(); });
  new ResizeObserver(() => arbre()).observe(vArbre ?? zone);
  taille(); activer(etapes[0]); mesurer();
  (document as any).fonts?.ready?.then(() => taille());

  /* ---------- Votre ville ---------- */
  const form = $<HTMLFormElement>(".ville-recherche"), champ = $<HTMLInputElement>("#ville-champ"), liste = $<HTMLUListElement>("#ville-suggestions"), etat = $<HTMLElement>(".ville-etat");
  const cadre = $<HTMLElement>("[data-ville-etapes]");
  type Entree = { c: string; n: string; l: string; p: string | null };
  let pret: Promise<void> | undefined, index: Entree[] = [], choix: Entree[] = [], actif = -1;
  const charger = () => (pret ??= initialiser().then(() => undefined));
  async function communes(): Promise<Entree[]> { await charger(); if (!index.length) index = (await indexRecherche()).filter(e => e.l === "commune"); return index; }
  function proposer(liste2: Entree[]) {
    if (!liste || !champ) return; choix = liste2; actif = -1;
    liste.innerHTML = liste2.map((e, i) => `<li role="option" id="ville-opt-${i}" data-i="${i}" aria-selected="false">${e.n}<small>${e.p ?? ""}</small></li>`).join("");
    liste.hidden = !liste2.length; champ.setAttribute("aria-expanded", String(!!liste2.length));
  }
  async function chercher(q: string): Promise<Entree[]> {
    const n = normaliser(q); if (n.length < 2) return [];
    const toutes = await communes();
    return toutes.filter(e => normaliser(e.n).startsWith(n) || e.c === q.trim()).sort((a, b) => a.n.length - b.n.length || a.n.localeCompare(b.n, "fr")).slice(0, 8);
  }
  async function ouvrir(e: Entree, defiler = true) {
    if (!cadre || !etat) return; proposer([]); if (champ) champ.value = e.n;
    etat.textContent = `Chargement de ${e.n}…`;
    try {
      await charger();
      const lot = await territoires("commune", e.p ?? e.c.slice(0, 2));
      const t = lot[e.c]; const v = t && calculVille(t, e.c);
      if (!v) { etat.textContent = `Les comptes de ${e.n} ne sont pas publiés.`; return; }
      cadre.innerHTML = renduVille(v, etapes.length);
      const nouvelles = [...cadre.querySelectorAll<HTMLElement>(".etape")];
      etapes = [...racine.querySelectorAll<HTMLElement>(".etape")];
      mesurer();
      etat.textContent = `${v.nom} : ${nouvelles.length} étapes ci-dessous.`;
      const url = new URL(location.href); url.searchParams.set("ville", e.c); history.replaceState(history.state, "", url);
      if (defiler && nouvelles[0]) nouvelles[0].scrollIntoView({ behavior: reduit() ? "auto" : "smooth", block: "center" });
    } catch { etat.textContent = "Les comptes des communes sont momentanément indisponibles."; }
  }
  if (form && champ && liste) {
    champ.addEventListener("input", async () => { const q = champ.value; const r = await chercher(q); if (champ.value === q) proposer(r); });
    champ.addEventListener("keydown", e => {
      if (!choix.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); actif = (actif + (e.key === "ArrowDown" ? 1 : -1) + choix.length) % choix.length; liste.querySelectorAll("li").forEach((li, i) => li.setAttribute("aria-selected", String(i === actif))); champ.setAttribute("aria-activedescendant", `ville-opt-${actif}`); }
      if (e.key === "Escape") proposer([]);
    });
    liste.addEventListener("mousedown", e => e.preventDefault());
    liste.addEventListener("click", e => { const li = (e.target as HTMLElement).closest("li"); if (li) ouvrir(choix[Number(li.dataset.i)]); });
    form.addEventListener("submit", async e => { e.preventDefault(); const r = choix.length ? choix : await chercher(champ.value); const cible = r[Math.max(0, actif)]; if (cible) ouvrir(cible); else if (etat) etat.textContent = "Aucune commune trouvée."; });
    racine.addEventListener("click", e => { if ((e.target as HTMLElement).closest("[data-autre-ville]")) { e.preventDefault(); champ.value = ""; champ.closest(".etape")?.scrollIntoView({ behavior: reduit() ? "auto" : "smooth", block: "center" }); champ.focus({ preventScroll: true }); } });
    const code = new URL(location.href).searchParams.get("ville");
    if (code && /^[0-9AB]{5}$/.test(code)) communes().then(l => { const e = l.find(x => x.c === code); if (e) ouvrir(e, false); }).catch(() => undefined);
  }
}
