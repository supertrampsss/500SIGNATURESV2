/** Page Sources : toutes les publications officielles d'où viennent les chiffres du site. */
import { SOURCES } from "./recit/calculs.ts";
import { listeSources } from "./recit/rendu.ts";
import { SOURCES_SALAIRES } from "./salaires.ts";

export function renduSources(): string {
  const recit = Object.values(SOURCES);
  const salaires = SOURCES_SALAIRES.filter(s => !recit.some(r => r.url === s.url));
  return `<section><h2>Le récit et votre ville</h2>${listeSources(recit)}</section>
    <section><h2>Salaires</h2><p>En plus de l’OCDE et d’Eurostat, ci-dessus :</p>${listeSources(salaires)}</section>`;
}

if (typeof document !== "undefined") {
  const cible = document.querySelector<HTMLElement>("[data-sources]");
  if (cible && !cible.children.length) cible.innerHTML = renduSources();
}
