/**
 * D'où vient l'argent de l'État, avec son évolution.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNE ÉVOLUTION DONNE SES DEUX BOUTS
 * ─────────────────────────────────────────────────────────────────────────
 * La maquette écrivait « +30 % depuis 2017 » sans le montant de 2017, et le
 * lecteur l'a refusée : une variation sans ses deux bouts ne se vérifie pas.
 * Le tableau porte donc TROIS colonnes — le montant de l'exercice de
 * référence, celui du dernier exercice, la variation — et la variation est
 * calculée sur les deux montants affichés, jamais ailleurs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA TVA, ET LE FAUX EFFONDREMENT
 * ─────────────────────────────────────────────────────────────────────────
 * La TVA de l'État passe de 152 à 98 milliards : −35,7 %. Ce n'est pas une
 * baisse d'impôt — une part croissante de la TVA est reversée chaque année à
 * la Sécurité sociale et aux collectivités, et seule la part gardée par
 * l'État est comptée ici. Laisser la variation nue aurait fait lire un
 * effondrement qui n'existe pas. La note vivait sous le libellé, en phrase
 * complète, et poussait chaque ligne notée sur deux lignes de tableau ; elle
 * tient maintenant dans la colonne Variation elle-même, à la place du
 * pourcentage qu'elle remplace — quelques mots, jamais le mécanisme entier.
 * C'est le piège symétrique de celui de l'ouverture (un ratio qui baisse
 * pendant que le montant monte) : ici un montant qui baisse pendant que la
 * taxe, elle, ne baisse pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES GROS MONTANTS S'ÉCRIVENT GROS
 * ─────────────────────────────────────────────────────────────────────────
 * La hiérarchie typographique suit le montant : la TVA à 98 milliards s'écrit
 * plus grande que les recettes sans impôt à 24. C'est la demande explicite du
 * lecteur, et c'est le registre du tableau typographié — la taille porte la
 * magnitude sans qu'une barre s'en mêle.
 *
 * « Autres impôts et taxes » vivait comme une soustraction opaque, et c'était
 * en plus la plus grosse ligne du tableau — un residu sans nom au corps le
 * plus gros. La TICPE (taxe sur les produits énergétiques, part de l'État)
 * est publiée par la source comme sa propre ligne ; elle en sort et prend son
 * nom. « Autres recettes fiscales » reste une soustraction — recettes
 * fiscales moins TVA, impôt sur le revenu, impôt sur les sociétés et TICPE —
 * et reste sans détail : la source elle-même ne publie pas plus fin que
 * cette ligne-là.
 *
 * Le total, lui, est la série publiée des recettes nettes — jamais la somme
 * des lignes, qui laisserait un écart d'arrondi passer pour un compte rond.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { variation } from "./ouverture.ts";

const REFERENCE = "2017";

const TVA = "etat_tva";
const IMPOT_REVENU = "etat_impot_revenu";
const IMPOT_SOCIETES = "etat_impot_societes";
const TICPE = "etat_ticpe";
const FISCALES = "etat_recettes_fiscales";
const NON_FISCALES = "etat_recettes_non_fiscales";
const NETTES = "etat_recettes_nettes_bg";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const MILLIARDS = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Un montant en milliards, signé + : une recette entre. */
function plus(valeur: number): string {
  return `+${MILLIARDS.format(valeur / 1e9)}`;
}

type Ligne = {
  libelle: string;
  avant: number;
  apres: number;
  /** La note qui remplace la variation quand elle serait un mensonge de
   *  périmètre : la TVA partagée n'a pas de variation lisible. */
  note?: string;
};

/** Les lignes du tableau, ou null tant que les séries ne couvrent pas les
 *  deux exercices. */
export function lignes(
  france: Territoire | undefined,
): { debut: string; fin: string; lignes: Ligne[]; total: Ligne } | null {
  if (!france) return null;
  const serie = (id: string) => france.series[id] ?? {};
  const nettes = serie(NETTES);
  const exercices = Object.keys(nettes)
    .filter((an) => [TVA, IMPOT_REVENU, IMPOT_SOCIETES, TICPE, FISCALES, NON_FISCALES].every(
      (id) => serie(id)[an] !== undefined,
    ))
    .sort();
  if (exercices.length < 2) return null;
  const fin = exercices[exercices.length - 1];
  const debut = exercices.includes(REFERENCE) && REFERENCE !== fin ? REFERENCE : exercices[0];

  const paire = (id: string): [number, number] => [serie(id)[debut], serie(id)[fin]];
  const [tvaA, tvaB] = paire(TVA);
  const [irA, irB] = paire(IMPOT_REVENU);
  const [isA, isB] = paire(IMPOT_SOCIETES);
  const [ticpeA, ticpeB] = paire(TICPE);
  const [fiscA, fiscB] = paire(FISCALES);
  const [nfA, nfB] = paire(NON_FISCALES);

  const brutes: Ligne[] = [
    {
      libelle: "Taxe sur la valeur ajoutée",
      avant: tvaA,
      apres: tvaB,
      // La note complète (« une part croissante est reversée à la Sécurité
      // sociale et aux collectivités ; seule la part gardée par l'État est
      // comptée ici ») tient dans le titre du tableau au complet, pas dans une
      // cellule de la colonne Variation — elle y devient une phrase courte,
      // sur une seule ligne, quitte à perdre le détail du mécanisme.
      note: "une part croissante est reversée",
    },
    { libelle: "Impôt sur le revenu", avant: irA, apres: irB },
    {
      // Nommée : c'est la taxe sur les carburants et les énergies, part de
      // l'État. Elle vivait fondue dans le reste, sans nom, alors que la
      // source la publie comme sa propre ligne.
      libelle: "Taxe sur les produits énergétiques (TICPE)",
      avant: ticpeA,
      apres: ticpeB,
    },
    {
      libelle: "Autres recettes fiscales",
      avant: fiscA - tvaA - irA - isA - ticpeA,
      apres: fiscB - tvaB - irB - isB - ticpeB,
      // Ce qui reste après avoir nommé les quatre impôts qui pèsent le plus :
      // droits de succession et de mutation, taxe sur les salaires, droits de
      // douane, et une vingtaine d'autres lignes plus petites que la
      // situation mensuelle budgétaire ne détaille pas au-delà de son propre
      // « Autres recettes fiscales ». Ce reste a plus que triplé depuis 2017 ;
      // le site ne publie pas la décomposition qui expliquerait pourquoi, et
      // ne l'invente pas non plus : la variation prend une note plutôt qu'un
      // pourcentage qu'aucune ligne ne viendrait justifier.
      note: "composition en évolution",
    },
    { libelle: "Impôt sur les sociétés", avant: isA, apres: isB },
    { libelle: "Recettes sans impôt (dividendes, amendes)", avant: nfA, apres: nfB },
  ];
  // Du plus gros au plus petit sur le dernier exercice : la hiérarchie
  // typographique suit ce tri, et un tableau trié se lit sans chercher.
  brutes.sort((a, b) => b.apres - a.apres);
  return {
    debut,
    fin,
    lignes: brutes,
    total: { libelle: "Total encaissé par l'État", avant: nettes[debut], apres: nettes[fin] },
  };
}

