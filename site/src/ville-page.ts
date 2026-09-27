/** Lecture éditoriale communale. Tous les montants proviennent des séries OFGL de la commune. */
import type { Indicateur, Territoire } from "./donnees.ts";
import { timeChart } from "./chart-studio.ts";
import { rendrePartsBudgetVille } from "./parts-budget-ville.ts";
import { insightsTerritoire } from "./insights-territoire.ts";
import { cartesAvecSuite } from "./insights-rendu.ts";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const court = (n: number) => `${nombre.format(n / 1e6)} M€`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function dernier(serie?: Record<string, number>): [string, number] | null {
  const an = Object.keys(serie ?? {}).filter(a => Number.isFinite(serie![a])).sort().at(-1);
  return an ? [an, serie![an]] : null;
}

function graphe(titre: string, description: string, series: { name: string; id: string; color: string }[], donnees: Territoire["series"]): string {
  const disponibles = series.map(l => ({ name: l.name, color: l.color, values: donnees[l.id] ?? {} }))
    .filter(l => Object.values(l.values).some(Number.isFinite));
  if (!disponibles.length) return "";
  return timeChart({
    title: titre, description,
    series: disponibles.map(l => ({ ...l, values: Object.fromEntries(Object.entries(l.values).map(([a, v]) => [a, v / 1e6])) })),
    unit: "Millions d’euros", format: v => `${nombre.format(v)} M€`,
    legend: disponibles.length > 1,
  });
}

function cartes(territoire: Territoire): string {
  const lignes = [
    { id: "ofgl_recettes_fonctionnement", label: "Recettes de fonctionnement", note: "encaissées dans l’année" },
    { id: "ofgl_depenses_fonctionnement", label: "Dépenses de fonctionnement", note: "services et charges courantes" },
    { id: "ofgl_epargne_brute", label: "Épargne brute", note: "avant remboursement du capital" },
    { id: "ofgl_encours_dette", label: "Dette au 31 décembre", note: "capital restant à rembourser" },
  ];
  return `<section class="territoire-reperes-section" id="territoire-chiffres-cles" aria-label="Les chiffres clés de ${esc(territoire.nom)}">
    <h2>Les chiffres clés</h2><div class="territoire-reperes-grid"><div class="reperes">
    ${lignes.map(({ id, label, note }) => {
      const value = dernier(territoire.series?.[id]);
      return value ? `<article class="repere"><span class="repere__role">${label}</span><strong class="repere__valeur">${esc(court(value[1]))}</strong><span class="repere__date">${value[0]} · ${note}</span></article>` : "";
    }).join("")}
    </div></div><p class="ville-source">Source : <a href="/sources/">OFGL</a> · comptes exécutés.</p>
  </section>`;
}

function recettes(territoire: Territoire): string {
  const s = territoire.series ?? {};
  const an = dernier(s.ofgl_recettes_fonctionnement)?.[0];
  if (!an) return "";
  const postes = [
    ["ofgl_impots_et_taxes", "Impôts et taxes"],
    ["ofgl_ventes_de_biens_et_services", "Services et ventes"],
    ["ofgl_concours_de_l_etat", "Concours de l’État"],
  ].filter(([id]) => Number.isFinite(s[id]?.[an]));
  if (!postes.length) return "";
  return `<aside class="ville-recettes"><h3>Trois sources de recettes</h3><p class="ville-unit">En ${an} · sélection de postes, non exhaustive</p>
    <ul>${postes.map(([id, label]) => `<li><span>${label}</span><strong>${esc(court(s[id][an]))}</strong></li>`).join("")}</ul>
    <a href="/sources/">Source : OFGL</a></aside>`;
}

function dette(territoire: Territoire): string {
  const s = territoire.series ?? {};
  const encours = dernier(s.ofgl_encours_dette);
  if (!encours) return "";
  const [an, stock] = encours;
  const emprunt = s.ofgl_emprunts_hors_gad?.[an];
  const remboursement = s.ofgl_remboursements_d_emprunts_hors_gad?.[an];
  const precedent = s.ofgl_encours_dette?.[String(Number(an) - 1)];
  const rapproches = Number.isFinite(emprunt) && Number.isFinite(remboursement) &&
    Number.isFinite(precedent) && Math.abs(stock - precedent - (emprunt - remboursement)) < Math.max(1, stock * .00001);
  return `<section class="ville-panel ville-dette" id="territoire-dette">
    <h2>La dette reste à rembourser</h2>
    <p class="ville-subtitle">Un stock à la fin de l’année, distinct des recettes et dépenses courantes.</p>
    ${graphe("Dette de la ville", "Capital restant dû au 31 décembre", [{ name: "Dette", id: "ofgl_encours_dette", color: "#c52438" }], s)}
    ${rapproches ? `<div class="ville-dette__mouvement"><p><span>Nouveaux emprunts · ${an}</span><strong>+${esc(court(emprunt))}</strong></p><p><span>Capital remboursé · ${an}</span><strong>−${esc(court(remboursement))}</strong></p><p><span>Hausse de la dette · ${an}</span><strong>+${esc(court(stock - precedent))}</strong></p></div>` : ""}
    <p class="ville-source">Les intérêts sont dans les dépenses de fonctionnement ; le capital remboursé est présenté ici. <a href="/sources/">Source : OFGL</a>.</p>
  </section>`;
}

