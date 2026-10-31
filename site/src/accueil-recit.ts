/** Rendu sans DOM du récit, commun au HTML publié et au navigateur. */
import type { Territoire } from "./donnees.ts";
import { comptesRecit, formaterRecit, SOURCE_RECIT, type ComptesRecit } from "./recit-comptes.ts";
import { echapper } from "./texte.ts";
import { renduChapitresRecit } from "./recit-chapitres.ts";

const IDS = ["recit-recettes", "recit-depenses", "recit-ecart"] as const;
const NOMS = ["Recettes", "Dépenses", "Écart"] as const;
const euros = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 20 });

function montant(nombre: number): string {
  return `${echapper(formaterRecit(nombre))}\u00a0€`;
}

function milliards(nombre: number): string {
  return `${echapper(formaterRecit(nombre / 1e9))}\u00a0Md€`;
}

/**
 * Une même échelle pour les trois états. Chaque fraction exprime la part
 * occupée dans un bloc ; elle ne dépend jamais des montants déjà arrondis.
 * Une cellule frontière peut contenir une partie commune et une différence.
 */
function graphique(comptes: ComptesRecit): { grille: string; legende: string } {
  const maximum = Math.max(100, comptes.depensesPour100);
  const unite = maximum <= 200 ? 1 : Math.ceil(maximum / 200);
  const nombre = Math.min(200, Math.ceil(maximum / unite));
  const fraction = (valeur: number, index: number): number =>
    Math.max(0, Math.min(1, (valeur - index * unite) / unite));
  const blocs = Array.from({ length: nombre }, (_, index) => {
    const recette = fraction(100, index);
    const depense = fraction(comptes.depensesPour100, index);
    const commun = Math.min(recette, depense);
    const difference = Math.abs(depense - recette);
    const changement = depense > recette ? "gap" : recette > depense ? "retained" : "common";
    // --i échelonne le remplissage ; --j fait tomber les blocs en plus un à un.
    const rangEcart = changement === "gap" ? index - Math.floor(100 / unite) : 0;
    return `<span class="recit-unit" data-change="${changement}" style="--receipt:${recette};--expense:${depense};--common:${commun};--difference:${difference};--i:${index};--j:${Math.max(0, rangEcart)}"><span class="recit-unit__fill"></span></span>`;
  }).join("");
  return {
    grille: `<div class="recit-grid" data-unit="${unite}">${blocs}</div>`,
    legende: `<span class="recit-legend-unit">Un bloc plein = ${montant(unite)}</span><span class="recit-legend-note">Les fractions restent proportionnelles.</span>`,
  };
}

export function renduSourcesRecit(comptes: ComptesRecit): string {
  const ecart = comptes.depenses - comptes.recettes;
  const solde = comptes.recettes - comptes.depenses;
  const qualification = comptes.nature === "deficit" ? "le déficit"
    : comptes.nature === "excedent" ? "l’excédent" : "l’écart";
  return `<dialog class="recit-sources" id="recit-sources" aria-labelledby="recit-sources-title" open>
    <header><h2 id="recit-sources-title">Les chiffres, à la source.</h2><button type="button" data-recit-close aria-label="Fermer les sources">Fermer</button></header>
    <p>France, exercice ${echapper(comptes.annee)}. État, collectivités, Sécurité sociale et organismes publics : l’ensemble des administrations publiques, en comptabilité nationale.</p>
    <nav aria-label="Sources des comptes publics"><a href="${echapper(SOURCE_RECIT.url)}">${echapper(SOURCE_RECIT.producteur)} : données d’origine</a><a href="/bilan/#france-sorties">Lire le détail des dépenses</a><a href="/sources/">Sources et méthode</a></nav>
    <dl class="recit-source-accounts">
      <div><dt>Recettes annuelles</dt><dd>${echapper(euros.format(comptes.recettes))}\u00a0€</dd></div>
      <div><dt>Dépenses annuelles</dt><dd>${echapper(euros.format(comptes.depenses))}\u00a0€</dd></div>
      <div><dt>Solde public annuel</dt><dd>${echapper(euros.format(solde))}\u00a0€</dd></div>
    </dl>
    <p>Pour 100\u00a0€ de recettes, les dépenses représentent ${montant(comptes.depensesPour100)} et ${qualification} ${montant(Math.abs(comptes.ecartPour100))}. Le ratio est calculé ainsi : dépenses ÷ recettes × 100. L’écart repose sur les mêmes montants non arrondis.</p>
    <p>Les montants du récit sont affichés à deux décimales au plus ; Md€ signifie milliards d’euros. Les blocs conservent leurs fractions. Un petit écart non nul reste indiqué comme inférieur à 0,01\u00a0€.</p>
    <p>Le déficit est un flux sur une année. Il contribue au besoin de financement. La dette est un stock ; sa variation dépend aussi d’autres opérations que ce seul déficit.${ecart === 0 ? " Les recettes et les dépenses de cet exercice sont égales." : ""}</p>
  </dialog>`;
}

