/**
 * Contrôleur des récits défilants (rendu : rendu.ts ; pages : / et /salaires/). Le défilement
 * reste celui du navigateur : l'étape qui croise le milieu de l'écran devient courante et
 * pilote la scène collée derrière. Mouvement réduit : mêmes états, sans animation.
 */
import { indexRecherche, initialiser, territoires } from "../donnees.ts";
import { ville as calculVille, type RepereFrance } from "./calculs.ts";
import { renduVille, type LigneBarre, type VueVille } from "./ville.ts";

const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f/g, "\u00a0");
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const normaliser = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Barres horizontales lisibles à toutes les tailles : nom et montant au-dessus, barre dessous. */
export function barresHtml(lignes: LigneBarre[], legende?: string, repere?: string, cle?: number, partie = false): string {
  const m = Math.max(...lignes.map(l => Math.max(l.v, l.r ?? 0)), 1e-9);
  const tete = legende || repere ? `<p class="barres__leg">${legende ? esc(legende) : ""}${repere ? `<span><i${partie ? ' class="hach"' : ""}></i>${esc(repere)}</span>` : ""}</p>` : "";
  return `<div class="barres${lignes.length > 7 ? " barres--denses" : ""}">${tete}${lignes.map((l, i) => `<div class="barre-l ${l.c ?? "bleu"}${cle === undefined ? "" : i === cle ? " cle" : " attenue"}" style="--w:${(l.v / m * 100).toFixed(2)}%;--k:${i}">
    <span class="n">${esc(l.n)}${l.s ? `<small>${esc(l.s)}</small>` : ""}</span><b>${esc(l.t)}</b>
    <span class="piste"><i></i>${l.p ? `<i class="part" style="--p:${(l.p / m * 100).toFixed(2)}%"></i>` : ""}${l.r ? `<em style="left:${(l.r / m * 100).toFixed(2)}%" title="${esc(repere ?? "")} : ${esc(l.rt ?? "")}"></em>` : ""}</span>
  </div>`).join("")}</div>`;
}

/** Réduit la police d'un grand chiffre jusqu'à ce qu'il tienne dans sa carte. */
function ajuster(el: HTMLElement) {
  el.style.fontSize = "";
  let taille = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 24 && el.scrollWidth > el.clientWidth + 1 && taille > 18; i++) { taille *= .92; el.style.fontSize = `${taille}px`; }
}

const COURT: Record<string, string> = { "Rémunérations": "Agents publics", "Soins remboursés": "Soins", Investissement: "Invest.", "Intérêts de la dette": "Intérêts", "Famille et enfants": "Famille", "RSA et minima sociaux": "RSA", "Autres dépenses": "Autres" };

