/** Une année de fonctionnement, puis le remboursement du capital : même périmètre OFGL. */
import type { Territoire } from "./donnees.ts";

const nombre = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function rendrePartsBudgetVille(territoire: Territoire): string {
  const s = territoire.series ?? {};
  const recettes = s.ofgl_recettes_fonctionnement ?? {};
  const depenses = s.ofgl_depenses_fonctionnement ?? {};
  const brute = s.ofgl_epargne_brute ?? {};
  const capital = s.ofgl_remboursements_d_emprunts_hors_gad ?? {};
  const nette = s.ofgl_epargne_nette ?? {};
  const exercice = Object.keys(recettes).filter((an) =>
    Number.isFinite(recettes[an]) && recettes[an] > 0 &&
    Number.isFinite(depenses[an]) && Number.isFinite(brute[an]) &&
    Math.abs(recettes[an] - depenses[an] - brute[an]) < Math.max(1, recettes[an] * .00001),
  ).sort().at(-1);
  if (!exercice) return "";
  const r = recettes[exercice];
  const d = depenses[exercice];
  const b = brute[exercice];
  const remboursement = capital[exercice];
  const net = nette[exercice];
  const complet = d >= 0 && b >= 0 && remboursement >= 0 && net >= 0 &&
    Number.isFinite(remboursement) && Number.isFinite(net) &&
    Math.abs(b - remboursement - net) < Math.max(1, r * .00001);
  const parties = complet
    ? [
        { nom: "Fonctionnement", montant: d, classe: "depenses" },
        { nom: "Capital de la dette remboursé", montant: remboursement, classe: "capital" },
        { nom: "Épargne nette", montant: net, classe: "epargne" },
      ]
    : d >= 0 && b >= 0
      ? [
          { nom: "Fonctionnement", montant: d, classe: "depenses" },
          { nom: "Épargne brute avant remboursement", montant: b, classe: "epargne" },
        ]
      : [];
  if (!parties.length) return `<p class="parts-budget__limite">En ${exercice}, les dépenses de fonctionnement dépassent les recettes. Source : <a href="/sources/">OFGL</a>.</p>`;
  return `<figure class="parts-budget" aria-label="Répartition de 100 euros de recettes de fonctionnement en ${exercice}">
    <figcaption><span>Fonctionnement · ${exercice}</span><strong>Sur 100 € encaissés par la ville</strong></figcaption>
    <div class="parts-budget__barre" role="img" aria-label="${parties.map(p => `${nombre.format(p.montant / r * 100)} euros : ${p.nom.toLowerCase()}`).join(' ; ')}">
      ${parties.map(p => `<span class="parts-budget__${p.classe}" style="flex:${(p.montant / r).toFixed(8)}"></span>`).join("")}
    </div>
    <ul class="parts-budget__legende">${parties.map(p => `<li><i class="parts-budget__${p.classe}" aria-hidden="true"></i><strong>${nombre.format(p.montant / r * 100)} €</strong><span>${p.nom}</span></li>`).join("")}</ul>
    <p class="parts-budget__source">${complet ? "L’épargne nette reste après le fonctionnement et le remboursement du capital ; elle peut contribuer aux investissements. Les nouveaux emprunts sont présentés avec la dette." : "L’épargne brute est calculée avant le remboursement du capital de la dette et avant les investissements."} <a href="/sources/">Source : OFGL</a>.</p>
  </figure>`;
}
