/**
 * La page MÉTHODE : les sources, la méthode, et la grille de verdicts.
 *
 * C'est la page vers laquelle la bande de confiance de l'accueil renvoie. Elle
 * porte donc ce que cette bande promet : d'où viennent les chiffres (les jeux
 * réellement publiés, producteur par producteur), comment ils sont produits et
 * vérifiés, et les règles publiques du système éditorial
 * (docs/analyses-schema.md, docs/superpowers/specs/2026-08-14-arbitre-
 * rejouable-design.md §14 et §15).
 *
 * Trois rendus, purs, sans DOM et sans `fetch` :
 *
 * - `renduSources(jeux)` — le seul qui prenne une donnée : les jeux du
 *   manifeste, que `main.ts` détient. Aucun producteur, aucun titre, aucune URL
 *   n'est écrit dans ce module ; tout vient du manifeste, parce qu'une page qui
 *   liste des sources est le dernier endroit du site où une source inventée
 *   passerait inaperçue. Un test lit ce fichier et refuse qu'il porte la
 *   moindre adresse en dur.
 * - `renduMethode()` — ce que le site fait et comment il le vérifie. Du texte
 *   de référence, sans donnée d'entrée.
 * - `renduGrille()` — les crans, les confusions et les registres. Les libellés
 *   sont importés de `analyse-rendu.ts` plutôt que recopiés ici, pour qu'un
 *   désaccord entre la page et le rendu d'analyse — ou le contrôle déterministe
 *   qui partage la même taxonomie — soit une erreur de compilation, jamais une
 *   divergence silencieuse.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE PAGE N'ÉCRIT JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * Aucune réserve qui s'excuse. Une page de méthode attire la prose défensive —
 * « ce que ces chiffres ne disent pas », « leur fiabilité est inégale » — et
 * six blocs de ce genre ont déjà été retirés du site : ils disent au lecteur de
 * se méfier d'un chiffre sans lui donner de quoi le lire autrement. Ce qui
 * manque à un fichier se dit dans la légende du tableau qui le montre, avec les
 * chiffres. Ici, la page dit ce que le site fait et ce qui l'arrête quand un
 * montant ne correspond pas — et elle ne s'adresse jamais au lecteur, seulement
 * au site : `TITRES` ferme la liste de ses intertitres, et deux tests la
 * verrouillent.
 */

import {
  LIBELLE_CONFUSION,
  LIBELLE_CRAN,
  type Confusion,
  type Cran,
  type Registre,
} from "./analyse-rendu.ts";
import type { Jeu } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { echapper } from "./texte.ts";

/**
 * Les intertitres de la page, en un seul endroit.
 *
 * Ce n'est pas un raffinement : c'est la garde contre la réserve qui s'excuse.
 * Les six blocs retirés du site étaient tous annoncés par leur titre — « Ce que
 * ces chiffres ne disent pas », « Pourquoi ce n'est pas suivre son impôt ». Un
 * test compare cette liste aux titres réellement rendus, et un autre exige que
 * chacun nomme ce que le site fait plutôt qu'une lacune : ajouter une section
 * défensive à cette page casse les deux, quels que soient les mots employés à
 * l'intérieur.
 */
const TITRES = {
  sources: "Les sources",
  methode: "La méthode",
  chiffres: "Les chiffres, du fichier du producteur au fichier publié",
  analyses: "Les analyses, où le contrôle remplace la relecture",
  ecran: "Ce que l'écran tient",
  navigateur: "Ce que la page demande au réseau",
  grille: "La grille de verdicts",
  crans: "Le verdict, en trois crans",
  confusions: "Les sept confusions",
  registres: "Les sept registres d'énoncé",
  sujets: "Le choix des sujets",
} as const;

/** Les titres, exposés pour le test qui ferme la liste. */
export const TITRES_METHODE: readonly string[] = Object.values(TITRES);

/** Ordre d'affichage des crans — celui de `docs/analyses-schema.md` § Crans.
 *
 *  Un littéral objet, pas un tableau : `satisfies Record<Cran, true>` exige
 *  une clé pour chaque valeur du type `Cran`, ni plus ni moins. Un cran
 *  ajouté au type sans être ajouté ici — ou une clé qui n'existe plus dans le
 *  type — est ainsi une erreur de compilation, comme le docstring du module
 *  le promet ; un tableau `Cran[]` aurait laissé passer l'oubli en silence. */