export function brancherRecit(): void {
  const trouve = document.querySelector<HTMLElement>("[data-recit]");
  if (!trouve) return;
  const racine: HTMLElement = trouve;
  const sceneEl = racine.querySelector<HTMLElement>(".recit__scene")!;
  const $ = <T extends Element = HTMLElement>(s: string) => racine.querySelector<T>(s);
  racine.classList.add("recit--actif");
  let etapes = [...racine.querySelectorAll<HTMLElement>(".etape")];
  let courante: HTMLElement | undefined;

  /* ---------- Arbre des dépenses ---------- */
  const vArbre = $<HTMLElement>("[data-viz=arbre]");
  const postes: [string, number][] = vArbre ? JSON.parse(vArbre.dataset.postes || "[]") : [];
  function arbre() {
    if (!vArbre) return; vArbre.innerHTML = ""; const W = vArbre.clientWidth, H = vArbre.clientHeight; if (!W || !H) return;
    const tot = postes.reduce((s, p) => s + p[1], 0); const rangs = W < 520 ? [[0], [1], [2, 3], [4, 5, 6, 7, 8, 9]] : [[0], [1], [2, 3], [4, 5, 6], [7, 8, 9]]; let x = 0;
    rangs.forEach(r => {
      const ok = r.filter(i => postes[i]); const som = ok.reduce((s, i) => s + postes[i][1], 0); if (!som) return; const w = W * som / tot; let y = 0;
      ok.forEach(i => {
        const h = H * postes[i][1] / som; const d = document.createElement("div"); d.className = "tuile"; d.dataset.i = String(i);
        Object.assign(d.style, { left: x + 3 + "px", top: y + 3 + "px", width: Math.max(0, w - 6) + "px", height: Math.max(0, h - 6) + "px", transitionDelay: i * .05 + "s" });
        const petit = h < 64 || w < 90; if (petit) d.classList.add("mini");
        d.title = `${postes[i][0]} : ${fr(postes[i][1], 2)} €`;
        d.innerHTML = `<span>${postes[i][0]}</span><b>${fr(postes[i][1], petit ? 0 : 2)}&nbsp;€</b>`;
        vArbre.append(d);
        // Un nom trop long prend sa forme courte ; un montant trop large rétrécit.
        const nomEl = d.querySelector("span")!, val = d.querySelector("b")!;
        if (nomEl.scrollWidth > nomEl.clientWidth + 1 && COURT[postes[i][0]]) nomEl.textContent = COURT[postes[i][0]];
        if (nomEl.scrollWidth > nomEl.clientWidth + 1 || h < 34) nomEl.hidden = true;
        let fs = parseFloat(getComputedStyle(val).fontSize);
        while (val.scrollWidth > d.clientWidth - 8 && fs > 9) { fs -= 1; val.style.fontSize = fs + "px"; }
        y += h;
      });
      x += w;
    });
    majArbre();
  }
  function majArbre() {
    const s = courante?.dataset; const on = s?.tableau === "arbre", k = Number(s?.k), tous = k === 9;
    vArbre?.querySelectorAll<HTMLElement>(".tuile").forEach(t => { const i = +t.dataset.i!; t.classList.toggle("vue", on && (tous || i <= k)); t.classList.toggle("cle", on && !tous && i === k); t.classList.toggle("attenue", on && !tous && i < k); });
  }

  /* ---------- Dette, Europe, salaire, ville, barres ---------- */
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
  function paie(k: number) {
    $<HTMLElement>("[data-viz=paie]")?.querySelectorAll<HTMLElement>(".paie__ligne").forEach(l => {
      const i = Number(l.dataset.i); l.classList.toggle("vue", i <= Math.min(k, 3)); l.classList.toggle("cle", i === Math.min(k, 3)); l.classList.toggle("fin", k === 4 && i === 3);
    });
  }
  function allumer(v: HTMLElement) { requestAnimationFrame(() => requestAnimationFrame(() => v.firstElementChild?.classList.add("on"))); }
  function villeViz(el: HTMLElement) {
    const v = $<HTMLElement>("[data-viz=ville]"); if (!v) return;
    const x: VueVille | null = el.dataset.ville ? JSON.parse(el.dataset.ville) : null;
    if (!x) { v.innerHTML = ""; return; }
    const M = (n: number) => `${fr(n / 1e6, 1)} M€`;
    if (x.mode === "ecart") {
      const m = Math.max(x.rec, x.dep);
      v.innerHTML = `<div class="viz--ecart${x.ouvert ? " ouvert" : ""}"><div class="col"><div class="barre rec" style="--h:${(x.rec / m * 100).toFixed(2)}%"></div><p>Recettes<b>${M(x.rec)}</b></p></div><div class="col"><div class="barre dep" style="--h:${(x.dep / m * 100).toFixed(2)}%"></div><p>Dépenses<b>${M(x.dep)}</b></p></div></div>`;
    } else if (x.mode === "barres") v.innerHTML = barresHtml(x.lignes, x.legende, x.repere);
    else if (x.mode === "tuiles") v.innerHTML = `<div class="tuiles">${x.tuiles.map(([lib, val, rep], i) => `<div class="kpi" style="--k:${i}"><span>${esc(lib)}</span><b>${esc(val)}</b>${rep ? `<small>${esc(rep)}</small>` : ""}</div>`).join("")}</div>`;
    allumer(v);
  }
  function barres(el: HTMLElement) {
    const v = $<HTMLElement>("[data-viz=barres]"); if (!v || !el.dataset.barres) return;
    const x: { lignes: LigneBarre[]; legende?: string; repere?: string; partie?: boolean } = JSON.parse(el.dataset.barres);
    const cle = el.dataset.cle !== undefined && Number(el.dataset.cle) >= 0 ? Number(el.dataset.cle) : undefined;
    v.innerHTML = barresHtml(x.lignes, x.legende, x.repere, cle, x.partie); allumer(v);
  }

  /* ---------- Canvas : billets ---------- */
  const cv = $<HTMLCanvasElement>("canvas.fx"), g = cv?.getContext("2d");
  let W = 0, H = 0; const dpr = Math.min(2, devicePixelRatio || 1);
  type Billet = { x: number; y: number; z: number; r: number; vr: number; vx: number; ph: number; c: string[] };
  let billets: Billet[] = [], tableau = "", raf = 0; const t0 = performance.now();
  function taille() { const b = sceneEl.getBoundingClientRect(); W = b.width; H = b.height; if (cv && g) { cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); } arbre(); }
  function semer() { billets = Array.from({ length: reduit() ? 16 : 46 }, () => ({ x: Math.random() * W, y: reduit() ? Math.random() * H : -Math.random() * H * 1.2 - 40, z: .35 + Math.random() * .85, r: Math.random() * 6.28, vr: (Math.random() - .5) * .025, vx: (Math.random() - .5) * .5, ph: Math.random() * 6.28, c: Math.random() < .5 ? ["#7cae8c", "#d9e6cc", "#4f7f60"] : ["#8ba6cc", "#e1e8f3", "#5a7299"] })); }
  function billet(b: Billet, t: number) { if (!g) return; g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.scale(b.z, b.z * (.35 + .65 * Math.abs(Math.cos(t * 1.3 + b.ph)))); g.globalAlpha = Math.min(1, .3 + b.z * .6); const w = 128, h = 66; g.fillStyle = b.c[2]; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = b.c[0]; g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); g.fillStyle = b.c[1]; g.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20); g.fillStyle = b.c[0]; g.beginPath(); g.arc(w / 2 - 30, 0, 16, 0, 7); g.fill(); g.fillStyle = "#1b2638"; g.font = "900 20px 'Public Sans', sans-serif"; g.fillText("100", -w / 2 + 16, h / 2 - 16); g.restore(); }
  function boucle(t: number) {
    if (!g) return; g.clearRect(0, 0, W, H); const s = (t - t0) / 1000;
    if (tableau === "billets") for (const b of billets) { if (!reduit()) { b.y += .5 + b.z * 1.3; b.x += b.vx + Math.sin(s + b.ph) * .4; b.r += b.vr; if (b.y > H + 90) { b.y = -90; b.x = Math.random() * W; } } billet(b, s); }
    raf = tableau === "billets" && !reduit() && !document.hidden && visible ? requestAnimationFrame(boucle) : 0;
  }
  const relancer = () => { if (!raf && g) raf = requestAnimationFrame(boucle); };

  /* ---------- Chiffres ---------- */
  // Le texte réel reste lisible et copiable ; les rouleaux de chiffres sont décoratifs.
  function odometre(el: HTMLElement) {
    if (el.hasAttribute("data-direct")) return;
    const v = Number(el.dataset.valeur), d = Number(el.dataset.decimales || 0), u = el.dataset.unite || ""; const txt = fr(v, d);
    if (el.dataset.txt === txt) return; el.dataset.txt = txt;
    el.innerHTML = `<span class="sr-only">${esc(`${txt} ${u}`)}</span>`;
    const deco = document.createElement("span"); deco.className = "odo-txt"; deco.setAttribute("aria-hidden", "true");
    [...txt].forEach((ch, i) => {
      if (/\d/.test(ch)) { const o = document.createElement("span"); o.className = "odo"; const col = document.createElement("span"); col.style.setProperty("--k", String(i)); col.innerHTML = Array.from({ length: 10 }, (_, x) => `<b>${x}</b>`).join(""); o.append(col); deco.append(o); requestAnimationFrame(() => requestAnimationFrame(() => { col.style.transform = `translateY(-${+ch}em)`; })); }
      else { const c = document.createElement("span"); c.className = "car"; c.textContent = ch; deco.append(c); }
    });
    const un = document.createElement("span"); un.className = "etape__u"; un.textContent = u; deco.append(un);
    el.append(deco); ajuster(el);
  }
  let direct: ReturnType<typeof setInterval> | undefined; const arrivee = performance.now();

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
    if (tableau === "paie") paie(Number(s.k));
    if (tableau === "ville") villeViz(el);
    if (tableau === "barres") barres(el);
    if (tableau === "courbes") $<HTMLElement>("[data-viz=courbes]")?.querySelectorAll<SVGElement>("[data-i]").forEach(c => { c.classList.toggle("cle", c.dataset.i === s.k); c.classList.toggle("attenue", c.dataset.i !== s.k); });
    if (tableau === "billets" && avant?.tableau !== "billets") semer();
    g?.clearRect(0, 0, W, H); relancer(); if (reduit()) boucle(performance.now());
    const gros = el.querySelector<HTMLElement>(".etape__gros"); clearInterval(direct);
    if (gros?.hasAttribute("data-direct")) {
      const parSec = Number(gros.dataset.valeur);
      const tick = () => { gros.innerHTML = `${fr((performance.now() - arrivee) / 1000 * parSec)}<span class="etape__u">€</span>`; if (gros.scrollWidth > gros.clientWidth + 1) ajuster(gros); };
      tick(); direct = setInterval(tick, 80);
    } else if (gros && !reduit()) odometre(gros);
    else if (gros) ajuster(gros);
    const ch = s.chapitre; let passe = true;
    rail.forEach(a => { const ici = a.dataset.rail === ch; if (ici) passe = false; a.classList.toggle("actif", ici); a.classList.toggle("passe", passe && !ici); });
  }
  let visible = true;
  new IntersectionObserver(([x]) => { visible = x.isIntersecting; if (visible) relancer(); }).observe(sceneEl);
  // L'étape qui croise le milieu de l'écran devient courante. Calculé à chaque défilement
  // plutôt qu'observé : une restauration de position ou une insertion d'étapes ne peut pas
  // laisser la scène sur une étape périmée.
  function mesurer() {
    const milieu = innerHeight / 2;
    const ici = etapes.find(x => { const r = x.getBoundingClientRect(); return r.top <= milieu && r.bottom > milieu; });
    if (ici) activer(ici);
  }
  addEventListener("scroll", mesurer, { passive: true });
  addEventListener("resize", () => { taille(); relancer(); mesurer(); racine.querySelectorAll<HTMLElement>(".etape__gros").forEach(ajuster); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) relancer(); });
  new ResizeObserver(() => arbre()).observe(vArbre ?? sceneEl);
  taille(); activer(etapes[0]); mesurer();
  (document as any).fonts?.ready?.then(() => { taille(); racine.querySelectorAll<HTMLElement>(".etape__gros").forEach(ajuster); });

  /* ---------- Votre ville ---------- */
  const form = $<HTMLFormElement>(".ville-recherche"), champ = $<HTMLInputElement>("#ville-champ"), liste = $<HTMLUListElement>("#ville-suggestions"), etat = $<HTMLElement>(".ville-etat");
  const cadre = $<HTMLElement>("[data-ville-etapes]");
  const france: RepereFrance = (() => { try { return JSON.parse(form?.closest<HTMLElement>(".etape")?.dataset.france || "{}"); } catch { return {}; } })();
  type Entree = { c: string; n: string; l: string; p: string | null };
  let pret: Promise<void> | undefined, index: Entree[] = [], choix: Entree[] = [], actif = -1;
  const charger = () => (pret ??= initialiser().then(() => undefined));
  async function communes(): Promise<Entree[]> { await charger(); if (!index.length) index = (await indexRecherche()).filter(e => e.l === "commune"); return index; }
  function proposer(liste2: Entree[]) {
    if (!liste || !champ) return; choix = liste2; actif = -1;
    liste.innerHTML = liste2.map((e, i) => `<li role="option" id="ville-opt-${i}" data-i="${i}" aria-selected="false">${esc(e.n)}<small>${esc(e.p ?? "")}</small></li>`).join("");
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
      cadre.innerHTML = renduVille(v, etapes.length, france);
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
