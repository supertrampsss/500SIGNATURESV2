/**
 * Suite du récit de l'accueil : après les recettes, les dépenses et l'écart,
 * le lecteur descend vers où part l'argent, sa commune, son salaire, puis Mandats.
 * Rendu pur partagé par le pré-rendu et le navigateur. Le document se lit en
 * entier sans JavaScript ; le contrôleur ajoute les scènes épinglées.
 */
import type { Territoire } from "./donnees.ts";
import { echapper } from "./texte.ts";

type Serie = Record<string, number>;

// OCDE, Taxing Wages 2026, tableau 1.2 : France, données 2025.
// Célibataire sans enfant au salaire moyen, composantes en % du coût employeur.
// Base de lecture fixe : aucun montant personnel n'est extrapolé.
export const PROFIL_TRAVAIL = [
  ['Revenu après prélèvements', 52.8],
  ['Cotisations salariales', 8.3],
  ['Impôt sur le revenu', 12.2],
  ['Cotisations patronales', 26.7],
] as const;

const commun = (series: Serie[]): string | undefined =>
  Object.keys(series[0] ?? {}).filter(y => series.every(s => Number.isFinite(s?.[y]))).sort().at(-1);

/** Dépenses des administrations publiques pour 100 € de recettes, par poste (Eurostat). */
export function distributionDepenses(france: Territoire): { annee: string; total: number; lignes: { nom: string; part: number }[] } | undefined {
  const s = france.series as Record<string, Serie>;
  const postes = [['eurostat_apu_prestations_vieillesse', 'Retraites'], ['eurostat_apu_remunerations', 'Rémunérations des agents publics'], ['eurostat_apu_transferts_nature', 'Soins et services remboursés'], ['eurostat_apu_consommations', 'Achats de biens et services'], ['eurostat_apu_investissement', 'Investissement'], ['eurostat_apu_interets', 'Intérêts de la dette'], ['eurostat_apu_prestations_chomage', 'Chômage'], ['eurostat_apu_prestations_famille', 'Famille et enfants'], ['eurostat_apu_prestations_exclusion', 'RSA et minima sociaux']];
  const annee = commun(['eurostat_apu_recettes', 'eurostat_apu_depenses', 'eurostat_apu_prestations_survivants', ...postes.map(([id]) => id)].map(id => s[id] ?? {}));
  if (!annee || !(s.eurostat_apu_recettes[annee] > 0)) return;
  const recettes = s.eurostat_apu_recettes[annee], total = s.eurostat_apu_depenses[annee] / recettes * 100;
  const lignes = postes.map(([id, nom]) => ({ nom, part: (s[id][annee] + (id === 'eurostat_apu_prestations_vieillesse' ? s.eurostat_apu_prestations_survivants[annee] : 0)) / recettes * 100 }));
  lignes.push({ nom: 'Autres dépenses', part: total - lignes.reduce((a, l) => a + l.part, 0) });
  return { annee, total, lignes };
}

const euros = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (n: number) => `${euros.format(n)} €`;

function repartir(france?: Territoire): string {
  const dist = france && distributionDepenses(france);
  if (!dist) return "";
  const n = Math.ceil(dist.total);
  const bornes: [number, number][] = [];
  let cumul = 0;
  for (const ligne of dist.lignes) { bornes.push([cumul, cumul + ligne.part]); cumul += ligne.part; }
  const cases = Array.from({ length: n }, (_, i) => {
    const poste = Math.max(0, bornes.findIndex(([a, b]) => i + 0.5 >= a && i + 0.5 < b));
    const reste = Math.min(1, dist.total - i);
    return `<span class="recit-case" data-poste="${poste === -1 ? dist.lignes.length - 1 : poste}" style="--part:${reste.toFixed(3)}"></span>`;
  }).join("");
  const premier = dist.lignes[0];
  return `<section class="recit-chap recit-repartir" id="recit-repartir" data-scene="repartir" data-etapes="${dist.lignes.length}" style="--etapes:${dist.lignes.length}" aria-labelledby="recit-repartir-titre">
    <div class="recit-scene">
      <div class="recit-chap-copy">
        <p class="recit-kicker">04 · Où partent-ils · Eurostat ${echapper(dist.annee)}</p>
        <h2 class="recit-chap-titre" id="recit-repartir-titre">Pour 100&nbsp;€ de recettes, <em>${eur(dist.total)}</em> dépensés.</h2>
        <p class="recit-focus" aria-hidden="true"><strong data-focus-valeur>${eur(premier.part)}</strong><span data-focus-nom>${echapper(premier.nom)}</span></p>
        <ol class="recit-postes">${dist.lignes.map((l, i) => `<li data-poste="${i}"><span>${echapper(l.nom)}</span><b>${eur(l.part)}</b></li>`).join("")}</ol>
        <p class="recit-chap-note">Répartition publiée pour ${echapper(dist.annee)}, dernière année complète chez Eurostat. Une case = 1&nbsp;€.</p>
        <a class="recit-lien" href="/bilan/#france-sorties">Lire les comptes de la France</a>
      </div>
      <div class="recit-cases" role="img" aria-label="${n} cases, une par euro dépensé pour 100 euros de recettes en ${echapper(dist.annee)}, regroupées par poste">${cases}</div>
    </div>
  </section>`;
}