const ORDRE_CRANS = {
  exact: true,
  hors_perimetre: true,
  introuvable: true,
} satisfies Record<Cran, true>;

/** Ordre d'affichage des confusions — celui de `docs/analyses-schema.md` §
 *  Confusions, repris tel quel dans le brief de la tâche. Même garde
 *  d'exhaustivité qu'`ORDRE_CRANS`. */
const ORDRE_CONFUSIONS = {
  ae_cp: true,
  brut_net: true,
  vote_execute: true,
  stock_flux: true,
  etat_apu: true,
  annuel_cumule: true,
  perimetre_geographique: true,
} satisfies Record<Confusion, true>;

/** Les six registres que porte le type `Registre` — leur ordre est celui de
 *  la spec §14.2, points 1 à 6. Le septième point de la spec, l'opinion,
 *  n'a pas de valeur dans `Registre` : il n'existe pas sur le site, et la
 *  grille le dit en prose plutôt que d'ajouter une entrée qui n'a rien à
 *  vérifier derrière elle. Même garde d'exhaustivité qu'`ORDRE_CRANS`. */
const REGISTRES_INFO = {
  fait_comptable: {
    libelle: "Fait comptable",
    texte: "Une observation publiée par le pipeline. Vérifiée par la machine, de façon bloquante.",
  },
  donnee_officielle: {
    libelle: "Donnée officielle citée",
    texte:
      "Publiée par un producteur officiel mais absente de l'entrepôt : lien vers la source primaire obligatoire, jamais reformulée en fait comptable.",
  },
  resultat_simulation: {
    libelle: "Résultat de simulation",
    texte: "Produite par le moteur du site, accompagnée des réglages qui la reproduisent.",
  },
  estimation_externe: {
    libelle: "Estimation externe",
    texte:
      "Un chiffrage de tiers, attribué et daté, avec ses hypothèses. Le site le confronte à d'autres ; il ne le départage que lorsque les comptes le permettent.",
  },
  hypothese: {
    libelle: "Hypothèse",
    texte: "Ce qu'il faut supposer pour que le calcul tienne.",
  },
  interpretation: {
    libelle: "Interprétation",
    texte:
      "Une lecture ou un rapprochement des registres précédents, toujours dérivable d'eux, jamais elle-même une observation.",
  },
} satisfies Record<Registre, { libelle: string; texte: string }>;

/* --------------------------------------------------------------------------
 * Les sources
 * ----------------------------------------------------------------------- */

/** Les jeux groupés par producteur, **dans l'ordre reçu**.
 *
 *  `Map` conserve l'ordre d'insertion : un producteur apparaît là où son
 *  premier jeu apparaît dans le manifeste. Trier — par nom, par nombre de jeux —
 *  ferait un palmarès des producteurs, ce que ce site ne publie nulle part. */
function parProducteur(jeux: readonly Jeu[]): { producteur: string; jeux: Jeu[] }[] {
  const groupes = new Map<string, Jeu[]>();
  for (const jeu of jeux) {
    const deja = groupes.get(jeu.producteur);
    if (deja) deja.push(jeu);
    else groupes.set(jeu.producteur, [jeu]);
  }
  return [...groupes].map(([producteur, liste]) => ({ producteur, jeux: liste }));
}

/** La date d'extraction en français. Une chaîne que `Date` ne sait pas lire est
 *  rendue telle quelle : « Invalid Date » sur la page des sources vaudrait pire
 *  que la date brute du manifeste. */
function dateExtraction(iso: string): string {
  const quand = new Date(iso);
  return Number.isNaN(quand.getTime()) ? echapper(iso) : quand.toLocaleDateString("fr-FR");
}

/** « 1 producteur », « 27 producteurs » — le pluriel régulier de l'intro. Le
 *  pluriel de « jeu » est irrégulier et s'écrit sur place. */
function pluriel(nombre: number): string {
  return nombre > 1 ? "s" : "";
}

