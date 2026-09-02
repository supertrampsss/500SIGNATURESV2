/**
 * La France et ses voisins : la seule comparaison que tout le monde convoque.
 *
 * « La France dépense plus que les autres » ouvre à peu près tous les débats
 * budgétaires. Le site publiait déjà les séries qui répondent — Eurostat les
 * donne pour trente-quatre pays, sur la même définition, le même exercice et
 * la même unité — et aucune page ne les montrait. C'est le manque le moins
 * coûteux à combler du site : rien à ingérer, un bloc à écrire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'UNE COMPARAISON EXIGE, ET QUE CELLE-CI TIENT
 * ─────────────────────────────────────────────────────────────────────────
 * **Une même définition.** Les quatre ratios viennent du même producteur, dans
 * la même nomenclature européenne. Comparer nos « prélèvements obligatoires »
 * au sens français avec le « tax burden » d'un institut étranger n'aurait
 * aucun sens ; ici, les trente-quatre valeurs sortent d'un seul tableau.
 *
 * **Un même exercice.** Un pays qui n'a pas publié l'exercice retenu ne figure
 * pas dans la ligne, plutôt que d'y figurer avec l'année précédente. C'est ce
 * qui fait que le nombre de pays comparés est écrit, et qu'il varie d'un ratio
 * à l'autre.
 *
 * **Un rang qui se vérifie.** « La France est première » ne veut rien dire
 * sans dire première sur combien, ni parmi qui. Le rang est donc toujours
 * donné avec son effectif — « 1ʳᵉ sur 34 » — et l'effectif est compté sur les
 * pays réellement publiés, pas sur l'Union.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE BLOC REFUSE DE DIRE
 * ─────────────────────────────────────────────────────────────────────────
 * Il ne dit pas si dépenser plus est bien ou mal. Un ratio élevé peut recouvrir
 * un État qui verse les retraites que d'autres laissent à des fonds privés :
 * la dépense publique change de périmètre selon ce que le pays a choisi de
 * mettre en commun, et le ratio ne le voit pas. Cette limite est écrite sous
 * le tableau, parce qu'elle est la première objection qu'un lecteur informé
 * fera — et qu'elle est juste.
 *
 * Il ne classe pas non plus les pays du meilleur au pire : la table est
 * ordonnée sur la dépense, du plus haut au plus bas, et l'ordre est une
 * mesure, pas un palmarès.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUELS PAYS
 * ─────────────────────────────────────────────────────────────────────────
 * L'Union à vingt-sept et la zone euro comme repères collectifs, puis la
 * France et les cinq voisins retenus. Un pays absent de la table reste dans le
 * calcul du rang : la table est une sélection lisible, le rang porte sur tous.
 *
 * **L'Irlande en est absente, et pas parce que son chiffre dérange.** Son PIB
 * est gonflé par les bénéfices que des multinationales y domicilient sans y
 * produire : le dénominateur ne mesure pas la même chose que chez les autres,
 * et l'institut irlandais publie lui-même un agrégat corrigé pour cette raison.
 * Une ligne « 22,4 % » au bas du tableau se serait lue comme un État minuscule,
 * ce qu'elle ne dit pas. Elle reste comptée dans le rang, qui porte sur tous
 * les pays publiés — le retrait est une décision d'affichage, pas de calcul.
 */

import type { Territoire } from "./donnees.ts";
import { pointsComparatifs, tableauAccessible } from "./dataviz.ts";
import { pourcentage } from "./echelle.ts";
import { estAgregat, nomPays } from "./pays-noms.ts";
import { lienSource, sourceIdPourIndicateur, type IndexSources } from "./registre-sources.ts";

const DEPENSE = "eurostat_depenses_publiques_pib";
const PRELEVEMENTS = "eurostat_prelevements_obligatoires_pib";
const DETTE = "eurostat_dette_pib";
const DEFICIT = "eurostat_deficit_pib";

/** L'Union à vingt-sept : le repère collectif de la phrase d'ouverture. */
const UNION = "EU27_2020";

/** Les pays de la table. L'ordre écrit ici ne sert qu'à choisir QUI figure :
 *  le rendu trie ensuite sur la dépense. Un code absent des données saute. */
