/**
 * La note de gestion, à l'écran.
 *
 * `note.ts` calcule, ce module peint, et rien d'autre. La séparation n'est pas
 * de la coquetterie : la note sera contestée commune par commune, et un barème
 * qu'on peut lire sans ouvrir un navigateur est un barème qu'on peut discuter.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE BLOC MONTRE, ET POURQUOI DANS CET ORDRE
 * ─────────────────────────────────────────────────────────────────────────
 * La note d'abord, parce que c'est la question posée — « est-ce que ma commune
 * est bien gérée ». Puis les trois termes, chacun avec **la mesure qui le
 * produit** à côté des points qu'il vaut : « 13,4 % de marge → 4,3 sur 8 ». Une
 * note sans ses mesures est un verdict ; avec elles, c'est un calcul que le
 * lecteur refait.
 *
 * Enfin ce que la note ne regarde pas. Ce n'est pas une réserve qui s'excuse —
 * la règle du dépôt les refuse — mais un fait de méthode qui change la lecture
 * du chiffre : une commune notée 8/20 n'est pas une commune qui dépense mal,
 * c'est une commune dont la marge et la dette sont tendues. Sans cette ligne,
 * le lecteur lit une note de politique municipale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES DÉCIMALES
 * ─────────────────────────────────────────────────────────────────────────
 * Les trois termes se lisent de haut en bas : ils forment une colonne, et la
 * règle de la colonne s'applique — la décimale ne tombe pas sur un compte rond.
 * « 8 » entre « 4,3 » et « 3,1 » casse l'alignement de la seule colonne que le
 * lecteur additionne pour vérifier le total.
 */

import { pourcentage } from "./echelle.ts";
import {
  SOLVABILITE_POINTS,
  bornes,
  exercicesNotables,
  mention,
  solvabilite,
  type Note,
} from "./note.ts";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un nombre de points, toujours avec sa décimale — c'est une colonne. */
function points(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Une décimale, et l'accord du nom qui suit.
 *
 *  En français, le pluriel commence à 2 : « 1,5 année », « 0,7 point ». Le
 *  bloc écrivait « −0,7 points de marge », qui se lit comme une faute de
 *  frappe et fait douter du reste.
 *
 *  L'espace entre le nombre et son nom est **insécable**, comme partout où ce
 *  site pose une unité (`montantLisible`). Elle est écrite `\u00a0` et non
 *  tapée au clavier : une insécable tapée à la main est invisible à la
 *  relecture, et neuf vérifications de ce dépôt sont passées pour vertes à
 *  cause d'une espace qu'on croyait ordinaire. */
function nombreEtNom(valeur: number, singulier: string): string {
  const nombre = Math.abs(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${nombre}\u00a0${singulier}${Math.abs(valeur) >= 2 ? "s" : ""}`;
}

/**
 * Les trois lignes du détail : le terme, la mesure qui le produit, ses points.
 *
 * La mesure est celle de la série publiée, pas une reformulation : le taux
 * d'épargne en pourcentage des recettes, la dette en années d'épargne, la
 * trajectoire en points de taux depuis 2019. **Un taux varie en points** — la
 * trajectoire est un écart entre deux pourcentages, l'écrire « +14 % » serait
 * faux de la façon exacte que le dépôt refuse partout ailleurs.
 */
export function lignes(note: Note): { terme: string; mesure: string; points: string; sur: number }[] {
  const { mesures, detail } = note;
  // Le barème de l'échelon qui a produit la note, jamais un autre : les points
  // sur lesquels chaque terme est noté se lisent là où ils ont été calculés.
  const BORNES = bornes(note.niveau);
  if (!BORNES) return [];
  return [
    {
      terme: "Marge de fonctionnement",
      mesure: `${pourcentage(mesures.tauxEpargne, true)} des recettes`,
      points: points(detail.marge),
      sur: BORNES.MARGE.points,
    },
    {
      terme: "Poids de la dette",
      mesure:
        mesures.desendettement === null
          ? // Le ratio n'existe pas quand l'épargne est nulle ou négative. Écrire
            // « l'infini » ferait passer une impossibilité pour une durée ; la
            // phrase dit ce que la mesure dit.
            "aucune épargne pour rembourser"
          : `${nombreEtNom(mesures.desendettement, "année")} d'épargne`,
      points: points(detail.dette),
      sur: BORNES.DETTE.points,
    },
    {
      terme: "Trajectoire depuis 2019",
      mesure:
        mesures.trajectoire === null
          ? "exercice 2019 non publié"
          : // **Un taux varie en points, jamais en pourcentage.** La trajectoire
            // est l'écart entre deux taux d'épargne : l'écrire « −4,9 % »
            // dirait que la marge a baissé de 4,9 % de sa valeur, quand elle a
            // perdu 4,9 points de recettes.
            `${mesures.trajectoire >= 0 ? "+" : "−"}${nombreEtNom(mesures.trajectoire, "point")} de marge`,
      points: points(detail.trajectoire),
      sur: BORNES.TRAJECTOIRE.points,
    },
  ];
}