/**
 * Les sources : les jeux réellement publiés, producteur par producteur.
 *
 * Le module ne connaît aucun producteur, aucun titre, aucune adresse : tout
 * vient du manifeste que le pipeline écrit à chaque publication (`Jeu`,
 * donnees.ts ; `manifeste()`, pipeline/plateforme/publish.py). Une liste écrite
 * ici aurait vieilli au premier jeu ajouté, et surtout elle aurait pu nommer une
 * source que le site ne sert pas.
 *
 * Chaque jeu porte les quatre choses qui permettent de retrouver le chiffre dans
 * le fichier d'origine : son producteur, son titre, sa licence, et la date à
 * laquelle le site l'a lu. Rien n'est rendu quand le manifeste est vide — un
 * cadre vide se lit comme une panne.
 *
 * La liste est **repliée**, son décompte et ses producteurs annoncés au-dessus.
 * Mesurée au navigateur sur la publication du 18 août 2026, elle faisait 5 210
 * px à elle seule pour 19 283 px de page : un quart du bilan de la France était
 * une bibliographie. La Licence Ouverte demande de citer les producteurs, pas de
 * les déplier — le pli garde chaque ligne dans le document, à un geste.
 */
export function renduSources(jeux: readonly Jeu[]): string {
  if (jeux.length === 0) return "";
  const groupes = parProducteur(jeux);
  // Une liste de définitions, pas des intertitres : le nom d'un producteur
  // définit les jeux qui le suivent, et les intertitres de la page restent la
  // liste fermée de `TITRES` — celle que le test des réserves verrouille.
  const liste = groupes
    .map(
      ({ producteur, jeux: siens }) => `<dt>${echapper(producteur)}</dt>
        <dd><ul class="methode-sources__jeux">${siens
          .map(
            (jeu) => `<li>
              <a href="${echapper(jeu.url)}" rel="noreferrer">${echapper(jeu.titre)}</a>
              <span class="methode-sources__licence">${echapper(jeu.licence)}</span>
              <span class="methode-sources__extraction">fichier lu le ${dateExtraction(
                jeu.extraction,
              )}</span>
            </li>`,
          )
          .join("")}</ul></dd>`,
    )
    .join("");
  return `
    <h3>${TITRES.sources}</h3>
    <p class="methode-sources__intro">
      ${formater(jeux.length, "count", false)} ${jeux.length > 1 ? "jeux" : "jeu"} de données,
      de ${formater(groupes.length, "count", false)} producteur${pluriel(groupes.length)}.
      Chaque ligne mène au fichier d'origine, avec sa licence et la date à laquelle
      le site l'a lu : le chiffre affiché se retrouve dans le fichier du producteur.
    </p>
    <details class="methode-sources__liste">
      <summary>Voir les ${formater(jeux.length, "count", false)} jeux, producteur par producteur</summary>
      <dl class="methode-sources__producteurs">${liste}</dl>
    </details>
  `;
}

/* --------------------------------------------------------------------------
 * La méthode
 * ----------------------------------------------------------------------- */

/**
 * Ce que le site fait, et ce qui l'arrête quand un montant ne correspond pas.
 *
 * Deux flux qui ne se mélangent pas (spec §7.4) : les chiffres, produits par le
 * pipeline ; les analyses, qui citent des chiffres déjà publiés sans jamais en
 * créer. Le second a sa propre garantie — un contrôle déterministe bloquant à la
 * place de la relecture humaine (décision D11, spec §14.3).
 *
 * Chaque phrase décrit un mécanisme qui existe dans le dépôt : les contrôles
 * bloquants et la quarantaine (docs/06 § Contrôles bloquants), la publication
 * versionnée et sa garde de perte (`publish.py`, `PERTE_MAXIMALE`), les six
 * familles du contrôle des analyses (`controle_analyses.py`), le contrôle rejoué
 * après publication (`.github/workflows/cron.yml`). Aucune n'annonce une
 * intention.
 *
 * Du texte de référence, donc : aucune donnée d'entrée.
 */
