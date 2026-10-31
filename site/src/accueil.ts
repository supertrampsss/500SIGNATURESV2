/** Accueil éditorial : les comptes publiés prennent forme, puis les outils
 * restent accessibles directement. Rendu pur partagé avec le pré-rendu. */

import { renduHistoire } from "./histoire.ts";
import type { Territoire } from "./donnees.ts";

/** Description commune au gabarit et à la carte de partage du simulateur. */
export const MESSAGE_PRINCIPAL =
  "500 signatures transforme les chiffres publics et les annonces politiques en dossiers compréhensibles, vérifiés et accessibles à tous.";

const CHEMIN_SOURCES = "/sources/";

export type DonneesAccueil = { france?: Territoire };

export function renduQuestionsAccueil(): string {
  return `<section class="usage-faq" aria-labelledby="accueil-questions-titre">
    <h2 id="accueil-questions-titre">Utiliser 500 Signatures</h2>
    <details><summary>Où trouver le budget d’une commune ?</summary><p>Dans <a href="/territoire/">Ville</a>, recherchez une commune par son nom. Sa fiche réunit les chiffres disponibles et leurs périodes. Pour comparer deux exercices, vérifiez le périmètre, l’unité et la source de la série.</p></details>
    <details><summary>Comment vérifier ou citer un chiffre ?</summary><p>Chaque dossier indique les publications utilisées et les limites de sa lecture. Conservez le montant, l’unité, la période et le lien vers la source. La page <a href="${CHEMIN_SOURCES}">Sources et méthode</a> décrit les jeux de données et les contrôles. Une erreur peut être <a href="/a-propos/#corrections">signalée au projet</a>.</p></details>
    <details><summary>Mandats présente-t-il de vrais résultats économiques ?</summary><p>Mandats est un <a href="/mandats/comprendre/">jeu de simulation politique</a> sur cinq années. Vos décisions et les initiatives du gouvernement font évoluer le pays. Ses montants et ses conséquences sont fictifs. Les comptes observés se consultent dans <a href="/bilan/">France</a> ; ils sont distincts des résultats de votre partie.</p></details>
    <details><summary>Faut-il payer ou créer un compte ?</summary><p>Les données, les dossiers et le jeu sont accessibles gratuitement, sans compte. La sauvegarde de Mandats reste dans votre navigateur ; son menu permet de l’exporter pour la conserver ou la transférer.</p></details>
  </section>`;
}

/** Un récit, des questions concrètes, puis une simulation clairement identifiée. */
export function rendu(donnees: DonneesAccueil): string {
  return `<div class="accueil accueil-story accueil-recit">
    ${renduHistoire(donnees.france)}
    <section class="recit-explorer" aria-labelledby="recit-explorer-title">
      <div class="recit-explorer-intro"><p class="recit-kicker">Derrière les montants</p><h2 id="recit-explorer-title">C’est aussi<br>votre histoire.</h2><p>Une fiche de paie. Une école. Une rue.<br>Les comptes publics font partie du quotidien.</p><figure><img src="/france/logement.jpg" alt="Immeubles et vie de quartier en France" width="720" height="480" loading="lazy"><figcaption><a href="/france/credits.html">Crédits photographiques</a></figcaption></figure></div>
      <div class="recit-questions">
        <a href="/bilan/#france-sorties"><span>01 · L’argent public</span><h3>Que finance-t-on, au juste ?</h3><p>Santé, retraites, éducation. Retrouver les grands postes de dépenses.</p></a>
        <a href="/salaires/"><span>02 · Votre salaire</span><h3>Du coût employeur au net.</h3><p>Comprendre les cotisations et les prélèvements sur une fiche de paie.</p></a>
        <a href="/territoire/"><span>03 · Votre ville</span><h3>Et près de chez vous ?</h3><p>Rechercher une commune et explorer ses comptes.</p></a>
        <a href="/analyses/"><span>04 · Les dossiers</span><h3>Prendre le temps de comprendre.</h3><p>Des analyses documentées, avec leurs sources et leurs limites.</p></a>
      </div>
    </section>
    <section class="recit-mandats" id="recit-mandats" aria-labelledby="recit-mandats-title">
      <div class="recit-mandats-copy"><p class="recit-kicker">07 · Mandats · Simulation présidentielle</p><h2 id="recit-mandats-title">Un pays.<br>Cinq ans.<br>Vos choix.</h2><p>Réformer, financer, faire face aux crises. Entrez dans le bureau du pouvoir et vivez les conséquences de vos décisions.</p><a class="recit-button" href="/mandats/jouer/">Commencer mon mandat</a><p class="recit-mandats-note">Gratuit, sans compte. Les résultats de la partie sont simulés.</p><p class="recit-mandats-compteur" aria-hidden="true"><b data-parrainages-fin>500</b> / 500 parrainages · vous pouvez vous présenter.</p><svg class="recit-signature" viewBox="0 0 440 200" aria-hidden="true"><path d="M14 136 C 40 60, 70 40, 82 92 S 96 176, 120 120 C 140 70, 160 70, 166 112 C 170 140, 182 146, 198 118 C 214 90, 226 96, 228 124 C 230 150, 248 150, 262 116 C 276 82, 300 70, 304 110 C 308 150, 330 150, 352 104 C 370 66, 396 70, 426 96"/><path d="M60 168 C 160 156, 280 158, 410 150"/></svg></div>
      <figure><img src="/mandats/art/desk-france.webp" alt="Carte en relief de la France sur le bureau du pouvoir" width="1536" height="1024" loading="lazy"><figcaption>MANDATS <span>Le bureau du pouvoir</span></figcaption></figure>
    </section>
    <div class="recit-method"><p>Des chiffres que vous pouvez vérifier.</p><a href="/sources/#methode">Nos sources et notre méthode</a></div>
    ${renduQuestionsAccueil()}
    <footer class="recit-footer"><a class="recit-footer-brand" href="/">500 Signatures</a><p>Les comptes publics, à portée de main.</p><nav aria-label="Navigation de fin de page"><a href="/sources/">Sources et méthode</a><a href="/a-propos/">À propos et corrections</a><a href="/confidentialite/">Confidentialité</a><a href="https://x.com/500signaturesfr" target="_blank" rel="noreferrer noopener">500 Signatures sur X</a></nav></footer>
  </div>`;
}
