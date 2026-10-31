/**
 * L'histoire de l'accueil : une scène plein écran, une étape à la fois, de la facture de la France
 * jusqu'au bouton Mandats (validée par le propriétaire le 31 octobre 2026).
 *
 * Rendu pur, partagé par le pré-rendu et le navigateur. Sans JavaScript, les étapes se lisent
 * en continu comme une liste ; le contrôleur (histoire-runtime.ts) en fait une scène.
 * Tous les montants viennent des séries publiées ; une étape sans donnée disparaît, elle n'est
 * jamais affichée à zéro.
 */
import type { Territoire } from "./donnees.ts";
import { comptesRecit, SOURCE_RECIT } from "./recit-comptes.ts";
import { distributionDepenses, PROFIL_TRAVAIL } from "./recit-chapitres.ts";
import { renduRecitComptes, renduSourcesRecit } from "./accueil-recit.ts";
import { echapper } from "./texte.ts";

export type Etape = {
  chapitre: number;
  scene: "carte" | "billets" | "ecart" | "arbre" | "bercy" | "pieces" | "commune" | "final";
  titre: string;
  lib?: string;
  valeur?: number;
  decimales?: number;
  unite?: string;
  sous?: string;
  ton?: "or" | "argile";
  desc?: string;
  note?: string;
  /** Paramètre de scène : caméra, poste mis en avant, étape de la paie… */
  k?: number;
  direct?: boolean;
};

export const CHAPITRES = ["La facture", "Les recettes", "L’écart", "Où va l’argent", "Votre salaire", "Votre commune", "Mandats"] as const;

/** Publication de la Direction du Budget citée dans l'étape des pensions (PLF 2027). */
export const PENSIONS_EDUCATION = { part: 32, pensions: 28.5, credits: 89.1, annee: "2027" } as const;

/** Villes proposées : codes Insee, ouverts directement dans Ville. */
export const VILLES_HISTOIRE: readonly [string, string][] = [["Bordeaux", "33063"], ["Lyon", "69123"], ["Lille", "59350"], ["Marseille", "13055"]];

const md = (n: number) => n / 1e9;

