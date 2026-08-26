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

import {
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

/** La valeur nue, une décimale, sans son nom.
 *
 *  **L'unité s'écrit une fois par ligne, dans la colonne d'intitulé.** Elle
 *  était collée à chaque valeur — « 26,3 % des recettes », « 7,5 années
 *  d'épargne » —, ce qui faisait quatre colonnes de phrases là où le lecteur
 *  veut quatre colonnes de nombres, et poussait la colonne des points hors du
 *  cadre : « / 8 » était coupé, vu au navigateur.
 *
 *  Le signe reste porté par l'appelant, parce que lui seul sait si la mesure
 *  se lit signée : un taux d'épargne ne l'est pas, un écart l'est toujours. */
function nombre(valeur: number): string {
  return Math.abs(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
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
export function lignes(note: Note): {
  terme: string;
  unite: string;
  mesure: string;
  evolution: string | null;
  points: string;
  sur: number;
}[] {
  const { mesures, detail } = note;
  // Le barème de l'échelon qui a produit la note, jamais un autre : les points
  // sur lesquels chaque terme est noté se lisent là où ils ont été calculés.
  const BORNES = bornes(note.niveau);
  if (!BORNES) return [];
  return [
    {
      terme: "Marge de fonctionnement",
      // **L'unité s'écrit une fois, dans la colonne d'intitulé.** Elle était
      // collée à chaque valeur — « 26,3 % des recettes », « 7,5 années
      // d'épargne » —, ce qui donnait quatre colonnes de phrases là où le
      // lecteur veut quatre colonnes de nombres, et poussait la colonne des
      // points hors du cadre. Mesuré au navigateur : « / 8 » était coupé.
      unite: "% des recettes",
      mesure: nombre(mesures.tauxEpargne),
      // L'évolution de la marge EST la trajectoire : elle s'écrit ici, sur la
      // ligne de la mesure dont elle est l'écart, et le troisième terme ne la
      // répète pas — un même nombre écrit deux fois dans un tableau de trois
      // lignes se lit comme une erreur.
      evolution:
        mesures.trajectoire === null
          ? null
          : `${mesures.trajectoire >= 0 ? "+" : "−"}${nombre(mesures.trajectoire)}`,
      points: points(detail.marge),
      sur: BORNES.MARGE.points,
    },
    {
      terme: "Poids de la dette",
      unite: "années d'épargne",
      mesure:
        mesures.desendettement === null
          ? // Le ratio n'existe pas quand l'épargne est nulle ou négative. Écrire
            // « l'infini » ferait passer une impossibilité pour une durée ; la
            // phrase dit ce que la mesure dit.
            "aucune épargne pour rembourser"
          : nombre(mesures.desendettement),
      evolution: null,
      points: points(detail.dette),
      sur: BORNES.DETTE.points,
    },
    {
      // **La trajectoire n'est pas une valeur de 2025.** Elle était affichée
      // dans la colonne de l'exercice d'arrivée, où elle se lisait comme une
      // mesure de cet exercice : c'est un ÉCART entre deux exercices, et elle a
      // donc sa propre colonne.
      terme: "Trajectoire de la marge",
      unite: "points de marge",
      // Ce terme n'a ni valeur de départ ni valeur d'arrivée : il note l'écart
      // écrit une ligne plus haut. Ses trois cellules restent donc vides, et la
      // légende dit ce qu'il note.
      mesure: "",
      evolution: "",
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
  // ─────────────────────────────────────────────────────────────────────
  // DEUX COLONNES : LE DÉPART ET L'ARRIVÉE
  // ─────────────────────────────────────────────────────────────────────
  // Une note seule ne se lit pas : « 19,9 sur 20 » ne dit pas si le territoire
  // s'est amélioré ou s'il part de haut. Le premier exercice de la fenêtre est
  // donc posé à côté du dernier, dans le bloc lui-même — c'est la comparaison
  // que le lecteur fait de tête, et qu'on lui faisait ouvrir un dépliant pour
  // obtenir.
  //
  // Le troisième terme est VIDE en 2019, et c'est structurel, pas un trou de
  // donnée : la trajectoire est un écart DEPUIS 2019, elle n'existe pas pour
  // 2019 même. L'écrire « 0 point » ferait passer une impossibilité pour une
  // mesure. La cellule dit donc pourquoi elle est vide.
  // Le premier exercice se DÉDUIT des séries publiées, jamais écrit en dur :
  // la règle du dépôt est que la fenêtre se lit sur les exercices publiés, et
  // un « 2019 » en dur mentirait le jour où un échelon en publie un autre.
  const premier = exercicesNotables(series)[0];
  const debut =
    premier && premier !== note.mesures.exercice
      ? solvabilite(series, premier, note.niveau)
      : null;
  const cellulesDebut: Record<string, string> = debut
    ? {
        "Marge de fonctionnement": nombre(debut.tauxEpargne),
        "Poids de la dette":
          debut.desendettement === null
            ? "aucune épargne"
            : nombre(debut.desendettement),
      }
    : {};
  const colonneDebut = Object.keys(cellulesDebut).length > 0;

  // L'évolution de chaque terme, quand ses deux bouts existent. Celle de la
  // marge est la trajectoire elle-même : elle n'est donc PAS répétée sur la
  // ligne de la marge — le troisième terme la porte, avec les points qu'elle
  // vaut, et un même nombre écrit deux fois dans un tableau de trois lignes se
  // lit comme une erreur.
  const evolutionDette =
    debut && debut.desendettement !== null && note.mesures.desendettement !== null
      ? `${note.mesures.desendettement - debut.desendettement >= 0 ? "+" : "−"}${nombre(
          note.mesures.desendettement - debut.desendettement,
        )}`
      : null;
  const cellulesEvolution: Record<string, string | null> = { "Poids de la dette": evolutionDette };

  // **Une cellule vide reste vide.** « Sans objet » écrit trois fois sur la
  // ligne de la trajectoire remplissait de mots une ligne qui n'a qu'un
  // chiffre à donner, et le lecteur y lisait une panne. Ce que ces cellules
  // n'ont pas à dire, la légende le dit une fois.
  const cellule = (contenu: string | null | undefined, classe: string) =>
    `<td class="${classe}">${contenu ? echapper(contenu) : ""}</td>`;

  const lignesNote = lignes(note);
  const rangs = lignesNote
    .map(
      (l) => `<tr>
        <th scope="row">${echapper(l.terme)}<span class="note__unite">${echapper(
          l.unite,
        )}</span></th>${
          colonneDebut ? cellule(cellulesDebut[l.terme], "note__mesure note__mesure--debut") : ""
        }
        ${cellule(l.mesure, "note__mesure")}
        ${cellule(l.evolution ?? cellulesEvolution[l.terme], "note__mesure note__mesure--ecart")}
        <td class="note__points">${echapper(l.points)}<span class="note__sur"> / ${l.sur}</span></td>
      </tr>`,
    )
    .join("");

  // Sur téléphone, cinq colonnes réduisaient les intitulés et les nombres à
  // une suite illisible (« 20192025ÉvolutionPoints »). La même information est
  // donc rendue en deux colonnes de paires libellé/valeur. Les cellules sans
  // objet ne deviennent pas des cases vides : elles disparaissent de la grille.
  const mobileMesure = (libelle: string, valeur: string | null | undefined) =>
    valeur
      ? `<span class="note__mobile-mesure"><span class="note__mobile-libelle">${echapper(
          libelle,
        )}</span><strong>${echapper(valeur)}</strong></span>`
      : "";
  const rangsMobiles = lignesNote
    .map((ligne) => {
      const evolution = ligne.evolution ?? cellulesEvolution[ligne.terme];
      return `<div class="note__mobile-ligne">
        <dt>${echapper(ligne.terme)}<span class="note__unite">${echapper(ligne.unite)}</span></dt>
        <dd class="note__mobile-valeurs">
          ${colonneDebut ? mobileMesure(premier ?? "Départ", cellulesDebut[ligne.terme]) : ""}
          ${mobileMesure(note.mesures.exercice, ligne.mesure)}
          ${mobileMesure("Évolution", evolution)}
          ${mobileMesure("Points", `${ligne.points} / ${ligne.sur}`)}
        </dd>
      </div>`;
    })
    .join("");

  const entete = `<thead><tr><th scope="col"></th>${
    colonneDebut ? `<th scope="col">${echapper(premier ?? "")}</th>` : ""
  }
      <th scope="col">${echapper(note.mesures.exercice)}</th>
      <th scope="col">Évolution</th>
      <th scope="col">Points</th></tr></thead>`;

  // La légende expliquait le montage de la colonne « Évolution » et rappelait
  // que les points sont ceux de l'exercice courant — une phrase que l'en-tête
  // du tableau dit déjà (deux colonnes nommées, une troisième « Évolution »).
  // Ne reste que l'exercice et la source, ce qu'un chiffre publié doit
  // toujours porter. Un commentaire HTML `<!-- -->` finit dans le document
  // rendu : la garde des cadratins l'aurait lu comme du texte publié.
  return `<section class="note" aria-labelledby="note-titre">
    <h3 class="note__titre" id="note-titre">Gestion financière</h3>
    <p class="note__valeur"><strong>${echapper(total)}</strong><span class="note__bareme"> / 20</span>
      <span class="note__mention">${echapper(mention(note.valeur))}</span></p>
    <table class="note__detail">
      <caption>Exercice ${echapper(note.mesures.exercice)}. Source : OFGL, comptes des
        collectivités locales.</caption>
      ${entete}
      <tbody>${rangs}</tbody>
    </table>
    <dl class="note__mobile">${rangsMobiles}</dl>
    <p class="note__source-mobile">Exercice ${echapper(note.mesures.exercice)}. Source : OFGL,
      comptes des collectivités locales.</p>
  </section>`;
}