/** Le bloc, ou la chaîne vide. */
export function rendu(
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): string {
  const publies = new Set(catalogue.map((i) => i.id));
  if (![TVA, IMPOT_REVENU, IMPOT_SOCIETES, TICPE, FISCALES, NON_FISCALES, NETTES].every((id) =>
    publies.has(id),
  ))
    return "";
  const donnees = lignes(pays["FR"]);
  if (!donnees) return "";
  const { debut, fin, total } = donnees;

  // Les prix sur la même fenêtre, pour dire si les recettes ont bougé en
  // vrai. La phrase se tait sans l'indice plutôt que de comparer du courant.
  const prix = pays["FR"]?.series["eurostat_prix_ensemble"] ?? {};
  const inflation =
    prix[debut] !== undefined && prix[fin] !== undefined
      ? variation(prix[debut], prix[fin])
      : null;

  // La taille suit le rang : le plus gros montant au plus gros corps. Cinq
  // rangs, cinq crans, écrits en classe et non en style — la feuille garde la
  // main sur l'échelle.
  // La note vivait sous le libellé, en dessous de la ligne : elle poussait la
  // valeur sur une ligne de plus et se lisait comme un texte à part, jamais
  // rattaché au chiffre qu'elle explique. Elle tient maintenant dans la
  // colonne Variation elle-même, à la place du pourcentage qu'elle remplace —
  // une ligne, jusqu'au bout.
  const rangees = donnees.lignes
    .map(
      (l, rang) => `<tr class="recettes__rang recettes__rang--${rang}">
        <th scope="row">${echapper(l.libelle)}</th>
        <td class="flux--plus">${plus(l.avant)}</td>
        <td class="flux--plus">${plus(l.apres)}</td>
        <td>${
          l.note
            ? `<span class="recettes__note">${echapper(l.note)}</span>`
            : echapper(variation(l.avant, l.apres))
        }</td>
      </tr>`,
    )
    .join("");

  // L'affirmation à gauche, la preuve à droite, comme la maquette validée.
  // Pas de titre de bloc : la question du chapitre, juste au-dessus, le porte
  // déjà — « D'où vient l'argent de l'État ? » suivi d'un second titre disait
  // deux fois la même chose.
  return `
    <div class="chapitre__duo">
      <div>
        <p class="bloc__complement">Depuis ${echapper(debut)}, les recettes de l'État ont augmenté
          de <strong>${echapper(variation(total.avant, total.apres))}</strong>${
            inflation
              ? ` pendant que les prix montaient de <strong>${echapper(
                  inflation.replace("+", ""),
                )}</strong> : une fois l'inflation retirée, elles n'ont presque pas bougé`
              : ""
          }.</p>
        <p class="bloc__complement">La TVA semble s'effondrer dans ce tableau&nbsp;: elle n'a
          pas baissé. Ce que la taxe rapporte continue d'augmenter, mais une part croissante
          en est <strong>reversée chaque année à la Sécurité sociale et aux
          collectivités</strong> — pour compenser des cotisations et des impôts locaux
          supprimés — et le tableau ne compte que la part que l'État garde pour lui. C'est
          cette part-là qui diminue.</p>
      </div>
      <div>
        <table class="comparaison recettes" tabindex="0">
          <thead><tr><th scope="col">Recettes</th><th scope="col">${echapper(debut)}</th>
            <th scope="col">${echapper(fin)}</th><th scope="col">Variation</th></tr></thead>
          <tbody>${rangees}</tbody>
          <tfoot><tr><th scope="row">${echapper(total.libelle)}</th>
            <td class="flux--plus">${plus(total.avant)}</td>
            <td class="flux--plus">${plus(total.apres)}</td>
            <td>${echapper(variation(total.avant, total.apres))}</td></tr></tfoot>
        </table>
        <p class="bloc__complement">Milliards d'euros, exercices réellement exécutés.
          Source : situation mensuelle budgétaire de l'État.</p>
      </div>
    </div>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherRecettesEtat(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (html) cadre.innerHTML = html;
  // Qui remplit un cadre le déplie : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien d'autre ne le rouvrirait.
  if (html) cadre.hidden = false;
  return html !== "";
}