const VILLES: [string, number, number][] = [["Paris", 50, 23], ["Lille", 53, 12], ["Strasbourg", 78, 25], ["Rennes", 26, 35], ["Nantes", 26, 48], ["Bordeaux", 28, 65], ["Toulouse", 41, 78], ["Montpellier", 56, 77], ["Marseille", 67, 78], ["Lyon", 62, 52], ["Nice", 78, 68], ["Clermont-Ferrand", 50, 55]];

function ville(): string {
  return `<section class="recit-chap recit-ville" id="recit-ville" aria-labelledby="recit-ville-titre">
    <div class="recit-scene">
      <div class="recit-chap-copy">
        <p class="recit-kicker">05 · Votre ville</p>
        <h2 class="recit-chap-titre" id="recit-ville-titre">Et dans <em>votre</em> commune&nbsp;?</h2>
        <p class="recit-chap-texte">Les mêmes questions, à l’échelle d’une mairie : ce qui entre, ce qui sort, la dette, la population. Chaque commune se lit de la même façon.</p>
        <a class="recit-button recit-button--ville" href="/territoire/">Chercher ma commune</a>
      </div>
      <figure class="recit-carte" aria-hidden="true"><img src="/mandats/art/national-relief-768.webp" alt="" width="768" height="512" loading="lazy">${VILLES.map(([nom, x, y], i) => `<span class="recit-lumiere" style="left:${x}%;top:${y}%;--d:${(i * 0.37).toFixed(2)}s"><span>${nom}</span></span>`).join("")}</figure>
    </div>
  </section>`;
}

function salaire(): string {
  const [reste, salariales, impot, patronales] = PROFIL_TRAVAIL.map(([, part]) => part);
  const etapes: [number, string][] = [
    [100, "payés par l’employeur, le coût du travail"],
    [100 - patronales, `de salaire brut, après ${eur(patronales)} de cotisations patronales`],
    [100 - patronales - salariales, `nets avant impôt, après ${eur(salariales)} de cotisations salariales`],
    [reste, `pour vous, après ${eur(impot)} d’impôt sur le revenu`],
  ];
  return `<section class="recit-chap recit-salaire" id="recit-salaire" data-scene="salaire" data-etapes="4" style="--etapes:4" aria-labelledby="recit-salaire-titre">
    <div class="recit-scene">
      <div class="recit-chap-copy">
        <p class="recit-kicker">06 · Votre salaire · OCDE 2025</p>
        <h2 class="recit-chap-titre" id="recit-salaire-titre">Sur 100&nbsp;€ payés par l’employeur, <em>${eur(reste)}</em> pour vous.</h2>
        <ol class="recit-paie-etapes">${etapes.map(([valeur, texte], i) => `<li data-etape="${i}"><b>${eur(valeur)}</b><span>${texte}</span></li>`).join("")}</ol>
        <p class="recit-chap-note">Célibataire sans enfant au salaire moyen, 2025. Les ${eur(100 - reste)} restants rejoignent les recettes publiques du début du récit.</p>
        <a class="recit-lien" href="/salaires/">Comprendre sa fiche de paie</a>
      </div>
      <div class="recit-paie" aria-hidden="true">
        <strong class="recit-paie-chiffre" data-paie-valeur>${eur(reste)}</strong>
        <div class="recit-paie-barre"><i class="recit-seg recit-seg--reste" style="flex-basis:${reste}%"></i><i class="recit-seg recit-seg--impot" data-part="3" style="flex-basis:${impot}%"></i><i class="recit-seg recit-seg--salariales" data-part="2" style="flex-basis:${salariales}%"></i><i class="recit-seg recit-seg--patronales" data-part="1" style="flex-basis:${patronales}%"></i></div>
        <p class="recit-paie-legende"><span><i class="recit-seg--reste"></i>Pour vous</span><span><i class="recit-seg--impot"></i>Impôt</span><span><i class="recit-seg--salariales"></i>Cotisations salariales</span><span><i class="recit-seg--patronales"></i>Cotisations patronales</span></p>
      </div>
    </div>
  </section>`;
}

/** Les trois chapitres qui suivent les recettes, les dépenses et l'écart. */
export function renduChapitresRecit(france?: Territoire): string {
  return repartir(france) + ville() + salaire();
}

export const VALEURS_PAIE = (() => {
  const [reste, salariales, , patronales] = PROFIL_TRAVAIL.map(([, part]) => part);
  return [100, 100 - patronales, 100 - patronales - salariales, reste];
})();