export function etapesHistoire(france?: Territoire): Etape[] {
  const comptes = comptesRecit(france);
  if (!comptes) return [];
  const a = comptes.annee, src = `${SOURCE_RECIT.producteur}, comptes ${a}.`;
  const e: Etape[] = [];
  const titre1 = "Chaque année, la France <em>dépense</em>…";
  e.push({ chapitre: 0, scene: "carte", k: 0, titre: titre1 });
  e.push({ chapitre: 0, scene: "carte", k: 1, titre: titre1, lib: `Dépenses publiques · ${a}`, valeur: md(comptes.depenses), decimales: 1, unite: "Md€", sous: "État, Sécurité sociale, collectivités", desc: "L’ensemble des administrations publiques, en comptabilité nationale.", note: src });
  const pop = france?.population;
  if (pop && pop > 0) {
    const parHab = comptes.depenses / pop;
    e.push({ chapitre: 0, scene: "carte", k: 2, titre: "Ramené à <em>chacun</em>.", lib: "Par habitant et par an", valeur: Math.round(parHab), unite: "€", sous: `${fmt(md(comptes.depenses), 1)} Md€ ÷ ${fmt(pop / 1e6, 1)} millions d’habitants`, desc: "Bébés et retraités compris.", note: src });
  }
  e.push({ chapitre: 1, scene: "billets", titre: "D’où vient <em>l’argent</em>&nbsp;?", lib: `Recettes publiques · ${a}`, valeur: md(comptes.recettes), decimales: 1, unite: "Md€", sous: "Impôts, cotisations, autres recettes", ton: "or", desc: "TVA, CSG, impôt sur le revenu, cotisations sur les salaires…", note: src });
  const titre3 = "Ce qui entre, <em>ce qui sort</em>.";
  e.push({ chapitre: 2, scene: "ecart", k: 0, titre: titre3, lib: "Recettes", valeur: md(comptes.recettes), decimales: 1, unite: "Md€", sous: `face à ${fmt(md(comptes.depenses), 1)} Md€ de dépenses`, desc: "Les deux colonnes ne sont pas à la même hauteur.", note: src });
  const ecart = comptes.depenses - comptes.recettes;
  if (comptes.nature === "deficit") {
    e.push({ chapitre: 2, scene: "ecart", k: 1, titre: titre3, lib: "Il manque", valeur: md(ecart), decimales: 1, unite: "Md€", sous: `${fmt(comptes.ecartPour100, 2)} € empruntés pour 100 € de recettes`, desc: "Le déficit public de l’année, financé par l’emprunt.", note: "Déficit : un flux sur l’année. La dette : le stock accumulé." });
    const parSeconde = ecart / (365 * 24 * 3600);
    e.push({ chapitre: 2, scene: "ecart", k: 1, direct: true, titre: "Depuis que vous lisez <em>cette histoire</em>…", lib: "Emprunté depuis votre arrivée", valeur: parSeconde, unite: "€", sous: `${fmt(parSeconde, 0)} € par seconde, en moyenne`, desc: `${fmt(md(ecart), 1)} Md€ répartis sur une année.`, note: "Moyenne lissée, à titre de repère." });
  } else {
    e.push({ chapitre: 2, scene: "ecart", k: 1, titre: titre3, lib: comptes.nature === "excedent" ? "Excédent" : "Équilibre", valeur: md(Math.abs(ecart)), decimales: 1, unite: "Md€", desc: "Recettes et dépenses de l’année.", note: src });
  }
  const dist = france ? distributionDepenses(france) : undefined;
  if (dist) {
    const titre4 = "Pour 100 € de recettes, <em>où va l’argent&nbsp;?</em>";
    const note4 = `Pour 100 € de recettes, ${fmt(dist.total, 2)} € dépensés. Eurostat, répartition ${dist.annee} (dernière année complète).`;
    const DESC: Record<string, string> = { Retraites: "Pensions de retraite et de réversion, fonctionnaires compris.", "Rémunérations des agents publics": "Agents de l’État, des hôpitaux et des collectivités.", "Soins et services remboursés": "Soins, médicaments et services remboursés aux ménages.", "Achats de biens et services": "Fournitures, énergie, prestations achetées.", Investissement: "Routes, bâtiments, équipements, défense.", "Intérêts de la dette": "Le coût de la dette déjà accumulée." };
    dist.lignes.slice(0, 6).forEach((l, i) => {
      e.push({ chapitre: 3, scene: "arbre", k: i, titre: titre4, lib: `${l.nom} · ${dist.annee}`, valeur: l.part, decimales: 2, unite: "€", sous: `${fmt(l.part, 2)} € sur 100 €`, desc: DESC[l.nom], note: note4 });
      if (l.nom === "Retraites") {
        const p = PENSIONS_EDUCATION;
        e.push({ chapitre: 3, scene: "bercy", titre: "Des pensions <em>cachées</em> dans les budgets.", lib: `Éducation nationale · ${p.annee}`, valeur: p.part, unite: "€", sous: "sur 100 € de crédits paient des pensions", desc: `${fmt(p.pensions, 1)} Md€ sur ${fmt(p.credits, 1)} Md€ versés au compte Pensions. Déjà comptés dans les ${fmt(l.part, 2)} € des retraites.`, note: `Direction du Budget, rapport sur les pensions de la fonction publique, annexe au PLF ${p.annee}.` });
      }
    });
    e.push({ chapitre: 3, scene: "arbre", k: 9, titre: titre4, lib: `Au total · ${dist.annee}`, valeur: dist.total, decimales: 2, unite: "€", sous: dist.total > 100 ? `${fmt(dist.total - 100, 2)} € de plus que ce qui est entré` : "", desc: "Dix postes, du plus lourd au plus léger.", note: note4 });
  }
  const [reste, salariales, impot, patronales] = PROFIL_TRAVAIL.map(([, part]) => part);
  const titre5 = "Ce que paie votre employeur, <em>et où ça va.</em>";
  const note5 = "Célibataire sans enfant au salaire moyen, France 2025. OCDE, Taxing Wages 2026.";
  e.push({ chapitre: 4, scene: "pieces", k: 0, titre: titre5, lib: "Payés par l’employeur", valeur: 100, decimales: 2, unite: "€", sous: "Le coût total de votre travail", ton: "or", desc: "Une pièce vaut un euro.", note: note5 });
  e.push({ chapitre: 4, scene: "pieces", k: 1, titre: titre5, lib: "Salaire brut", valeur: 100 - patronales, decimales: 2, unite: "€", sous: `Cotisations patronales : −${fmt(patronales, 2)} €`, desc: "Retraite, santé, chômage, famille.", note: note5 });
  e.push({ chapitre: 4, scene: "pieces", k: 2, titre: titre5, lib: "Net avant impôt", valeur: 100 - patronales - salariales, decimales: 2, unite: "€", sous: `Cotisations salariales : −${fmt(salariales, 2)} €`, desc: "Retraite complémentaire, CSG, CRDS.", note: note5 });
  e.push({ chapitre: 4, scene: "pieces", k: 3, titre: titre5, lib: "Il vous reste", valeur: reste, decimales: 2, unite: "€", sous: `Impôt sur le revenu : −${fmt(impot, 2)} €`, ton: "or", desc: "Sur 100 € payés par l’employeur.", note: note5 });
  e.push({ chapitre: 5, scene: "commune", titre: "Et dans <em>votre</em> mairie&nbsp;?", note: "Les comptes des communes publiés par la DGFiP." });
  e.push({ chapitre: 6, scene: "final", titre: "À vous de <em>gouverner</em>." });
  return e;
}