function investissement(territoire: Territoire): string {
  const s = territoire.series ?? {};
  const v = dernier(s.ofgl_depenses_d_investissement_hors_remb);
  if (!v) return "";
  return `<section class="ville-panel ville-investissement" id="territoire-investissement">
    <h2>Les investissements</h2>
    <p class="ville-subtitle">${esc(court(v[1]))} en ${v[0]} pour les dépenses d’investissement hors remboursement de la dette.</p>
    ${graphe("Investissement de la ville", "Dépenses annuelles hors remboursement du capital", [{ name: "Investissement", id: "ofgl_depenses_d_investissement_hors_remb", color: "#2776ac" }], s)}
    <p class="ville-source">L’épargne de fonctionnement est une ressource parmi d’autres ; elle ne mesure pas à elle seule le financement de ces investissements. <a href="/sources/">Source : OFGL</a>.</p>
  </section>`;
}

function analyses(territoire: Territoire, catalogue: Indicateur[]): string {
  // Le fonctionnement, l'épargne et le désendettement sont déjà expliqués au-dessus.
  const excludes = new Set(["taux-epargne", "dette-sur-epargne"]);
  const liste = insightsTerritoire(territoire, catalogue).filter(i => !excludes.has(i.id));
  if (!liste.length) return "";
  const familles = [
    ["fiscalite", "Fiscalité locale"], ["services", "Services publics"],
    ["logement", "Logement"], ["travail", "Travail et habitants"],
    ["generation", "Population"], ["securite", "Sécurité"], ["environnement", "Cadre de vie"],
  ];
  const retenues = familles.map(([id, titre]) => ({ id, titre, cartes: liste.filter(i => i.famille === id) }))
    .filter(f => f.cartes.length).slice(0, 4);
  return `<section class="ville-panel ville-analyses" id="territoire-analyses">
    <h2>Les enjeux derrière les comptes</h2><p class="ville-subtitle">Quatre portes d’entrée pour explorer d’autres données locales.</p>
    <div class="ville-sujets">${retenues.map(({ id, titre, cartes }) => `<details class="ville-sujet"><summary><span>${titre}</span><strong>${esc(cartes[0].titre)}</strong><small>${cartes.length} analyse${cartes.length > 1 ? "s" : ""}</small></summary><div class="ville-sujet__contenu">${cartesAvecSuite(cartes, 4, catalogue, territoire.series)}</div></details>`).join("")}</div>
    <a class="ville-source" href="/sources/">Sources des analyses</a>
  </section>`;
}

export function rendreVillePage(territoire: Territoire, catalogue: Indicateur[]): string {
  const nom = esc(territoire.nom);
  const s = territoire.series ?? {};
  return `<nav class="fiche__chapitres" aria-label="Chapitres des comptes de ${nom}">
      <a href="#territoire-chiffres-cles">Repères</a><a href="#territoire-comptes">Fonctionnement</a>
      <a href="#territoire-dette">Dette</a><a href="#territoire-investissement">Investissement</a>
      <a href="#territoire-comparaison-titre">Comparaisons</a><a href="#territoire-analyses">Analyses</a>
      <a href="#territoire-donnees-completes-titre">Données</a>
    </nav>
    <div class="fiche__ouverture">${cartes(territoire)}</div>
    <div class="fiche__essentiel">
      <section class="ville-panel ville-fonctionnement" id="territoire-comptes">
        <div class="ville-fonctionnement__graphe">
          <h2>Les comptes de fonctionnement</h2>
          <p class="ville-subtitle">Ce que la ville encaisse et dépense chaque année pour ses services courants.</p>
          ${graphe("Recettes et dépenses de fonctionnement", "Comptes exécutés, en millions d’euros", [
            { name: "Recettes", id: "ofgl_recettes_fonctionnement", color: "#2776ac" },
            { name: "Dépenses", id: "ofgl_depenses_fonctionnement", color: "#c52438" },
          ], s)}
          <p class="ville-source"><a href="/sources/">Source : OFGL</a>.</p>
        </div>${recettes(territoire)}
      </section>
      <section class="ville-panel ville-repartition" id="territoire-repartition">
        ${rendrePartsBudgetVille(territoire)}
      </section>
      <div class="ville-duo">${dette(territoire)}${investissement(territoire)}</div>
      <section class="ville-panel territoire-comparaison-section" aria-labelledby="territoire-comparaison-titre">
        <h2 id="territoire-comparaison-titre">${nom} parmi les autres villes</h2>
        <p class="ville-subtitle">Des communes de taille proche, puis la situation de ${nom} en France.</p>
        <div id="fiche-villes-paires"></div>
        <div class="territoire-comparaison-grid"><div class="fiche__situation" id="fiche-situation"></div></div>
      </section>
      ${analyses(territoire, catalogue)}
    </div>`;
}