const TABLE = [
  UNION,
  "EA20",
  "FR",
  "DE",
  "BE",
  "LU",
  "ES",
  "IT",
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un pourcentage du PIB, ou rien du tout.
 *
 *  `pourcentage()` du site fait le reste : une décimale fixe, le moins
 *  typographique, et surtout l'espace FINE INSÉCABLE avant le signe. Une
 *  version maison écrite ici mettait une espace ordinaire, et « 115,6 % »
 *  cassait en deux lignes dans la colonne étroite d'un téléphone. */
function pourcent(valeur: number | null): string {
  return valeur === null ? "" : pourcentage(valeur, true);
}

/**
 * Le dernier exercice qu'un ratio publie pour la France.
 *
 * C'est la France qui commande l'exercice, et non le pays le plus tardif :
 * attendre le dernier publiant ferait reculer la page entière d'un an pour un
 * pays qu'elle ne montre peut-être même pas.
 */
function exerciceDe(france: Territoire, cle: string): string | null {
  const serie = france.series[cle];
  if (!serie) return null;
  const annees = Object.keys(serie).sort();
  return annees[annees.length - 1] ?? null;
}

/** La valeur d'un pays sur un exercice donné, ou `null` s'il ne le publie
 *  pas. Jamais l'exercice précédent : une ligne de tableau doit porter une
 *  seule année. */
function valeur(territoire: Territoire, cle: string, exercice: string): number | null {
  const v = territoire.series[cle]?.[exercice];
  return v === undefined ? null : v;
}

/** Le rang de la France parmi les pays qui publient ce ratio cet exercice-là,
 *  du plus élevé au plus bas, et l'effectif sur lequel il porte. Les agrégats
 *  sont écartés : on ne classe pas un pays devant une moyenne. */
function rang(
  pays: Record<string, Territoire>,
  cle: string,
  exercice: string,
): { place: number; sur: number } | null {
  const valeurs: { code: string; v: number }[] = [];
  for (const [code, territoire] of Object.entries(pays)) {
    if (estAgregat(code)) continue;
    const v = valeur(territoire, cle, exercice);
    if (v !== null) valeurs.push({ code, v });
  }
  if (valeurs.length < 2) return null;
  valeurs.sort((a, b) => b.v - a.v);
  const place = valeurs.findIndex((e) => e.code === "FR") + 1;
  return place ? { place, sur: valeurs.length } : null;
}

/**
 * Un rang, dit par ce qu'il y a AU-DESSUS plutôt que par un ordinal.
 *
 * « La France est 2ᵉ sur 10 » oblige le lecteur à retourner le classement pour
 * comprendre ce que ça veut dire, et l'ordinal traîne un balisage `<sup>` qui
 * se lit « 2 e » dès qu'on retire les balises. « Un seul des dix pays publiés
 * en dépense davantage » dit la même chose et se lit une fois.
 *
 * L'effectif est toujours écrit : un rang sans son dénominateur ne se vérifie
 * pas, et c'est la règle que ce bloc existe pour tenir.
 */
function combienDevant(place: number, sur: number, verbe: string): string {
  if (place === 1) return `aucun des ${sur} pays publiés n'en ${verbe} davantage`;
  if (place === 2) return `un seul des ${sur} pays publiés en ${verbe} davantage`;
  return `${place - 1} des ${sur} pays publiés en ${verbe}nt davantage`;
}

type Colonne = { cle: string; entete: string; exercice: string };

function sourcesEurope(indexSources?: IndexSources): string {
  const id = indexSources
    ? [DEPENSE, PRELEVEMENTS, DETTE, DEFICIT]
      .map((indicateur) => sourceIdPourIndicateur(indexSources, indicateur))
      .find((source): source is string => Boolean(source))
    : undefined;
  if (!id) return `<a href="/sources/">Sources et méthode</a>.`;
  return `Source : <a href="${lienSource(id)}">Eurostat</a>.`;
}

/**
 * Le bloc, ou la chaîne vide tant que la dépense et les prélèvements ne sont
 * pas publiés pour la France.
 *
 * Ces deux-là sont exigés parce qu'ils portent la question ; la dette et le
 * déficit sont un bonus, et leur absence retire une colonne sans effacer le
 * bloc.
 */
export function rendu(pays: Record<string, Territoire>, indexSources?: IndexSources): string {
  const france = pays["FR"];
  if (!france) return "";

  const candidates: [string, string][] = [
    [DEPENSE, "Dépense publique"],
    [PRELEVEMENTS, "Prélèvements obligatoires"],
    [DETTE, "Dette"],
    [DEFICIT, "Déficit ou excédent"],
  ];
  const colonnes: Colonne[] = [];
  for (const [cle, entete] of candidates) {
    const exercice = exerciceDe(france, cle);
    if (exercice) colonnes.push({ cle, entete, exercice });
  }
  if (!colonnes.some((c) => c.cle === DEPENSE) || !colonnes.some((c) => c.cle === PRELEVEMENTS)) {
    return "";
  }

  // Les lignes de la table, ordonnées sur la dépense publique : l'ordre écrit
  // dans TABLE plaçait l'Union en tête par convention, mais un tableau de
  // ratios se lit trié. L'Union et la France restent dedans, à leur place
  // réelle.
  const colonneDepense = colonnes.find((c) => c.cle === DEPENSE)!;
  const lignes = TABLE.map((code) => {
    const territoire = pays[code];
    if (!territoire) return null;
    const cellules = colonnes.map((c) => valeur(territoire, c.cle, c.exercice));
    if (cellules.every((v) => v === null)) return null;
    return {
      code,
      // JAMAIS `territoire.nom` : la publication écrit `name = code` pour la
      // maille pays (`normalize/europe.py`), si bien qu'un tableau bâti dessus
      // afficherait « DE » et « EU27_2020 ». Les noms français vivent dans
      // `pays-noms.ts`, du côté de l'affichage, parce que la source n'en
      // publie aucun.
      nom: nomPays(code),
      cellules,
      tri: valeur(territoire, colonneDepense.cle, colonneDepense.exercice) ?? -Infinity,
    };
  })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => b.tri - a.tri);
  if (lignes.length < 3) return "";

  const rangees = lignes
    .map(
      (ligne) => `<tr${ligne.code === "FR" ? ' class="europe__france"' : ""}>
        <th scope="row">${echapper(ligne.nom)}</th>
        ${ligne.cellules.map((v) => `<td>${pourcent(v)}</td>`).join("")}
      </tr>`,
    )
    .join("");

  const entetes = colonnes
    .map((c) => `<th scope="col">${echapper(c.entete)}<br /><span class="europe__millesime">${
      echapper(c.exercice)
    }</span></th>`)
    .join("");
  const tableau = `<table class="comparaison europe" tabindex="0">
    <thead><tr><th scope="col">Pays</th>${entetes}</tr></thead>
    <tbody>${rangees}</tbody>
  </table>`;

  // La phrase d'ouverture : le rang de la France sur les deux ratios qui
  // portent la question, jamais sur les quatre — quatre rangs d'affilée se
  // lisent comme un bulletin de notes.
  const rangDepense = rang(pays, colonneDepense.cle, colonneDepense.exercice);
  const colonnePrelevements = colonnes.find((c) => c.cle === PRELEVEMENTS)!;
  const rangPrelevements = rang(pays, colonnePrelevements.cle, colonnePrelevements.exercice);
  const depenseFr = valeur(france, colonneDepense.cle, colonneDepense.exercice);
  const prelevementsFr = valeur(france, colonnePrelevements.cle, colonnePrelevements.exercice);
  const union = pays[UNION];
  const depenseUnion = union ? valeur(union, colonneDepense.cle, colonneDepense.exercice) : null;

  const phrase =
    depenseFr === null || prelevementsFr === null || !rangDepense || !rangPrelevements
      ? ""
      : `<p class="bloc__complement">En ${echapper(colonneDepense.exercice)}, la dépense
          publique française vaut <strong>${pourcent(depenseFr)} du PIB</strong>${
            depenseUnion === null
              ? ""
              : `, contre <strong>${pourcent(depenseUnion)}</strong> pour l'${echapper(nomPays(UNION))}`
          } : ${combienDevant(rangDepense.place, rangDepense.sur, "dépense")}. Les
          prélèvements obligatoires suivent, à <strong>${pourcent(prelevementsFr)}</strong> :
          ${combienDevant(rangPrelevements.place, rangPrelevements.sur, "prélève")}.</p>`;
  const indexDepense = colonnes.findIndex((c) => c.cle === DEPENSE);
  const indexPrelevements = colonnes.findIndex((c) => c.cle === PRELEVEMENTS);
  const formater = (nombre: number) => `${nombre.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  const pointsDepense = lignes.flatMap((ligne) => {
    const valeur = ligne.cellules[indexDepense];
    return valeur === null ? [] : [{ libelle: ligne.nom, valeur, accent: ligne.code === "FR" }];
  });
  const pointsPrelevements = lignes.flatMap((ligne) => {
    const valeur = ligne.cellules[indexPrelevements];
    return valeur === null ? [] : [{ libelle: ligne.nom, valeur, accent: ligne.code === "FR" }];
  });
  const graphique = `<div class="dataviz__comparaisons">
    ${pointsComparatifs({
      titre: "Dépense publique",
      description: "Dépense publique en pourcentage du PIB, du plus élevé au plus faible.",
      points: pointsDepense,
      formater,
    })}
    ${pointsComparatifs({
      titre: "Prélèvements obligatoires",
      description: "Prélèvements obligatoires en pourcentage du PIB, du plus élevé au plus faible.",
      points: pointsPrelevements,
      formater,
    })}
  </div>`;

  return `
    <h3 class="sous-titre">La France et ses voisins</h3>
    ${phrase}
    ${graphique}
    ${tableauAccessible("Voir les chiffres", tableau)}
    <p class="bloc__complement">${sourcesEurope(indexSources)}</p>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherEurope(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
  indexSources?: IndexSources,
): boolean {
  const html = rendu(pays, indexSources);
  if (html) {
    cadre.innerHTML = html;
    cadre.hidden = false;
  }
  return html !== "";
}