const nombre = (d: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
function fmt(n: number, d = 0): string { return nombre(d).format(n); }

function etape(x: Etape, i: number): string {
  const chiffre = x.valeur === undefined ? "" : `<div class="histoire__chiffre"><p class="histoire__lib">${echapper(x.lib ?? "")}</p><p class="histoire__gros" data-valeur="${x.valeur}" data-decimales="${x.decimales ?? 0}" data-unite="${echapper(x.unite ?? "")}"${x.direct ? " data-direct" : ""}>${x.direct ? "0" : fmt(x.valeur, x.decimales ?? 0)}<span class="histoire__u">${echapper(x.unite ?? "")}</span></p>${x.sous ? `<p class="histoire__sous${x.ton === "or" ? " or" : ""}">${echapper(x.sous)}</p>` : ""}${x.desc ? `<p class="histoire__desc">${echapper(x.desc)}</p>` : ""}</div>`;
  return `<li class="histoire__etape" data-i="${i}" data-chapitre="${x.chapitre}" data-tableau="${x.scene}"${x.k !== undefined ? ` data-k="${x.k}"` : ""}>
      <p class="histoire__chap">${String(x.chapitre + 1).padStart(2, "0")} · ${CHAPITRES[x.chapitre]}</p>
      <${i === 0 ? "h1" : "h2"} class="histoire__titre">${x.titre}</${i === 0 ? "h1" : "h2"}>${chiffre}${x.note ? `<p class="histoire__note">${echapper(x.note)}</p>` : ""}
    </li>`;
}

export function renduHistoire(france?: Territoire): string {
  const etapes = etapesHistoire(france);
  const comptes = comptesRecit(france);
  if (!etapes.length || !comptes) return renduRecitComptes(france);
  const dist = france ? distributionDepenses(france) : undefined;
  const deficit = comptes.nature === "deficit" ? md(comptes.depenses - comptes.recettes) : 0;
  return `<div class="recit-histoire" data-recit><section class="histoire" id="histoire" data-histoire aria-roledescription="récit" aria-label="Les comptes de la France, en ${CHAPITRES.length} chapitres">
    <div class="histoire__fond histoire__fond--carte" aria-hidden="true"><div class="histoire__plan"><div class="histoire__carte"><img src="/mandats/art/national-relief-1536.webp" alt="" width="1536" height="1024" fetchpriority="high"><div class="histoire__lumieres"></div></div></div><div class="histoire__voile"></div></div>
    <div class="histoire__fond histoire__fond--hemi" aria-hidden="true"><div class="histoire__plan"></div><div class="histoire__voile"></div></div>
    <canvas class="histoire__fx" aria-hidden="true"></canvas>
    <div class="histoire__haut"><div class="histoire__progression" aria-hidden="true">${CHAPITRES.map((c, j) => `<button type="button" class="histoire__seg" data-chapitre="${j}" tabindex="-1" title="${c}"><i></i></button>`).join("")}</div><div class="histoire__reperes"><span class="histoire__ici"></span><span class="histoire__ensuite"></span><span class="histoire__outils"><button type="button" class="histoire__pill" data-histoire-index>Chapitres</button><a class="histoire__pill" href="#recit-sources" data-recit-source>Sources</a></span></div></div>
    <ol class="histoire__etapes">${etapes.map(etape).join("")}</ol>
    <div class="histoire__zone" aria-hidden="true">
      <div class="histoire__viz histoire__ecart" data-viz="ecart"><div class="histoire__col"><div class="histoire__barre rec" style="--h:${(comptes.recettes / Math.max(comptes.recettes, comptes.depenses) * 100).toFixed(2)}%"></div><p>Recettes<b>${fmt(md(comptes.recettes), 1)} Md€</b></p></div><div class="histoire__col"><div class="histoire__barre dep" style="--h:${(comptes.depenses / Math.max(comptes.recettes, comptes.depenses) * 100).toFixed(2)}%"><div class="histoire__trou" style="--t:${(Math.max(0, comptes.depenses - comptes.recettes) / comptes.depenses * 100).toFixed(2)}%"></div></div><p>Dépenses<b>${fmt(md(comptes.depenses), 1)} Md€</b></p></div></div>
      ${dist ? `<div class="histoire__viz histoire__arbre" data-viz="arbre" data-postes='${echapper(JSON.stringify(dist.lignes.map(l => [l.nom.replace("Rémunérations des agents publics", "Rémunérations").replace("Soins et services remboursés", "Soins remboursés").replace("Achats de biens et services", "Achats"), Math.round(l.part * 100) / 100])))}'></div>` : ""}
      <div class="histoire__viz histoire__bercy" data-viz="bercy"><div class="histoire__leg"><span><b class="p"></b>Pensions · ${PENSIONS_EDUCATION.part} €</span><span><b></b>École · ${100 - PENSIONS_EDUCATION.part} €</span></div><div class="histoire__cent">${Array.from({ length: 100 }, (_, i) => `<i${i < PENSIONS_EDUCATION.part ? ' class="p"' : ""} style="--k:${i}"></i>`).join("")}</div></div>
    </div>
    <div class="histoire__commune" data-viz="commune"><form action="/territoire/" method="get"><label class="sr-only" for="histoire-commune">Rechercher une commune</label><input id="histoire-commune" name="q" placeholder="Votre commune" autocomplete="off"><button type="submit">Voir</button></form><p class="histoire__villes">${VILLES_HISTOIRE.map(([n, c]) => `<a href="/territoire/?niveau=commune&amp;territoire=${c}">${n}</a>`).join("")}</p></div>
    <div class="histoire__final" data-viz="final"><p class="histoire__chap">07 · Mandats</p><p class="histoire__final-titre">À vous de <em>gouverner</em>.</p><div class="histoire__ligne"><span><b>5 ans</b>de mandat</span><span><b>577</b>députés</span>${deficit ? `<span><b>${fmt(deficit, 1)} Md€</b>de déficit à reprendre</span>` : ""}</div><a class="histoire__cta" href="/mandats/jouer/">Prendre le pouvoir</a></div>
    <div class="histoire__bas"><p class="histoire__note-bas" aria-live="polite"></p><div class="histoire__nav"><button type="button" class="histoire__prec" aria-label="Étape précédente"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><button type="button" class="histoire__suiv"><span class="histoire__suiv-t">Commencer</span><small class="histoire__suiv-s"></small><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div><p class="histoire__compteur"><span class="histoire__num"></span><span class="histoire__astuce">Touchez ou glissez · flèches au clavier</span></p></div>
    <div class="histoire__index" role="dialog" aria-modal="true" aria-label="Chapitres" hidden><button type="button" class="histoire__pill histoire__fermer">Fermer</button><ol>${CHAPITRES.map((c, j) => `<li><button type="button" data-aller-chapitre="${j}"><span>${String(j + 1).padStart(2, "0")}</span><b>${c}</b></button></li>`).join("")}</ol></div>
  </section>
  ${renduSourcesRecit(comptes)}</div>`;
}