/** Un exécutif tel que la publication le porte : un nom et une prise de
 *  fonction, rien d'autre. */
export type Executif = { nom: string; depuis: string | null };

/**
 * Qui a tenu ces comptes, sur quelle période, et sur quels exercices du tableau.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN ANCIEN MAIRE NE SE DIT PAS AU PRÉSENT
 * ─────────────────────────────────────────────────────────────────────────
 * La phrase écrivait « Maire Pierre HURMIC **est en fonction depuis** juillet
 * 2020 » sur une fiche qui, deux lignes plus haut, nomme Thomas CAZENAVE comme
 * maire. Un présent et un « depuis » sans fin décrivent quelqu'un qui exerce
 * encore ; le lecteur y lit soit une contradiction, soit deux maires à la fois.
 *
 * L'interdiction que je m'étais posée — « la source ne donne pas la fin du
 * mandat » — était mal raisonnée. Le fichier des sortants n'en donne pas, mais
 * **la prise de fonction du successeur est publiée**, et c'est exactement la
 * borne cherchée : le mandat de l'un finit quand celui de l'autre commence.
 * `jusqu` la porte, et la phrase passe au passé.
 *
 * Sans successeur publié — une quinzaine de communes —, aucune fin n'est
 * inventée et la phrase reste au présent : c'est alors le cas des présidents
 * de département et de région, qui exercent bel et bien encore.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LA PHRASE NE REVENDIQUE PAS
 * ─────────────────────────────────────────────────────────────────────────
 * **Que les exercices entièrement couverts.** Prendre ses fonctions en juillet
 * 2020 fait de 2020 une année à cheval et de 2019 celle de quelqu'un que la
 * source ne nomme pas : le ministère n'arrête la liste des sortants qu'avant
 * un scrutin, et celle d'avant 2020 n'est pas republiée.
 *
 * Et rien n'est écrit si l'exécutif a pris ses fonctions après le dernier
 * exercice du tableau — c'est le cas de tout maire élu en mars 2026 face à des
 * comptes qui s'arrêtent en 2025, et poser son nom là serait lui attribuer un
 * bilan qui n'est pas le sien.
 */
export function phraseExecutif(
  executif: Executif | undefined,
  role: string,
  exercices: string[],
  jusqu?: string | null,
): string {
  if (!executif?.depuis || !exercices.length) return "";
  const priseDeFonction = new Date(executif.depuis);
  if (Number.isNaN(priseDeFonction.getTime())) return "";
  // Un exercice est entièrement couvert s'il commence après la prise de
  // fonction : l'année de la prise de fonction est toujours à cheval.
  const premier = String(priseDeFonction.getFullYear() + 1);
  const couverts = exercices.filter((e) => e >= premier);
  if (!couverts.length) return "";
  const etendue =
    couverts.length === 1
      ? `l'exercice ${couverts[0]}`
      : `les exercices ${couverts[0]} à ${couverts[couverts.length - 1]}`;
  const suite = `${etendue} ${couverts.length === 1 ? "est entièrement le sien" : "sont entièrement les siens"}.`;
  return ` ${echapper(role)} ${echapper(executif.nom)} ${periode(
    executif.depuis,
    jusqu,
  )} : ${suite}`;
}

/**
 * « de juillet 2020 à mars 2026 », ou « en fonction depuis juillet 2021 ».
 *
 * La fin vient de la prise de fonction du successeur : un mandat finit quand
 * le suivant commence. Une fin antérieure au début serait une donnée fausse en
 * amont — on n'écrit alors pas de période plutôt qu'une période à l'envers.
 */
function periode(depuis: string, jusqu?: string | null): string {
  const debut = new Date(depuis);
  const mois = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  if (jusqu) {
    const fin = new Date(jusqu);
    if (!Number.isNaN(fin.getTime()) && fin > debut) {
      return `a été en fonction de ${echapper(mois(debut))} à ${echapper(mois(fin))}`;
    }
  }
  return `est en fonction depuis ${echapper(mois(debut))}`;
}

