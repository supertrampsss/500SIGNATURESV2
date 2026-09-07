import { icon } from "./mandats/icons.ts";

/** The approved, schematic civic scene: links lead to the full dossiers below. */
export function civicScene(): string {
  return `<div class="civic-scene" aria-label="Explorer les services publics">
    <div class="civic-scene__city"><div class="civic-scene__ground" aria-hidden="true"></div>
      <a class="civic-scene__building" href="#arbitrages-services" aria-label="Santé et services publics">${icon("people")}<span>Santé</span></a>
      <a class="civic-scene__building" href="#arbitrages-generation" aria-label="Retraites et générations">${icon("finance")}<span>Retraites</span></a>
      <a class="civic-scene__building" href="#arbitrages-travail" aria-label="Travail et entreprises">${icon("journal")}<span>Travail</span></a>
      <div class="civic-scene__orb" aria-hidden="true"></div>
    </div><p>Un pays. Des choix.</p>
  </div>`;
}
