/**
 * À quelles associations va l'argent, ici.
 *
 * La fiche disait « subventions de l'État aux associations : 353 € par
 * habitant ». C'est un total, et un total ne répond pas à la question qu'on
 * vient poser — *lesquelles*. Il demande même de croire sur parole : rien ne
 * permettait au lecteur de vérifier ce que ce nombre recouvre.
 *
 * Le jaune budgétaire est le seul document public qui descende du budget de
 * l'État jusqu'au bénéficiaire nommé. Le publier sans les noms revenait à le
 * citer sans le montrer.
 *
 * **Trois réserves accompagnent la liste, et aucune n'est facultative.**
 *
 * L'exercice est **2021** : c'est la dernière parution qui nomme les
 * bénéficiaires, et cinq ans séparent ces versements du lecteur.
 *
 * La commune est celle du **siège de l'établissement**, pas celle où l'action
 * est menée : une fédération nationale domiciliée à Paris y apparaît, qu'elle
 * intervienne à Guéret ou à Mayotte. C'est pourquoi le site refuse par ailleurs
 * toute comparaison territoriale sur ce chiffre.
 *
 * Ce sont des **versements de l'État**. Les subventions de la commune, du
 * département et de la région n'y sont pas — elles se lisent dans les comptes
 * de ces collectivités, au poste « subventions aux personnes de droit privé »,
 * qui figure ailleurs dans la fiche.
 */

import type { SubventionsCommune } from "./donnees.ts";

/** Combien de bénéficiaires la liste montre avant de replier. Au-delà, ce n'est
 *  plus une réponse, c'est une annexe — Paris en compte 774. */
export const MONTRES = 12;

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Tout en millions d'euros, deux décimales, sans exception.
 *
 * Une colonne où les unités changent d'une ligne à l'autre — 10,2 M€ puis
 * 480 k€ puis 3 200 € — ne se compare pas d'un coup d'œil : il faut convertir
 * de tête à chaque ligne. Une seule unité pour toute la liste, et l'œil descend
 * la colonne sans rien recalculer. Les deux décimales font le prix de ce
 * choix : un versement de quelques milliers d'euros s'affiche « 0,00 M€ », et
 * c'est le bon ordre de grandeur — à côté de dix millions, il n'est rien.
 */
function euros(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(valeur / 1e6)
    .replace("-", "−")} M€`;
}

/** Un objet de convention fait parfois trois lignes : il est coupé sur un mot. */
export function raccourcir(texte: string, limite = 90): string {
  if (texte.length <= limite) return texte;
  const coupe = texte.slice(0, limite);
  const espace = coupe.lastIndexOf(" ");
  return `${coupe.slice(0, espace > 30 ? espace : limite)}…`;
}

function ligne(b: SubventionsCommune["beneficiaires"][number]): string {
  return `<li class="assos__ligne">
    <span class="assos__nom">${echapper(b.nom)}</span>
    <span class="assos__montant">${echapper(euros(b.montant))}</span>
    ${b.objet ? `<span class="assos__objet">${echapper(raccourcir(b.objet))}</span>` : ""}
  </li>`;
}

/**
 * Rendu pur, sans DOM : c'est lui qui est testé.
 *
 * Rien à afficher plutôt qu'un bloc vide : une commune sans association
 * subventionnée n'a pas de section « à quelles associations », elle a une
 * absence, et l'agrégat de la fiche la dit déjà.
 */
export function rendu(subventions: SubventionsCommune | undefined): string {
  if (!subventions?.beneficiaires?.length) return "";
  const liste = subventions.beneficiaires;
  const devant = liste.slice(0, MONTRES);
  const derriere = liste.slice(MONTRES);
  // La part que pèsent les premières : c'est elle qui dit si le montant de la
  // commune tient à quelques structures ou se répartit sur des centaines.
  const total = liste.reduce((somme, b) => somme + b.montant, 0);
  const cumul = devant.reduce((somme, b) => somme + b.montant, 0);
  const part = total ? Math.round((cumul / total) * 100) : 0;
  const concentration =
    derriere.length
      ? ` Les ${devant.length} premières portent ${part}${" "}% du total versé dans la commune.`
      : "";

  // « À quelles associations » appelle « au titre de quoi ». Le programme
  // budgétaire est la seule typologie du jaune qui soit un vocabulaire
  // contrôlé : les 2 362 objets de convention ne se regroupent pas.
  const programmes = subventions.programmes ?? [];
  const parProgramme = programmes.length
    ? `<details class="assos__programmes">
        <summary>Au titre de quel programme <span class="assos__compte">${
          programmes.length
        }</span></summary>
        <ol class="assos__liste">${programmes
          .map(
            (p) => `<li class="assos__ligne">
              <span class="assos__nom">${echapper(p.libelle)}</span>
              <span class="assos__montant">${echapper(euros(p.montant))}</span>
              ${p.mission ? `<span class="assos__objet">${echapper(p.mission)}</span>` : ""}
            </li>`,
          )
          .join("")}</ol>
      </details>`
    : "";

  return `<section class="assos">
    <h3>À quelles associations <span class="assos__exercice">exercice ${echapper(
      subventions.exercice,
    )}</span></h3>
    <p class="assos__reserve">Versements de l'État, comptés à l'adresse du siège du
    bénéficiaire et non là où l'action est menée.${echapper(concentration)}</p>
    <ol class="assos__liste">${devant.map(ligne).join("")}</ol>
    ${
      derriere.length
        ? `<details class="assos__suite">
            <summary>Les ${derriere.length} autres bénéficiaires</summary>
            <ol class="assos__liste">${derriere.map(ligne).join("")}</ol>
          </details>`
        : ""
    }
    ${parProgramme}
  </section>`;
}
