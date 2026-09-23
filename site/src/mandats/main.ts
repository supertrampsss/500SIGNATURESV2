import { syncNationalScene } from "./national-scene.ts";
import { icon } from "./icons.ts";
import "./game.css";
import "../styles/shared-design.css";
import "../styles/site-shell-v2.css";
import "./approved-decision-room.css";
import "./mandats-2026-rework.css";
import { decide, domainFor, startingGame, start } from "./engine.ts";
import { pilotEnabled, readPilot, recordPilot, setPilotConsent } from "./telemetry.ts";
import { prepareOffline, removeOffline, updateOffline } from "./offline.ts";
import { cardModel, cardSVG, cardURL } from "./cards.ts";
import type { CardKind } from "./cards.ts";
import { clearEntryLink, entrySession, localSession } from "./session.ts";
import type { Ambition, Game } from "./types.ts";
import { gameShell, mandateSetup, selection, yearRecap } from "./render.ts";
import type { Screen, View } from "./render.ts";
import { decode, encode, save, STORAGE_KEY, MAX_SAVE_BYTES } from "./storage.ts";
import { CARD_SIZES, challengeURL, escape } from "./sharing.ts";

const root = document.querySelector<HTMLElement>("#mandats")!;
const dialog = document.querySelector<HTMLDialogElement>("#details")!;
const notice = document.querySelector<HTMLElement>("#notice")!;
let inherited = false;
let planIds: string[] | null = null;
let cardKind: CardKind = "result";
function pilotOn() { try { return pilotEnabled(localStorage); } catch { return false; } }
function track(event: Parameters<typeof recordPilot>[1]) { try { recordPilot(localStorage,event,g?.mode ?? null); } catch {} }
let light = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
try { light = localStorage.getItem("mandats.light") === "true" || light; } catch {}
let g: Game | null = null, saved: Game | null = null, screen: Screen = "select", view: View = "decision", shared = false;
function freshSeed(): number {
  try {
    const values = new Uint16Array(1);
    crypto.getRandomValues(values);
    return values[0] % 10000;
  } catch {
    return Date.now() % 10000;
  }
}
function announce(message: string, quiet = false) {
  notice.classList.toggle("status-quiet",quiet);
  const activeNotice = dialog.open ? dialog.querySelector<HTMLElement>(".sheet-status") : notice;
  notice.textContent = "";
  if (activeNotice) activeNotice.textContent = message;
}
function adopt(game: Game) {
  announce("");
  ({ g, shared, inherited, screen, view } = localSession(game, history));
  planIds = null;
}
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const candidate = decode(raw); saved = candidate.mode === "national" ? candidate : null; } } catch { announce("La sauvegarde locale est indisponible ou incompatible. Vous pouvez commencer une nouvelle partie."); }
function openEntry() {
  g = null; shared = false; inherited = false; screen = "select"; view = "decision"; planIds = null;
  try {
    ({ g, shared, inherited, screen, view } = entrySession(new URL(location.href)));
    if (g?.mode === "municipal") { g = null; shared = false; inherited = false; screen = "select"; view = "decision"; announce("Le mandat communal est temporairement indisponible."); }
  }
  catch (error) { announce(error instanceof Error ? error.message : "Lien invalide."); }
}
openEntry();
window.addEventListener("hashchange", event => {
  // Ordinary in-page anchors (including the skip link) must not reset a game.
  if (![event.oldURL, event.newURL].some(url => /^#(result|dilemma|challenge)=/.test(new URL(url).hash))) return;
  if (dialog.open) dialog.close();
  announce("");
  openEntry();
  render();
});
function render(focus = true, restoreScroll?: number) {
  document.body.dataset.screen = screen;
  document.body.dataset.view = view;
  const lightControl = document.querySelector<HTMLElement>('.header-actions [data-action="light-mode"]');
  lightControl?.setAttribute("aria-pressed", String(light));
  if (lightControl) lightControl.textContent = light ? "Vue illustrée" : "Vue légère";
  document.body.dataset.mode = g?.mode ?? "selection";
  root.innerHTML = screen === "select" ? selection(saved, light) : screen === "mandate" ? mandateSetup(g!, {light}) : screen === "year" ? yearRecap(g!) : gameShell(g!, screen, view, shared, { light, inherited }, planIds ?? g!.choices);
  syncNationalScene(root, g, { light, inherited });
  document.querySelector("#game-tools")!.removeAttribute("hidden");
  if (focus) {
    root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: restoreScroll ?? 0, behavior: "instant" });
  }
}
function persist() {
  if (!g || shared) return;
  saved = g;
  try { if (!save(g, localStorage)) announce("Votre navigateur ne peut pas sauvegarder. Exportez la partie depuis le menu."); } catch { announce("Sauvegarde indisponible. Exportez votre partie depuis le menu."); }
}
function sheet(title: string, content: string) {
  const replacing = dialog.open;
  dialog.innerHTML = `<div class="sheet-heading"><h2 id="sheet-title">${escape(title)}</h2><button data-action="close" aria-label="Fermer">${icon("close")}</button></div><p class="sheet-status status" role="status" aria-live="polite"></p>${content}`;
  dialog.setAttribute("aria-labelledby", "sheet-title");
  dialog.removeAttribute("aria-label");
  if (!replacing) dialog.showModal();
  else (dialog.querySelector<HTMLElement>("textarea") ?? dialog.querySelector<HTMLElement>("button"))?.focus();
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text: string, description = false) {
  try { await navigator.clipboard.writeText(text); announce(description ? "Description copiée." : "Lien copié."); }
  catch { sheet(description ? "Copier la description" : "Copier le lien", `<p>La copie automatique est indisponible. Sélectionnez le texte ci-dessous.</p><textarea readonly aria-label="${description ? "Description à copier" : "Lien à copier"}">${escape(text)}</textarea>`); }
}
async function png(format: keyof typeof CARD_SIZES) {
  if (!g) return;
  const svg = cardSVG(g, cardKind, format); const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas"); [canvas.width, canvas.height] = CARD_SIZES[format];
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Export image indisponible.");
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Export impossible.")), "image/png"));
    download(blob, `mandats-${g.mode}-${cardKind}-${format}.png`); announce("Carte téléchargée. Résultat de simulation fictive.");
  } finally { URL.revokeObjectURL(url); }
}
function sharingSheet() {
  if (!g) return;
  const model = cardModel(g, cardKind);
  sheet("Partager votre mandat", `<div class="card-kind-picker" role="group" aria-label="Type de carte">${([...(g.turn === domainFor(g).turns ? ["result"] : []), ...(g.turn ? ["decision"] : []), "challenge"] as CardKind[]).map(kind => `<button class="button" data-action="card-kind" data-kind="${kind}" aria-pressed="${kind === cardKind}">${({result:"Héritage",decision:"Décision",challenge:"Défi"})[kind]}</button>`).join("")}</div><p>${cardKind === "challenge" ? "Le défi contient le point de départ et les règles du jeu, sans votre parcours." : cardKind === "decision" ? "Le lien restitue les décisions antérieures pour replacer le destinataire devant ce dilemme. Votre carte décrit le choix effectué. Partagez le défi pour garder le parcours privé." : "Le lien de résultat permet de reconstruire vos décisions dans le jeu. Partagez le défi pour garder votre parcours privé."}</p><div class="share-preview">${cardSVG(g, cardKind, "landscape")}</div><div class="share-buttons"><button class="button primary" data-action="native-share">Partager ${cardKind === "decision" ? "le dilemme" : cardKind === "challenge" ? "le défi" : "le résultat"}</button><button class="button" data-action="copy-result">Copier le lien</button><button class="button" data-action="copy-description">Copier la description de l’image</button></div><h3>Télécharger la carte</h3><div class="format-buttons">${Object.entries(CARD_SIZES).map(([key,[w,h]])=>`<button class="button" data-action="png" data-format="${key}">${w} × ${h}</button>`).join("")}</div><section class="tool-section"><h3>Texte de la carte</h3><p>${escape(model.alt)}</p></section><p class="scope">Image créée sur votre appareil. Aucun envoi automatique. Les aperçus des réseaux restent génériques ; la carte téléchargée contient votre résultat.</p>`);
}
async function action(target: HTMLElement) {
  const a = target.dataset.action;
  const actionScroll = window.scrollY;
  if (a === "light-mode") {
    const inDialog = dialog.contains(target), inPanel = root.contains(target);
    light = !light;
    try { localStorage.setItem("mandats.light", String(light)); } catch {}
    if (dialog.open) dialog.close();
    render(false);
    const nextFocus = inDialog ? (root.querySelector<HTMLElement>('.game-tabs [data-action="tools"]') ?? document.querySelector<HTMLElement>("#game-tools")) : inPanel ? root.querySelector<HTMLElement>('[data-action="light-mode"]') : target;
    nextFocus?.focus({ preventScroll: true });
    return;
  }
  if (a === "world-view") { inherited = !inherited; render(false); document.querySelector<HTMLElement>('[data-action="world-view"]')?.focus({ preventScroll: true }); return; }
  if (a === "pick-city" || a === "fictional-city") { announce("Le mandat communal est temporairement indisponible."); return; }
  if (a === "pilot-consent") { try { setPilotConsent(localStorage,!pilotEnabled(localStorage)); announce(pilotEnabled(localStorage) ? "Journal de test activé localement. Aucun envoi et aucune décision enregistrée." : "Journal de test désactivé et effacé."); target.setAttribute("aria-pressed",String(pilotEnabled(localStorage))); } catch { announce("Le stockage local est indisponible."); } return; }
  if (a === "pilot-export") { download(new Blob([JSON.stringify({version:1,events:readPilot(localStorage)},null,2)],{type:"application/json"}),"mandats-journal-test.json"); announce("Journal exporté sur votre appareil, sans envoi."); return; }
  if (a === "offline-prepare") { announce("Téléchargement du jeu pour jouer sans connexion…"); const result = await prepareOffline(); announce(result.update ? "Une mise à jour est prête. Utilisez Mettre à jour le jeu pour l’activer." : "Le jeu est prêt hors connexion. Votre navigateur peut libérer ce stockage ; exportez les parties importantes."); return; }
  if (a === "offline-update") { await updateOffline(); return; }
  if (a === "offline-remove") { await removeOffline(); announce("Copie hors connexion supprimée. Vos sauvegardes sont conservées."); return; }
  if (a === "plan-reset" && g) { planIds = [...g.choices]; render(); return; }
  if (a === "open-plan" && g) { dialog.close(); screen = "play"; view = "plan"; render(); return; }
  if (a === "share-decision" && g) { cardKind = "decision"; sharingSheet(); return; }
  if (a === "card-kind" && g) { cardKind = target.dataset.kind as CardKind; sharingSheet(); dialog.querySelector<HTMLElement>(`[data-kind="${cardKind}"]`)?.focus(); return; }
  if (a === "copy-description" && g) { await copy(cardModel(g, cardKind).alt, true); return; }
  if (a === "area" && g) {
    const area = (inherited ? domainFor(g).initial().areas : g.areas).find(a => a.id === target.dataset.area);
    if (!area) return;
    const before = domainFor(g).initial().areas.find(a => a.id === area.id)!;
    const pending = g.pending.filter(p => p.effect.area === area.id);
    sheet(area.name, `<p class="eyebrow">${inherited ? "À LA PRISE DE FONCTIONS" : "ÉTAT DU TERRITOIRE"}</p><p>${escape(area.need)}</p><div class="area-detail"><div><span>Services</span><strong>${Math.round(area.services)}/100</strong><small>Héritage : ${before.services}/100</small></div><div><span>Résilience</span><strong>${Math.round(area.resilience)}/100</strong><small>Héritage : ${before.resilience}/100</small></div></div>${!inherited && pending.length ? `<h3>À la livraison</h3><ul>${pending.map(p => `<li>Année ${p.due + 1} : ${escape(p.label)}</li>`).join("")}</ul>` : ""}<p class="scope">Ces indices suivent les règles du mandat.</p>`);
    return;
  }
  if (a === "close") { dialog.close(); return; }
  if (a === "mode") {
    if (target.dataset.mode !== "national") { announce("Le mandat communal est temporairement indisponible."); return; }
    if (g) track("mode_switched");
    g = start("national", freshSeed(), "equilibre", 9);
    shared = false; inherited = false; screen = "mandate"; view = "decision"; planIds = null;
    clearEntryLink(history); track("mode_selected");
  }
  else if (a === "choose-mission" && g) {
    const ambition = target.dataset.ambition as Ambition;
    if (!["equilibre","services","resilience"].includes(ambition)) { announce("Mission inconnue."); return; }
    g = start("national", g.seed, ambition, 9);
    shared = false; inherited = false; screen = "play"; view = "decision"; planIds = null;
    persist(); track("onboarding_completed");
  }
  else if (a === "resume" && saved) { if (saved.mode !== "national") { announce("Le mandat communal est temporairement indisponible."); return; } adopt(saved); }
  else if (a === "choose" && g) {
    const next = decide(g, target.dataset.choice!);
    const yearClosed = next.version >= 9 && next.history.at(-1)?.closed;
    adopt(next);
    if (yearClosed) screen = "year";
    announce(`Décision ${next.turn} prise. ${yearClosed ? "L’année est terminée." : next.turn === domainFor(next).turns ? "Votre bilan est prêt." : "Dossier suivant."}`,true);
    persist();
    if (next.turn === 1) track("first_decision");
    if (next.turn === domainFor(next).turns) track("game_completed");
  }
  else if (a === "next-year" && g) { screen = "play"; view = "decision"; }
  else if (a === "show-result" && g) { screen = "result"; view = "decision"; }
  else if (a === "view") { view = target.dataset.view as View; }
  else if (a === "new") { inherited = false; screen = "select"; shared = false; g = null; planIds = null; clearEntryLink(history); }
  else if (a === "replay" && g) { track("replay_started"); adopt(startingGame(g)); persist(); }
  else if (a === "helper") { sheet("Votre mandat", "<p><strong>La France</strong> : fiscalité, services publics, énergie et dette, avec des effets à l’échelle de profils territoriaux. 30 décisions réparties en cinq chapitres annuels.</p><p>Le parcours est entièrement jouable sur téléphone, sans compte.</p>"); return; }
  else if (a === "method") { sheet("Comprendre les conséquences", `<p>Le mandat national part des comptes publics français. Les coûts des mesures, les effets sociaux et les trajectoires budgétaires sont des hypothèses de simulation documentées dans la méthode.</p><p>Les nouvelles parties comportent 30 décisions, six par année. Intérêts, dette et déficit sont comptabilisés une seule fois à chaque clôture annuelle. Les conséquences continuent d’exister même lorsqu’elles ne créent pas de nouvelle carte.</p><p>La mission choisie au départ change la lecture du bilan. Le résultat final reste multidimensionnel et n’attribue pas de note globale au gouvernement simulé.</p><a class="button" href="/mandats/methode/">Lire les règles et les sources</a>`); return; }
  else if (a === "tools") { sheet("Votre partie", `<p>La sauvegarde reste dans ce navigateur. Pour changer d'appareil, exportez puis importez le fichier.</p>${g && screen !== "mandate" ? `<button class="button" data-action="open-plan">Comparer une autre stratégie</button><button class="button" data-action="export">Exporter la sauvegarde</button>` : ""}<label class="button file-input">Importer une sauvegarde<input id="save-file" type="file" accept="application/json,.json"></label><button class="button" data-action="light-mode" aria-pressed="${light}">${light ? "Activer les animations" : "Réduire les animations"}</button><details><summary>Participer à la validation du jeu</summary><p>Enregistrez uniquement les étapes et leur date sur cet appareil, sans les décisions, scores, nom ou identifiant. Rien n’est envoyé. Export limité aux 30 derniers jours et à 500 événements. Désactiver efface ce journal.</p><button class="button" data-action="pilot-consent" aria-pressed="${pilotOn()}">Enregistrer les étapes de test</button><button class="button" data-action="pilot-export">Exporter mon journal de test</button></details><section class="tool-section"><h3>Installer et jouer hors connexion</h3><p>Sur iPhone : Partager puis Sur l’écran d’accueil. Sur Android : menu du navigateur puis Installer l’application. Le jeu fonctionne aussi dans votre navigateur.</p><button class="button" data-action="offline-prepare">Préparer le jeu hors connexion</button><button class="button" data-action="offline-update">Mettre à jour le jeu</button><button class="text-button" data-action="offline-remove">Supprimer la copie hors connexion</button><p>Le jeu et ses règles sont téléchargés. Les règles et les données du mandat sont conservées dans votre sauvegarde.</p></section><button class="text-button" data-action="new">Choisir un autre mandat</button>`); return; }
  else if (a === "export" && g) { download(new Blob([encode(g)], { type: "application/json" }), `mandats-sauvegarde-v${g.version}.json`); return; }
  else if (a === "share" && g) { cardKind = "result"; sharingSheet(); return; }
  else if (a === "copy-result" && g) { await copy(cardURL(g, cardKind, location.origin)); return; }
  else if (a === "copy-challenge" && g) { await copy(challengeURL(g, location.origin)); return; }
  else if (a === "native-share" && g) {
    track("share_initiated"); const url = cardURL(g, cardKind, location.origin);
    if (navigator.share) { try { await navigator.share({ title: "Mon héritage · Mandats", text: cardModel(g, cardKind).alt, url }); } catch (err) { if (!(err instanceof Error && err.name === "AbortError")) await copy(url); } }
    else await copy(url);
    return;
  } else if (a === "png") { await png(target.dataset.format as keyof typeof CARD_SIZES); return; }
  else return;
  if (dialog.open) dialog.close();
  render(true, a === "choose" ? actionScroll : undefined);
  if(a === "choose" && g?.mode === "national" && g.version >= 8 && matchMedia("(max-width:820px) and (min-height:501px)").matches) {
    const question=root.querySelector<HTMLElement>(".dossier");
    if(question && question.getBoundingClientRect().top < 0) window.scrollTo({top:window.scrollY+question.getBoundingClientRect().top-12,behavior:"instant"});
  }
}
document.addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (!target || (target as HTMLButtonElement).disabled) return;
  action(target).catch(err => announce(err instanceof Error ? err.message : "Cette action n'a pas pu aboutir."));
});
document.addEventListener("change", async event => {
  const input = event.target as HTMLInputElement;
  if (input.matches("[data-plan-year]") && g) {
    const year = Number(input.dataset.planYear);
    planIds = [...(planIds ?? g.choices)];
    planIds[year] = input.value;
    planIds = planIds.slice(0, year + 1);
    render(false);
    root.querySelector<HTMLElement>(`[data-plan-year="${year}"]`)?.focus();
    announce("Plan alternatif recalculé. Votre sauvegarde est intacte.");
    return;
  }
  if (input.id !== "save-file" || !input.files?.[0]) return;
  try { if (input.files[0].size > MAX_SAVE_BYTES) throw new Error("Fichier trop volumineux."); adopt(decode(await input.files[0].text())); dialog.close(); render(); announce("Partie importée et recalculée."); persist(); }
  catch (err) { announce(err instanceof Error ? err.message : "Import impossible."); }
});
render(false);
