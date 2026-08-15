/**
 * L'aperçu d'un scénario partagé, calculé à l'edge.
 *
 * Un scénario n'a pas de page. Il vit dans son adresse — `?budget=…` — et
 * l'espace de ces adresses est infini : aucun build ne peut les pré-rendre.
 * Cette fonction lit le budget que porte l'adresse, le décode avec le décodeur
 * du site, et pose dans le document servi le titre et la description qui vont
 * avec. C'est tout ce qu'elle fait : `og:image` reste la carte du site produite
 * au build (décision D-L3-b), parce qu'une image par scénario supposerait un
 * rasteriseur et une fonte sur un chemin que les robots appellent.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OÙ CE FICHIER DOIT VIVRE, ET POURQUOI ÇA SE VÉRIFIE
 * ─────────────────────────────────────────────────────────────────────────
 * `wrangler pages deploy` cherche le répertoire `functions` **relativement au
 * répertoire courant**. Publié depuis la racine du dépôt, il ne verrait jamais
 * `site/functions/` : la fonction partirait sans bruit, le déploiement
 * réussirait, le site marcherait, et les aperçus resteraient génériques — c'est
 * exactement ce qu'on voit quand la fonction est là mais ne trouve rien à dire.
 * L'étape de déploiement s'exécute donc depuis `site/`, et
 * `scripts/deploiement.test.ts` le constate sur le workflow plutôt que de le
 * confier à ce commentaire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RIEN NE QUITTE LE NAVIGATEUR DU LECTEUR
 * ─────────────────────────────────────────────────────────────────────────
 * Un budget encodé est une opinion politique. Cette fonction ne journalise
 * rien, ne compte rien, n'appelle aucun tiers : ses seules requêtes sortantes
 * vont à l'entrepôt de fichiers publics que le navigateur du lecteur
 * interrogera de toute façon en ouvrant la page.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN ROBOT NE DOIT JAMAIS RECEVOIR UNE ERREUR
 * ─────────────────────────────────────────────────────────────────────────
 * Adresse sans budget, budget illisible, entrepôt injoignable, lenteur : tous
 * ces cas rendent **le document tel quel**, avec les métadonnées du site que le
 * pré-rendu y a posées. Un robot qui reçoit une erreur n'affiche aucun aperçu,
 * et un lecteur ordinaire doit recevoir sa page — `/simulateur` est une route
 * cliente servie par le repli SPA, et rien ici ne doit l'empêcher d'arriver.
 */

import { apercuScenario, poserApercu } from "../../src/apercu-scenario.ts";
import type { Volet } from "../../src/atelier.ts";
import { BASE_DONNEES, construireVolets } from "../../src/simulateur-volets.ts";

/**
 * Ce que Cloudflare Pages passe à une fonction, réduit à ce qu'on en lit.
 *
 * Écrit ici plutôt qu'importé d'un paquet de types : trois champs contre une
 * dépendance de plus, et cette fonction n'utilise aucune autre API du
 * travailleur.
 */
type Contexte = {
  request: Request;
  next: () => Promise<Response>;
  env: Record<string, unknown>;
};

/**
 * Au-delà, on sert le document sans aperçu propre.
 *
 * Un robot de plateforme n'attend pas : au bout de quelques secondes il
 * abandonne, et le lien part alors sans **aucun** aperçu — moins bien que
 * l'aperçu générique du site, qui, lui, est déjà dans le document.
 */
const DELAI_MAX_MS = 4000;

/** Les fichiers d'une publication sont immuables : leur chemin porte le
 *  millésime. Ils se mettent en cache aussi longtemps que l'edge veut bien. */
const CACHE_PUBLICATION_S = 86_400;

/** `derniere.json` est le seul fichier qui change de contenu sans changer de
 *  nom. Un cache court suffit à absorber une rafale de robots sans retarder la
 *  prise en compte d'une nouvelle publication. */
const CACHE_POINTEUR_S = 300;

/**
 * Un `fetch` mis en cache par l'edge.
 *
 * `cf` n'existe pas dans les types du DOM et n'est lu que par le runtime
 * Cloudflare ; en développement local, l'option est simplement ignorée.
 */
function lireCache(url: string, secondes: number): Promise<Response> {
  return fetch(url, {
    cf: { cacheEverything: true, cacheTtl: secondes },
  } as unknown as RequestInit);
}

async function lireJson<T>(url: string, secondes: number): Promise<T> {
  const reponse = await lireCache(url, secondes);
  if (!reponse.ok) throw new Error(`${url} indisponible (${reponse.status})`);
  return (await reponse.json()) as T;
}

/**
 * Les volets du simulateur, lus **là où le navigateur du lecteur les lira**.
 *
 * Pas un instantané écrit au build : le site résout `data/derniere.json` à
 * l'ouverture (`src/donnees.ts`), et le déploiement du site ne suit pas les
 * publications du pipeline. Un instantané se serait donc mis à décrire une
 * publication que la page n'ouvre plus, sans que rien ne le dise — et c'est la
 * seule divergence qu'un aperçu ne peut pas se permettre.
 */
async function voletsPublies(base: string): Promise<Volet[]> {
  const { version } = await lireJson<{ version: string }>(
    `${base}/data/derniere.json`,
    CACHE_POINTEUR_S,
  );
  const racine = `${base}/data/${version}`;
  return construireVolets(<T,>(chemin: string) => lireJson<T>(`${racine}/${chemin}`, CACHE_PUBLICATION_S));
}

/** Une promesse qui abandonne, plutôt qu'une promesse qui fait attendre. */
function borner<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<never>((_, rejeter) =>
      setTimeout(() => rejeter(new Error("aperçu : délai dépassé")), ms),
    ),
  ]);
}

export async function onRequest(contexte: Contexte): Promise<Response> {
  const { request, next, env } = contexte;
  const adresse = new URL(request.url);
  const budget = adresse.searchParams.get("budget") ?? "";

  // Rien à décrire : ni lecture de données, ni réécriture. C'est aussi le
  // chemin qu'empruntent les fichiers servis sous `/simulateur/`, à commencer
  // par `scenarios-reference.json`.
  if (request.method !== "GET" || !budget) return next();

  const reponse = await next();
  const type = reponse.headers.get("content-type") ?? "";
  if (!reponse.ok || !type.includes("text/html")) return reponse;

  try {
    const base = typeof env.VITE_DONNEES_URL === "string" ? env.VITE_DONNEES_URL : BASE_DONNEES;
    const volets = await borner(voletsPublies(base), DELAI_MAX_MS);
    const apercu = apercuScenario(volets, budget, adresse.searchParams.get("nom") ?? "");
    if (!apercu) return reponse;

    const html = poserApercu(await reponse.text(), apercu, adresse.toString());
    const entetes = new Headers(reponse.headers);
    // La longueur et l'encodage décrivaient le document d'avant : réécrit, il
    // n'a plus ni l'une ni l'autre, et un client qui les croirait tronquerait
    // la page.
    entetes.delete("content-length");
    entetes.delete("content-encoding");
    return new Response(html, { status: reponse.status, statusText: reponse.statusText, headers: entetes });
  } catch {
    // Entrepôt injoignable, publication illisible, délai dépassé : le document
    // part avec les métadonnées du site. Jamais un code d'erreur — voir
    // l'en-tête du fichier.
    return reponse;
  }
}