/**
 * La solvabilité exercice par exercice — dont 2019, la première colonne.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE TABLEAU EXISTE, ET POURQUOI IL EST SUR 16
 * ─────────────────────────────────────────────────────────────────────────
 * Une note seule laisse ouverte la question qu'on se pose juste après :
 * « et avant, c'était mieux ? ». La trajectoire y répond pour la marge, en
 * points, mais elle ne dit rien de la dette — une collectivité peut avoir
 * gagné de la marge en empruntant.
 *
 * Le total est sur 16 et non sur 20 parce que le troisième terme de la note
 * est un écart depuis 2019 : il n'existe pas POUR 2019, et le porter demanderait
 * une borne six ans plus tôt que les fichiers ne publient pas (`note.ts`).
 * Deux totaux différents sur un même écran est un risque de confusion, et il
 * est pris délibérément : l'alternative — donner au terme sa demi-valeur par
 * défaut à chaque exercice ancien — poserait un remplissage là où le lecteur
 * lirait une mesure.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'UNITÉ NE SE MÊLE PAS
 * ─────────────────────────────────────────────────────────────────────────
 * Ce tableau est le sien, et non une ligne ajoutée au tableau « Évolution » :
 * celui-ci aligne des euros sous une seule échelle nommée dans sa légende, et
 * y glisser une ligne en points mêlerait deux unités dans une même table.
 */
export function rendreParcours(
  series: Record<string, Record<string, number>>,
  niveau: string,
  executif?: { nom: string; depuis: string | null },
  role = "",
  jusqu?: string | null,
): string {
  const exercices = exercicesNotables(series);
  // Une colonne unique ne se compare pas : le tableau ne s'écrit qu'à partir
  // de deux exercices, comme le tableau des exercices du reste de la fiche.
  if (exercices.length < 2) return "";
  const colonnes = exercices
    .map((exercice) => solvabilite(series, exercice, niveau))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (colonnes.length < 2) return "";

  const entetes = colonnes.map((c) => `<th scope="col">${echapper(c.exercice)}</th>`).join("");
  const ligne = (
    intitule: string,
    cellule: (c: (typeof colonnes)[number]) => string,
    classe = "",
  ) =>
    `<tr${classe ? ` class="${classe}"` : ""}><th scope="row">${echapper(intitule)}</th>${colonnes
      .map((c) => `<td>${echapper(cellule(c))}</td>`)
      .join("")}</tr>`;

  return `<details class="note__parcours">
    <summary>La note, exercice par exercice</summary>
    <div class="note__parcours-cadre" tabindex="0">
      <table class="note__parcours-table">
        <caption>Marge et dette seules, sur ${SOLVABILITE_POINTS} points : le troisième terme de la note est un écart depuis 2019, il n'existe pas pour 2019 même.${phraseExecutif(
          executif,
          role,
          colonnes.map((c) => c.exercice),
        )}</caption>
        <thead><tr><th scope="col">Exercice</th>${entetes}</tr></thead>
        <tbody>
          ${ligne("Marge de fonctionnement", (c) => pourcentage(c.tauxEpargne, true))}
          ${ligne("Poids de la dette", (c) =>
            c.desendettement === null ? "aucune épargne" : nombreEtNom(c.desendettement, "année"),
          )}
          ${ligne(
            `Solvabilité sur ${SOLVABILITE_POINTS}`,
            (c) => points(c.valeur),
            "note__parcours-total",
          )}
        </tbody>
      </table>
    </div>
  </details>`;
}

/**
 * Le bloc entier.
 *
 * `series` et `niveau` servent le tableau exercice par exercice, qui répond à
 * la question qu'une note seule laisse ouverte : « et avant, c'était mieux ? ».
 *
 * **La phrase de portée est partie de la fiche** — « la note mesure la
 * solvabilité de X […] elle ne juge ni le niveau de dépense » —, et elle n'est
 * pas perdue : elle vit dans les règles d'affichage de la page BILAN, où le
 * lecteur qui conteste une note va chercher la méthode. Sur la fiche, elle
 * occupait six lignes sous trois chiffres pour dire ce que les trois chiffres
 * montrent déjà.
 */
export function rendreNote(
  note: Note | null,
  series: Record<string, Record<string, number>> = {},
  executif?: { nom: string; depuis: string | null },
  role = "",
  jusqu?: string | null,
): string {
  if (!note) return "";
  const total = points(note.valeur);
  const parcours = rendreParcours(series, note.niveau, executif, role, jusqu);
  const rangs = lignes(note)
    .map(
      (l) => `<tr>
        <th scope="row">${echapper(l.terme)}</th>
        <td class="note__mesure">${echapper(l.mesure)}</td>
        <td class="note__points">${echapper(l.points)}<span class="note__sur"> / ${l.sur}</span></td>
      </tr>`,
    )
    .join("");
  return `<section class="note" aria-labelledby="note-titre">
    <h3 class="note__titre" id="note-titre">Gestion financière</h3>
    <p class="note__valeur"><strong>${echapper(total)}</strong><span class="note__bareme"> / 20</span>
      <span class="note__mention">${echapper(mention(note.valeur))}</span></p>
    <table class="note__detail">
      <caption>Exercice ${echapper(note.mesures.exercice)}. Source : OFGL, comptes des collectivités locales.</caption>
      <tbody>${rangs}</tbody>
    </table>
    ${parcours}
  </section>`;
}
