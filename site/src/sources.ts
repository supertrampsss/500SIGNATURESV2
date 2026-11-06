/** Page Sources : toutes les publications officielles d'où viennent les chiffres du site. */
import { SOURCES } from "./recit/calculs.ts";
import { listeSources } from "./recit/rendu.ts";
import { SOURCES_SALAIRES } from "./salaires.ts";

export function renduSources(): string {
  const recit = Object.values(SOURCES);
  const salaires = SOURCES_SALAIRES.filter(s => !recit.some(r => r.url === s.url));
  return `<nav class="sources__sommaire" aria-label="Sur cette page"><a href="#methode">Lire les chiffres</a><a href="#comptes">Comptes publics et communes</a><a href="#salaires">Salaires</a><a href="#mandats">Le jeu Mandats</a></nav>
    <section id="methode"><h2>Comment lire les chiffres</h2>
      <dl class="sources__methode">
        <dt>Année et périmètre</dt><dd>L’année ou le trimestre est indiqué auprès du chiffre. Les comptes publics rassemblent l’État, la Sécurité sociale et les collectivités. Pour comparer la France, l’Allemagne, l’Espagne et l’Italie, nous retenons la dernière année disponible pour les quatre pays sur le même indicateur.</dd>
        <dt>La base du calcul</dt><dd>« Pour 100 € de recettes », « pour 100 € de dépenses » et « pour 100 € payés par l’employeur » sont trois bases différentes, précisées dans le récit. Les montants affichés sont arrondis. Un montant par habitant est une moyenne, pas une somme payée ou reçue par chaque personne.</dd>
        <dt>Une donnée absente</dt><dd>Une étape dont les données nécessaires manquent n’est pas affichée. Une absence n’est pas remplacée par zéro. Les années disponibles peuvent différer d’un sujet à l’autre ou d’une commune à l’autre.</dd>
      </dl>
    </section>
    <section id="comptes"><h2>Comptes publics et communes</h2>
      <p>Ces publications alimentent <a href="/">le récit des finances publiques</a> et <a href="/#ville">les comptes de votre commune</a>. Pour la sécurité, le repère France n’apparaît que si la même année est disponible. Dans le portrait de la commune, les années des valeurs locales et nationales sont indiquées séparément et peuvent différer.</p>
      ${listeSources(recit)}
      <p>La <a href="https://geo.api.gouv.fr/decoupage-administratif/communes">correspondance entre codes postaux et communes</a> vient de l’API officielle de découpage administratif. Un code postal peut désigner plusieurs communes : la recherche vous laisse choisir parmi celles dont les comptes sont publiés.</p>
    </section>
    <section id="salaires"><h2>Salaires : un profil, pas une fiche de paie personnelle</h2>
      <p>La <a href="/salaires/">page Salaires</a> suit le profil OCDE d’un salarié célibataire, sans enfant, payé au salaire moyen. Les cotisations et l’impôt de ce profil ne décrivent pas toutes les situations. Le simulateur de l’Urssaf, ci-dessous, permet de renseigner un cas personnel.</p>
      <p>En complément des publications de l’OCDE et d’Eurostat listées plus haut :</p>${listeSources(salaires)}
    </section>
    <section id="mandats"><h2>Dans Mandats, distinguer les comptes et les hypothèses</h2>
      <p>Le <a href="/mandats/">jeu de simulation présidentielle Mandats</a> prend les comptes publiés comme point de départ. Les effets des décisions, les sièges, l’opinion et la tension sont des hypothèses de jeu. Les résultats d’une partie ne sont ni des statistiques observées ni une prévision sur la France.</p>
    </section>`;
}

if (typeof document !== "undefined") {
  const cible = document.querySelector<HTMLElement>("[data-sources]");
  if (cible && !cible.children.length) cible.innerHTML = renduSources();
}