export function renduRecitComptes(france?: Territoire): string {
  const comptes = comptesRecit(france);
  if (!comptes) return `<section class="recit recit--empty" data-recit-empty>
    <div class="recit-copy"><p class="recit-kicker">Les comptes de la France</p><h1 class="recit-title">Les comptes publics, à portée de main.</h1><p class="recit-explanation">Les séries publiées ne permettent pas encore de rapprocher les recettes et les dépenses sur un même exercice.</p><nav aria-label="Explorer les comptes publics"><a href="/bilan/">Lire le dossier France</a><a href="/salaires/">Comprendre son salaire</a><a href="/sources/">Consulter les sources</a></nav></div>
  </section>`;

  const { grille, legende } = graphique(comptes);
  const nature = comptes.nature;
  const ecart = Math.abs(comptes.ecartPour100);
  const etapes = [
    {
      nombre: 100,
      verbe: "entrent.",
      explication: "Impôts, cotisations, autres recettes. Voyons ce que ces 100 euros permettent de financer.",
      total: `${milliards(comptes.recettes)} de recettes annuelles`,
    },
    {
      nombre: comptes.depensesPour100,
      verbe: "sortent.",
      explication: `Pour 100 euros de recettes, les administrations publiques ont dépensé ${echapper(formaterRecit(comptes.depensesPour100))} euros en ${echapper(comptes.annee)}.`,
      total: `${milliards(comptes.depenses)} de dépenses annuelles`,
    },
    {
      nombre: ecart,
      verbe: nature === "deficit" ? "manquent." : nature === "excedent" ? "restent." : "d’écart.",
      explication: nature === "deficit"
        ? "Ce qui manque, c’est le déficit. Il contribue au besoin de financement. La dette, elle, est un stock."
        : nature === "excedent"
          ? "Les recettes dépassent les dépenses. Cet excédent est le solde positif de l’année."
          : "Les recettes et les dépenses s’équilibrent sur cet exercice.",
      total: nature === "deficit"
        ? `${milliards(comptes.depenses - comptes.recettes)} de déficit annuel`
        : nature === "excedent"
          ? `${milliards(comptes.recettes - comptes.depenses)} d’excédent annuel`
          : "0\u00a0Md€ de solde annuel",
    },
  ];
  const description = `100 € de recettes, ${formaterRecit(comptes.depensesPour100)} € de dépenses, ${formaterRecit(ecart)} € ${nature === "deficit" ? "de déficit" : nature === "excedent" ? "d’excédent" : "d’écart"}.`;
  return `<section class="recit" data-recit data-nature="${nature}" data-step="0" aria-label="Comprendre les comptes publics">
    <nav class="recit-nav" aria-label="Les étapes du récit">
      <div class="recit-nav-steps">${NOMS.map((nom, index) => `<a href="#${IDS[index]}" data-recit-step="${index}"${index === 0 ? ' aria-current="step"' : ""}><span aria-hidden="true">0${index + 1}</span>${nom}</a>`).join("")}</div>
      <div class="recit-nav-chapitres" aria-label="Suite du récit"><a href="#recit-repartir" data-recit-chapitre="recit-repartir"><span aria-hidden="true">04</span>France</a><a href="#recit-ville" data-recit-chapitre="recit-ville"><span aria-hidden="true">05</span>Ville</a><a href="#recit-salaire" data-recit-chapitre="recit-salaire"><span aria-hidden="true">06</span>Salaire</a><a href="#recit-mandats-title" data-recit-chapitre="recit-mandats"><span aria-hidden="true">07</span>Mandats</a></div>
      <span class="recit-parrainages" aria-hidden="true"><b data-parrainages>0</b> / 500</span>
      <a class="recit-source-link" href="#recit-sources" data-recit-source><span class="recit-source-context">France · ${echapper(comptes.annee)} · </span>Sources</a>
    </nav>
    <div class="recit-story">
      <div class="recit-chapters">${etapes.map((etape, index) => {
        const titre = index === 0 ? "h1" : "h2";
        return `<article class="recit-step" id="${IDS[index]}" data-recit-panel="${index}" aria-labelledby="${IDS[index]}-titre">
          <div class="recit-copy"><p class="recit-kicker">France · ${echapper(comptes.annee)} · Comptes publics</p><${titre} class="recit-title" id="${IDS[index]}-titre"><span class="recit-number">${montant(etape.nombre)}</span><span class="recit-verb">${etape.verbe}</span></${titre}><p class="recit-explanation">${etape.explication}</p><p class="recit-total">${etape.total} · montant arrondi.</p></div>
          <div class="recit-mobile-visual" data-step="${index}" aria-hidden="true">${grille}<p class="recit-legend">${legende}</p></div>
        </article>`;
      }).join("")}</div>
      <figure class="recit-visual" data-recit-visual role="img" aria-label="${echapper(description)}">${grille}<figcaption class="recit-legend">${legende}</figcaption></figure>
    </div>
    ${renduChapitresRecit(france)}
    ${renduSourcesRecit(comptes)}
  </section>`;
}