export function renduMethode(): string {
  return `
    <h3>${TITRES.methode}</h3>
    <details class="methode__pli">
    <summary>Voir comment un chiffre passe du fichier du producteur à l'écran</summary>
    <p class="methode-methode__intro">
      Deux chemins, qui ne se croisent qu'une fois. Les chiffres viennent des
      fichiers de leurs producteurs et sont republiés tels que le pipeline les a
      lus. Les analyses ne créent aucun chiffre : elles citent ceux qui sont
      publiés, et une machine vérifie chaque montant cité contre le fichier qui le
      porte.
    </p>

    <h4>${TITRES.chiffres}</h4>
    <ol class="methode-methode__etapes">
      <li><strong>Collecte.</strong> Chaque jeu est lu par l'API de son producteur
        quand elle existe, sinon par son téléchargement officiel.</li>
      <li><strong>Instantané.</strong> Le fichier reçu est conservé tel quel,
        horodaté, avec son empreinte : le calcul se rejoue sur l'octet lu ce jour-là,
        même après que le producteur a republié le sien.</li>
      <li><strong>Contrôles bloquants.</strong> Une identité comptable qui ne se
        referme pas arrête la publication entière — l'épargne brute d'une
        collectivité est la différence entre ses recettes et ses dépenses de
        fonctionnement ; le solde budgétaire de l'État se déduit de ses recettes,
        de ses dépenses, de ses prélèvements sur recettes et de ses soldes
        annexes. Quand une seule partie du jeu est en cause, elle reste à quai et
        le reste est publié.</li>
      <li><strong>Publication versionnée.</strong> Chaque publication vit sous sa
        version, immuable ; un seul pointeur bouge. Le site lit ces fichiers et
        n'interroge aucune base : ce que l'écran affiche est ce qu'un tiers
        télécharge.</li>
      <li><strong>Garde de publication.</strong> Une publication qui porterait
        moins de quatre cinquièmes des indicateurs déjà en ligne est refusée : un
        entrepôt à moitié rempli ne remplace pas un site complet.</li>
    </ol>

    <h4>${TITRES.analyses}</h4>
    <p class="methode-methode__d11">
      L'exactitude d'une analyse est garantie par une machine, pas par une
      relecture (décision D11) : un relecteur ne peut pas confronter à la main
      chaque montant cité aux fichiers publiés, et une machine le fait
      intégralement, avant chaque déploiement et après chaque publication de
      données. Ce contrôle est exécutable par quiconque a le dépôt :
      <code>python -m plateforme.controle_analyses site/analyses</code>.
    </p>
    <ul class="methode-methode__controle">
      <li><strong>Chaque montant est confronté au fichier publié</strong> —
        indicateur, maille, code, période — et doit en être exactement la valeur,
        sans tolérance.</li>
      <li><strong>L'indicateur cité existe et est publié à la maille invoquée</strong>,
        avec l'unité du catalogue et non celle de l'analyse.</li>
      <li><strong>Tout montant écrit en prose est adossé à l'un des chiffres
        référencés.</strong> La prose peut arrondir ce montant ; elle ne peut pas le
        contredire, et un nombre qui ne désigne aucune référence fait échouer le
        contrôle. C'est la garde contre l'invention.</li>
      <li><strong>Une donnée officielle citée ou une estimation externe porte son
        lien et sa date de consultation</strong>, et reste nommée comme telle plutôt
        que reformulée en fait comptable.</li>
      <li><strong>Un lien de simulateur est décodé au build par le décodeur du
        simulateur lui-même</strong> : un lien qui n'ouvre aucun réglage arrête le
        build.</li>
      <li><strong>Chaque analyse porte la version des données sur laquelle le
        contrôle a réussi.</strong> Après chaque publication, le contrôle est rejoué
        sur toutes les analyses en ligne ; un montant qui a bougé ouvre une alerte
        publique dans le dépôt, et la correction est datée dans le journal, plus
        bas sur cette page.</li>
    </ul>
    <p class="methode-methode__fusion">
      La publication passe par une demande de fusion : le contrôle décide de ce qui
      peut être publié, la fusion reste un geste humain.
    </p>

    <h4>${TITRES.ecran}</h4>
    <ul class="methode-methode__ecran">
      <li>L'unité d'un montant s'écrit en toutes lettres — « 417,14 millions
        d'euros », « 3 536,10 milliards d'euros » — et l'échelle est choisie sur
        le montant, jamais fixée d'avance : « 3 536 100 M€ » demandait au lecteur
        de savoir qu'un sigle vaut un million pour comprendre qu'il lisait trois
        mille cinq cents milliards. Un tableau, où l'unité ne peut pas se répéter
        dans chaque cellule, prend une seule échelle pour tout le tableau, choisie
        sur son plus gros montant et nommée dans sa légende : une colonne qui
        change d'unité d'une ligne à l'autre ne se compare pas.</li>
      <li>Un taux varie en points, jamais en pourcentage — y compris les taux que
        la source publie pour mille et que l'écran montre en pourcentage.</li>
      <li>Les budgets ne s'additionnent pas : l'État, la Sécurité sociale et chaque
        échelon de collectivité se lisent séparément, et la seule addition publiée
        est celle de la comptabilité nationale, qui a son propre cadre et son
        propre solde.</li>
      <li>Deux territoires se comparent à la même année, à la même unité et au
        même périmètre — et jamais d'un échelon à l'autre. Le site publie une note
        de gestion sur 20 et range les territoires par leurs valeurs publiées ;
        il ne publie aucun palmarès entre échelons, et aucune note qui agrège des
        mesures d'unités différentes en un indice sans dimension.</li>
      <li>La note de gestion mesure la solvabilité, et elle seule : la marge
        dégagée sur le fonctionnement, le temps qu'il faudrait pour rembourser la
        dette, et le sens dans lequel les deux vont depuis 2019. Elle ne juge ni
        le niveau de dépense, ni sa répartition, ni les taux d'impôts, qui sont
        des choix d'électeurs et non des fautes de gestion. Son barème est propre
        à chaque échelon : les recettes de fonctionnement d'un département portent
        le RSA, l'APA et la PCH, qui entrent et ressortent, si bien qu'un barème
        commun lui retirerait des points pour sa définition comptable.</li>
      <li>Chaque chiffre porte son unité et son millésime là où il est affiché.
        Sa source est nommée à côté de lui dans les analyses, sur les images
        partagées et dans les citations ; ailleurs, elle est sur cette page.</li>
    </ul>

    <h4>${TITRES.navigateur}</h4>
    <p class="methode-methode__reseau">
      Les polices et le moteur de carte sont servis par le site lui-même. La page
      ne charge aucun script tiers, aucun widget social et aucune mesure
      d'audience : les seules requêtes qu'elle émet vont chercher les fichiers
      publiés et les tuiles de la carte.
    </p>
    </details>
    </details>
  `;
}

