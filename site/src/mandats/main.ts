import "./style.css";
import { decide, DOMAINS, start } from "./engine.ts";
import type { Game, Mode } from "./types.ts";
import { briefing, gameShell, selection } from "./render.ts";
import type { Screen, View } from "./render.ts";
import { decode, encode, save, STORAGE_KEY } from "./storage.ts";
import { CARD_SIZES, challengeFromURL, challengeURL, escape, resultURL, sharedResult, shareText, socialSVG } from "./sharing.ts";

const root = document.querySelector<HTMLElement>("#mandats")!;
const dialog = document.querySelector<HTMLDialogElement>("#details")!;
const notice = document.querySelector<HTMLElement>("#notice")!;
let g: Game | null = null, saved: Game | null = null, screen: Screen = "select", view: View = "decision", shared = false;
function announce(message: string) { notice.textContent = message; }
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) saved = decode(raw); } catch { announce("La sauvegarde locale est indisponible ou incompatible. Vous pouvez commencer une nouvelle partie."); }
try {
  const result = sharedResult(location.hash);
  if (result) { g = result; shared = true; screen = "result"; }
  else { const challenge = challengeFromURL(new URL(location.href)); if (challenge) { g = challenge; screen = "briefing"; } }
} catch (error) { announce(error instanceof Error ? error.message : "Lien invalide."); }
function render(focus = true) {
  document.body.dataset.mode = g?.mode ?? "selection";
  root.innerHTML = screen === "select" ? selection(saved) : screen === "briefing" ? briefing(g!) : gameShell(g!, screen, view, shared);
  document.querySelector("#game-tools")!.toggleAttribute("hidden", !g || screen === "select");
  if (focus) { root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }
}
function persist() {
  if (!g || shared) return;
  saved = g;
  try { if (!save(g, localStorage)) announce("Votre navigateur ne peut pas sauvegarder. Exportez la partie depuis le menu."); } catch { announce("Sauvegarde indisponible. Exportez votre partie depuis le menu."); }
}
function sheet(title: string, content: string) {
  dialog.innerHTML = `<div class="sheet-heading"><h2>${title}</h2><button data-action="close" aria-label="Fermer">×</button></div>${content}`;
  dialog.showModal();
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); announce("Lien copié."); }
  catch { sheet("Copier le lien", `<p>La copie automatique est indisponible. Sélectionnez le lien ci-dessous.</p><textarea readonly aria-label="Lien à copier">${escape(text)}</textarea>`); }
}
async function png(format: keyof typeof CARD_SIZES) {
  if (!g) return;
  const svg = socialSVG(g, format); const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas"); [canvas.width, canvas.height] = CARD_SIZES[format];
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Export image indisponible.");
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Export impossible.")), "image/png"));
    download(blob, `mandats-${g.mode}-${format}.png`); announce("Carte téléchargée. Résultat de simulation fictive.");
  } finally { URL.revokeObjectURL(url); }
}
async function action(target: HTMLElement) {
  const a = target.dataset.action;
  if (a === "close") { dialog.close(); return; }
  if (a === "mode") { g = start(target.dataset.mode as Mode); shared = false; screen = "briefing"; }
  else if (a === "resume" && saved) { g = saved; shared = false; screen = g.turn === DOMAINS[g.mode].turns ? "result" : "play"; view = "decision"; }
  else if (a === "begin") { screen = "play"; view = "decision"; persist(); }
  else if (a === "choose" && g) { g = decide(g, target.dataset.choice!); screen = "resolution"; persist(); }
  else if (a === "next" && g) { screen = g.turn === DOMAINS[g.mode].turns ? "result" : "play"; view = "decision"; }
  else if (a === "view") { view = target.dataset.view as View; }
  else if (a === "new") { screen = "select"; shared = false; history.replaceState(null, "", "/mandats/"); }
  else if (a === "replay" && g) { g = start(g.mode, g.seed); shared = false; screen = "briefing"; history.replaceState(null, "", "/mandats/"); }
  else if (a === "helper") { sheet("Quel mandat choisir ?", "<p><strong>La ville</strong> : des écoles, des équipements et des quartiers. Les projets sont concrets, les budgets de fonctionnement et d'investissement distincts. Six tours.</p><p><strong>La France</strong> : fiscalité, services, énergie et dette, avec des effets à l'échelle de profils territoriaux fictifs. Cinq tours d'introduction.</p><p>Les deux parcours sont entièrement jouables sur téléphone, sans compte.</p>"); return; }
  else if (a === "method") { sheet("Comprendre les conséquences", `<p>Les chiffres sont des hypothèses de scénario, jamais les comptes réels d'une ville ou une prévision sur la France.</p><p>Chaque année combine : engagements livrés, usure des services et du patrimoine, décision et événement. Le détail reste dans le journal.</p><p>Le score donne le même poids aux finances, services, cohésion et résilience/patrimoine. La confiance est un indice de jeu, pas une intention de vote.</p><a class="button" href="/mandats/methode/">Lire les règles et les sources</a>`); return; }
  else if (a === "tools") { sheet("Votre partie", `<p>La sauvegarde reste dans ce navigateur. Pour changer d'appareil, exportez puis importez le fichier.</p><button class="button" data-action="export">Exporter la sauvegarde</button><label class="button file-input">Importer une sauvegarde<input id="save-file" type="file" accept="application/json,.json"></label><button class="text-button" data-action="new">Choisir un autre mandat</button>`); return; }
  else if (a === "export" && g) { download(new Blob([encode(g)], { type: "application/json" }), "mandats-sauvegarde-v1.json"); return; }
  else if (a === "share" && g) { sheet("Partager votre héritage", `<p>Le résultat est anonyme. Son lien permet de reconstruire <strong>vos décisions dans le jeu</strong>. Partagez le défi seul si vous préférez garder votre parcours privé.</p><div class="share-buttons"><button class="button primary" data-action="native-share">Partager le résultat et mes choix</button><button class="button" data-action="copy-result">Copier le lien du résultat</button><button class="button" data-action="copy-challenge">Copier le défi sans mes choix</button></div><h3>Télécharger la carte de résultat</h3><p>Image générée sur votre appareil, sans envoi de données.</p><div class="format-buttons">${Object.entries(CARD_SIZES).map(([key, [w, h]]) => `<button class="button" data-action="png" data-format="${key}">${w} × ${h}</button>`).join("")}</div><p class="scope">Les aperçus de lien montrent le jeu. Le score personnel figure dans l'image téléchargeable et la page de résultat.</p>`); return; }
  else if (a === "copy-result" && g) { await copy(resultURL(g, location.origin)); return; }
  else if (a === "copy-challenge" && g) { await copy(challengeURL(g, location.origin)); return; }
  else if (a === "native-share" && g) {
    const url = resultURL(g, location.origin);
    if (navigator.share) { try { await navigator.share({ title: "Mon héritage · Mandats", text: shareText(g), url }); } catch (err) { if (!(err instanceof Error && err.name === "AbortError")) await copy(url); } }
    else await copy(url);
    return;
  } else if (a === "png") { await png(target.dataset.format as keyof typeof CARD_SIZES); return; }
  else return;
  if (dialog.open) dialog.close(); render();
}
document.addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (!target || (target as HTMLButtonElement).disabled) return;
  action(target).catch(err => announce(err instanceof Error ? err.message : "Cette action n'a pas pu aboutir."));
});
document.addEventListener("change", async event => {
  const input = event.target as HTMLInputElement;
  if (input.id !== "save-file" || !input.files?.[0]) return;
  try { if (input.files[0].size > 2048) throw new Error("Fichier trop volumineux."); g = decode(await input.files[0].text()); shared = false; persist(); screen = g.turn === DOMAINS[g.mode].turns ? "result" : "play"; view = "decision"; dialog.close(); render(); announce("Partie importée et recalculée."); }
  catch (err) { announce(err instanceof Error ? err.message : "Import impossible."); }
});
render(false);