/* --------------------------------------------------------------------------
 * La grille de verdicts
 * ----------------------------------------------------------------------- */

/** Rendu pur, sans DOM et sans donnée d'entrée : la grille est du texte de
 *  référence, elle ne dépend d'aucune publication du pipeline. */
export function renduGrille(): string {
  const crans = (Object.keys(ORDRE_CRANS) as Cran[])
    .map((cran) => `<dt><code>${cran}</code></dt><dd>« ${LIBELLE_CRAN[cran]} »</dd>`)
    .join("");

  const confusions = (Object.keys(ORDRE_CONFUSIONS) as Confusion[])
    .map((confusion) => `<dt><code>${confusion}</code></dt><dd>${LIBELLE_CONFUSION[confusion]}</dd>`)
    .join("");

  const registres = (Object.keys(REGISTRES_INFO) as Registre[])
    .map((registre) => {
      const { libelle, texte } = REGISTRES_INFO[registre];
      return `<li><strong>${libelle}</strong> <code>${registre}</code> — ${texte}</li>`;
    })
    .join("");

  return `
    <h3>${TITRES.grille}</h3>
    <details class="methode__pli">
    <summary>Voir les crans du verdict, les confusions et les registres</summary>
    <p class="methode-grille__intro">
      Les règles que chaque analyse suit, écrites avant les analyses elles-mêmes :
      les crans que le site peut rendre, les confusions qu'il peut nommer, les
      registres auxquels un chiffre cité peut appartenir, et le critère qui
      choisit les sujets.
    </p>

    <h4>${TITRES.crans}</h4>
    <dl class="methode-grille__crans">${crans}</dl>
    <p>
      Aucun cran ne porte de jugement. « Trompeur », « mensonger », « exagéré »
      qualifient une intention, invérifiable : ils n'existent pas ici. Le site
      compare deux nombres et nomme ce qui les sépare.
    </p>

    <h4>${TITRES.confusions}</h4>
    <p class="methode-grille__aide">
      Un verdict <code>hors_perimetre</code> nomme toujours laquelle de ces sept
      confusions est en cause.
    </p>
    <dl class="methode-grille__confusions">${confusions}</dl>

    <h4>${TITRES.registres}</h4>
    <p class="methode-grille__aide">
      Chaque chiffre cité par une analyse appartient à l'un de ces registres.
    </p>
    <ol class="methode-grille__registres">
      ${registres}
      <li><strong>Opinion</strong> — n'existe pas sur le site. Aucune phrase ne
      qualifie une mesure de bonne ou de mauvaise, souhaitable ou non.</li>
    </ol>

    <h4>${TITRES.sujets}</h4>
    <p>
      Est analysé un chiffre qui circule largement et qui touche une ligne que
      le site publie. Ni l'auteur du chiffre, ni son orientation n'entrent
      dans le critère. La file des sujets est publique — les issues du dépôt
      — ce qui rend le biais de sélection observable.
    </p>
    </details>
    </details>
  `;
}
