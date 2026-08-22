/**
 * Le simulateur en tunnel : une mesure à la fois, trois tampons, un verdict.
 *
 * L'atelier ligne à ligne sait tout régler et n'invite personne : quatre-vingts
 * curseurs accueillent le lecteur comme un tableur. Le tunnel retourne
 * l'expérience — les mesures viennent à lui, une par une, plein cadre, et
 * chaque tampon fait bouger le compteur, les paliers et quatre soutiens. C'est
 * la mécanique validée sur maquette : mission chiffrée, conseil des mesures,
 * verdict. L'atelier reste entier derrière un mode expert.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE TUNNEL AFFIRME, ET CE QU'IL NE CERTIFIE PAS
 * ─────────────────────────────────────────────────────────────────────────
 * **La mission est un chiffre réel** : ce qu'il reste à trouver pour que
 * chaque budget publié tienne sans emprunter, calculé par `mission.ts` sur
 * les mêmes volets que l'atelier — jamais une constante écrite ici.
 *
 * **Les effets des mesures sont des ordres de grandeur du débat public**,
 * pas des chiffres publiés au sens du reste du site. Chaque carte porte d'où
 * sort le sien, les contestés portent leur fourchette, et le pied du tunnel
 * le redit. C'est la frontière : le compteur de départ est certifié, ce
 * qu'une mesure y retranche est situé.
 *
 * **Les soutiens sont des règles de jeu.** Quatre jauges — Opinion,
 * Entreprises, Territoires, Marchés — réagissent aux tampons selon des
 * sensibilités écrites dans le catalogue. Aucune ne prétend mesurer quoi que
 * ce soit ; le pied le dit aussi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES RÈGLES DU JEU
 * ─────────────────────────────────────────────────────────────────────────
 * Un seul tampon par mesure : ADOPTER applique l'effet, REJETER est gratuit,
 * AJOURNER renvoie la mesure en fin de pile — une fois tamponnée, on ne
 * revient pas, comme en conseil. Les engagements signés au départ (les
 * contrats de `mission.ts`) RETIRENT du tunnel les mesures qu'ils couvrent,
 * dans les deux sens : « sans toucher à l'école » interdit d'y couper comme
 * d'y ajouter — un engagement n'est pas une préférence.
 *
 * Le compteur ne descend jamais sous zéro et les excédents ne s'inventent
 * pas : `max(0, trouvé)`, la règle du compteur de mission. Les paliers sont
 * ceux de `mission.ts` — mêmes seuils, mêmes noms, même « équilibre » qui ne
 * se franchit qu'à reste nul.
 */

import { millions } from "./echelle.ts";
import { CONTRATS, PALIERS } from "./mission.ts";
import { MESURES, type Mesure, type Soutien } from "./mesures.ts";

export type Tampon = "adopte" | "rejete";

export type Phase = "mission" | "conseil" | "verdict";

export type EtatTunnel = {
  phase: Phase;
  /** Les clés des contrats signés à l'écran de mission. */
  engagements: string[];
  /** La pile, dans l'ordre où elle défile — les ajournées repassent en queue. */
  ordre: string[];
  tampons: Record<string, Tampon>;
};

/** Les quatre soutiens, leur nom d'écran et leur point de départ. Marchés part
 *  bas : le déficit est leur sujet, et combler la mission les remonte. */
export const SOUTIENS: { cle: Soutien; nom: string; base: number }[] = [
  { cle: "opinion", nom: "Opinion", base: 62 },
  { cle: "entreprises", nom: "Entreprises", base: 55 },
  { cle: "territoires", nom: "Territoires", base: 58 },
  { cle: "marches", nom: "Marchés", base: 41 },
];

/** Sous ce niveau, une jauge passe à l'alerte. */
export const SEUIL_RUPTURE = 20;

const PAR_ID = new Map(MESURES.map((m) => [m.id, m]));

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** La pile pour un jeu d'engagements : les mesures couvertes disparaissent,
 *  dans l'ordre validé du catalogue. */
export function pile(engagements: readonly string[]): Mesure[] {
  return MESURES.filter((m) => !m.bloqueePar?.some((cle) => engagements.includes(cle)));
}

export function etatInitial(): EtatTunnel {
  return { phase: "mission", engagements: [], ordre: [], tampons: {} };
}

/** Signer ou dédire un engagement — possible seulement avant le conseil. */
export function basculerEngagement(etat: EtatTunnel, cle: string): EtatTunnel {
  if (etat.phase !== "mission") return etat;
  const engagements = etat.engagements.includes(cle)
    ? etat.engagements.filter((c) => c !== cle)
    : [...etat.engagements, cle];
  return { ...etat, engagements };
}

export function commencer(etat: EtatTunnel): EtatTunnel {
  return {
    ...etat,
    phase: "conseil",
    ordre: pile(etat.engagements).map((m) => m.id),
    tampons: {},
  };
}

/** La mesure sur le bureau : la première de l'ordre encore sans tampon. */
export function courante(etat: EtatTunnel): Mesure | null {
  const id = etat.ordre.find((i) => !etat.tampons[i]);
  return id ? (PAR_ID.get(id) ?? null) : null;
}

export function tamponner(etat: EtatTunnel, verdict: Tampon): EtatTunnel {
  const mesure = courante(etat);
  if (!mesure) return etat;
  const tampons = { ...etat.tampons, [mesure.id]: verdict };
  const reste = etat.ordre.some((i) => !tampons[i]);
  return { ...etat, tampons, phase: reste ? "conseil" : "verdict" };
}

export function ajourner(etat: EtatTunnel): EtatTunnel {
  const mesure = courante(etat);
  if (!mesure) return etat;
  const ordre = [...etat.ordre.filter((i) => i !== mesure.id), mesure.id];
  return { ...etat, ordre };
}

/** Le solde des tampons ADOPTÉS, en M€ — les mesures qui coûtent retranchent. */
export function trouve(etat: EtatTunnel): number {
  return etat.ordre.reduce(
    (somme, id) =>
      etat.tampons[id] === "adopte" ? somme + (PAR_ID.get(id)?.effet ?? 0) : somme,
    0,
  );
}

/** Le comblé du compteur : jamais négatif — creuser le déficit ne crée pas une
 *  dette de mission, il ramène le compteur à son départ. */
export function comble(etat: EtatTunnel): number {
  return Math.max(0, trouve(etat));
}

/** Les jauges, après les tampons. Bornées loin de 0 et de 100 : une jauge à
 *  zéro dirait « plus personne », ce qu'aucune règle de jeu ne peut affirmer. */
export function soutiens(
  etat: EtatTunnel,
  missionEuros: number,
): { cle: Soutien; nom: string; valeur: number; danger: boolean }[] {
  const missionM = missionEuros / 1e6;
  const c = comble(etat);
  return SOUTIENS.map(({ cle, nom, base }) => {
    let v = base;
    for (const id of etat.ordre) {
      if (etat.tampons[id] !== "adopte") continue;
      v += PAR_ID.get(id)?.reactions[cle] ?? 0;
    }
    // La seule règle « macro » : les Marchés remontent avec le comblé.
    if (cle === "marches" && missionM > 0) v += (c / missionM) * 60;
    const valeur = Math.max(4, Math.min(96, Math.round(v)));
    return { cle, nom, valeur, danger: valeur < SEUIL_RUPTURE };
  });
}

/** Les paliers de la mission, appliqués au comblé du tunnel. Les seuils sont
 *  ceux de `mission.ts`, en euros ; le comblé du tunnel est en M€. */
export function paliersTunnel(
  etat: EtatTunnel,
  missionEuros: number,
): { nom: string; franchi: boolean }[] {
  const combleEuros = comble(etat) * 1e6;
  const reste = Math.max(0, missionEuros - combleEuros);
  return PALIERS.map(({ nom, seuil }) => ({
    nom,
    franchi: Number.isFinite(seuil) ? combleEuros >= seuil : reste === 0,
  }));
}

/**
 * Le profil du verdict : un nom pour la forme du plan, jamais une note.
 *
 * La partition est grossière et assumée — recettes (impôts et niches),
 * économies (le reste des gains), dépenses nouvelles (les effets négatifs).
 * Un profil se lit, il ne se calcule pas au centime.
 */
export function profil(etat: EtatTunnel): { nom: string; phrase: string } {
  let recettes = 0;
  let economies = 0;
  let depenses = 0;
  for (const id of etat.ordre) {
    if (etat.tampons[id] !== "adopte") continue;
    const m = PAR_ID.get(id);
    if (!m) continue;
    if (m.effet < 0) depenses += -m.effet;
    else if (m.chapitre === "Impôts" || m.chapitre === "Entreprises et niches") recettes += m.effet;
    else economies += m.effet;
  }
  if (recettes + economies + depenses === 0) {
    return {
      nom: "L'observateur",
      phrase: "Tout rejeté, rien signé : le déficit vous a regardé passer.",
    };
  }
  if (depenses > recettes + economies) {
    return {
      nom: "La relance assumée",
      phrase: "Vous avez dépensé plus que vous n'avez trouvé — c'est un choix, il a un coût, il est affiché.",
    };
  }
  if (recettes > 2 * economies) {
    return {
      nom: "Le percepteur",
      phrase: "L'essentiel vient de recettes nouvelles : les impôts montent, la dépense tient.",
    };
  }
  if (economies > 2 * recettes) {
    return {
      nom: "Le chirurgien",
      phrase: "L'essentiel vient de coupes : la dépense recule, les impôts tiennent.",
    };
  }
  return {
    nom: "L'équilibriste",
    phrase: "Moitié recettes, moitié coupes — le plan qui fâche tout le monde un peu.",
  };
}

/* --------------------------------------------------------------------------
 * Les rendus, purs : c'est eux qui sont testés.
 * ----------------------------------------------------------------------- */

/** « 159 297 M€ », sans décimales : le compteur se lit d'un coup d'œil. */
function compteur(valeurEuros: number): string {
  return millions(Math.round(valeurEuros / 1e6) * 1e6);
}

function renduSoutiens(etat: EtatTunnel, missionEuros: number): string {
  return `<div class="tunnel__soutiens">${soutiens(etat, missionEuros)
    .map(
      (s) => `<div class="tunnel__soutien${s.danger ? " tunnel__soutien--rupture" : ""}">
        <span class="tunnel__soutien-nom">${echapper(s.nom)}</span>
        <span class="tunnel__soutien-valeur">${s.valeur} %</span>
        <span class="tunnel__jauge"><span style="width:${s.valeur}%"></span></span>
      </div>`,
    )
    .join("")}</div>`;
}

export function renduMission(etat: EtatTunnel, missionEuros: number): string {
  const chips = CONTRATS.map((contrat) => {
    const signe = etat.engagements.includes(contrat.cle);
    return `<button type="button" class="tunnel__engagement${signe ? " tunnel__engagement--signe" : ""}"
      data-engagement="${echapper(contrat.cle)}" aria-pressed="${signe}">${echapper(contrat.nom)}</button>`;
  }).join("");
  const retirees = MESURES.length - pile(etat.engagements).length;
  const n = etat.engagements.length;
  const phrase =
    n === 0
      ? "Aucun engagement — l'exercice facile. Personne ne vous croira."
      : n === 1
        ? `1 engagement signé — ${retirees} mesures quittent la pile. L'exercice intéressant commence à deux.`
        : `${n} engagements signés — ${retirees} mesures quittent la pile. Chacun ferme des portes, c'est le jeu.`;
  return `
    <div class="tunnel__mission">
      <p class="tunnel__surtitre">Votre mission</p>
      <p class="tunnel__compteur-geant">${compteur(missionEuros)}</p>
      <p class="tunnel__chapeau">C'est ce qui manque aux budgets publics pour tenir sans
        emprunter — le vrai compteur, calculé sur les comptes publiés. Toute la scène
        politique va défiler : à vous de tamponner.</p>
      <p class="tunnel__surtitre">Signez vos engagements — chacun retire ses mesures de la pile</p>
      <div class="tunnel__engagements">${chips}</div>
      <p class="tunnel__note">${echapper(phrase)}</p>
      <button type="button" class="tunnel__commencer" data-action="commencer">Prendre mes fonctions&nbsp;&#8594;</button>
    </div>`;
}

function renduChapitres(etat: EtatTunnel): string {
  const enJeu = etat.ordre.map((id) => PAR_ID.get(id)!).filter(Boolean);
  const actuelle = courante(etat);
  const chapitres: string[] = [];
  for (const m of enJeu) if (!chapitres.includes(m.chapitre)) chapitres.push(m.chapitre);
  return `<div class="tunnel__chapitres" aria-label="Chapitres de la pile">
    <p class="tunnel__surtitre">Tous les postes y passent</p>
    ${chapitres
      .map((chapitre) => {
        const siens = enJeu.filter((m) => m.chapitre === chapitre);
        const faits = siens.filter((m) => etat.tampons[m.id]).length;
        const actif = actuelle?.chapitre === chapitre;
        return `<div class="tunnel__chapitre${actif ? " tunnel__chapitre--actif" : ""}">
          <span>${echapper(chapitre)}</span><span>${faits}/${siens.length}</span>
        </div>`;
      })
      .join("")}
  </div>`;
}

function renduJournal(etat: EtatTunnel): string {
  const faits = etat.ordre.filter((id) => etat.tampons[id]).slice(-6).reverse();
  const lignes = faits
    .map((id) => {
      const m = PAR_ID.get(id)!;
      const adoptee = etat.tampons[id] === "adopte";
      return `<div class="tunnel__tampon${adoptee ? " tunnel__tampon--adopte" : ""}">
        <span>${echapper(m.titre)}</span>
        <b>${adoptee ? echapper(millions(m.effet * 1e6)) : "rejetée"}</b>
      </div>`;
    })
    .join("");
  return `<div class="tunnel__journal" aria-label="Vos derniers tampons">
    <p class="tunnel__surtitre">Vos tampons</p>
    ${lignes || '<p class="tunnel__note">Aucun encore — le premier dossier attend.</p>'}
  </div>`;
}

export function renduConseil(etat: EtatTunnel, missionEuros: number): string {
  const mesure = courante(etat);
  if (!mesure) return "";
  const resteEuros = Math.max(0, missionEuros - comble(etat) * 1e6);
  const faits = etat.ordre.filter((id) => etat.tampons[id]).length;
  const paliers = paliersTunnel(etat, missionEuros);
  const franchis = paliers.filter((p) => p.franchi);
  const fanfare =
    resteEuros === 0
      ? "L'équilibre. Personne n'y croyait."
      : franchis.length
        ? `Palier franchi : ${franchis[franchis.length - 1]!.nom}`
        : "";
  const reactions = SOUTIENS.filter(({ cle }) => mesure.reactions[cle])
    .map(({ cle, nom }) => {
      const delta = mesure.reactions[cle]!;
      return `<span class="tunnel__reaction">${echapper(nom)}&nbsp;${delta > 0 ? "+" : "−"}${Math.abs(delta)}</span>`;
    })
    .join("");
  return `
    <div class="tunnel__hud">
      <div class="tunnel__hud-reste">
        <p class="tunnel__surtitre">Reste à trouver</p>
        <p class="tunnel__compteur">${compteur(resteEuros)}</p>
      </div>
      <div class="tunnel__hud-pile">
        <p class="tunnel__surtitre">Conseil des mesures · ${faits} / ${etat.ordre.length} tamponnées</p>
        <div class="tunnel__jalons">${etat.ordre
          .map((id) => {
            const t = etat.tampons[id];
            return `<span class="${t === "adopte" ? "tunnel__jalon--adopte" : t ? "tunnel__jalon--rejete" : ""}"></span>`;
          })
          .join("")}</div>
        <p class="tunnel__fanfare">${echapper(fanfare)}</p>
      </div>
      ${renduSoutiens(etat, missionEuros)}
    </div>
    <div class="tunnel__scene">
      ${renduChapitres(etat)}
      <article class="tunnel__carte" aria-live="polite">
        <header class="tunnel__carte-tete">
          <span class="tunnel__carte-chapitre">${echapper(mesure.chapitre)}</span>
          <span class="tunnel__carte-numero">mesure ${faits + 1} / ${etat.ordre.length}</span>
        </header>
        <h3 class="tunnel__carte-titre">${echapper(mesure.titre)}</h3>
        <p class="tunnel__carte-detail">${echapper(mesure.detail)}</p>
        <div class="tunnel__carte-effet">
          <div>
            <p class="tunnel__surtitre">${mesure.effet >= 0 ? "Si vous l'adoptez, vous trouvez" : "Si vous l'adoptez, ça coûte"}</p>
            <p class="tunnel__montant">${echapper(millions(mesure.effet * 1e6))}${
              mesure.precision ? ` <small>${echapper(mesure.precision)}</small>` : ""
            }</p>
          </div>
          <div class="tunnel__reactions">${reactions}</div>
        </div>
        <div class="tunnel__tampons">
          <button type="button" class="tunnel__rejeter" data-geste="rejeter">Rejeter</button>
          <button type="button" class="tunnel__adopter" data-geste="adopter">Adopter</button>
        </div>
        <button type="button" class="tunnel__ajourner" data-geste="ajourner">Ajourner — elle reviendra en fin de pile</button>
      </article>
      ${renduJournal(etat)}
    </div>`;
}

export function renduVerdict(etat: EtatTunnel, missionEuros: number): string {
  const combleM = comble(etat);
  const resteEuros = Math.max(0, missionEuros - combleM * 1e6);
  const p = profil(etat);
  const paliers = paliersTunnel(etat, missionEuros);
  const nFranchis = paliers.filter((x) => x.franchi).length;
  const adoptees = etat.ordre
    .filter((id) => etat.tampons[id] === "adopte")
    .map((id) => PAR_ID.get(id)!)
    .sort((a, b) => Math.abs(b.effet) - Math.abs(a.effet))
    .slice(0, 5);
  const gestes = adoptees
    .map(
      (m) => `<div class="tunnel__tampon tunnel__tampon--adopte">
        <span>${echapper(m.titre)}</span><b>${echapper(millions(m.effet * 1e6))}</b>
      </div>`,
    )
    .join("");
  const rupture = soutiens(etat, missionEuros).find((s) => s.danger);
  return `
    <div class="tunnel__verdict">
      <p class="tunnel__surtitre">Votre verdict</p>
      <h3 class="tunnel__verdict-nom">${echapper(p.nom)}</h3>
      <p class="tunnel__chapeau">${echapper(p.phrase)}${
        rupture ? ` ${echapper(rupture.nom)} est au bord de la rupture.` : ""
      }</p>
      <p class="tunnel__verdict-bilan">
        <strong>${echapper(millions(combleM * 1e6))}</strong> trouvés sur les
        <strong>${compteur(missionEuros)}</strong> qui manquent ·
        ${nFranchis} palier${nFranchis > 1 ? "s" : ""} sur ${paliers.length}${
          resteEuros === 0 ? " · l'équilibre" : ""
        }</p>
      ${gestes ? `<div class="tunnel__verdict-gestes"><p class="tunnel__surtitre">Vos plus gros gestes</p>${gestes}</div>` : ""}
      ${renduSoutiens(etat, missionEuros)}
      <div class="tunnel__verdict-boutons">
        <button type="button" class="tunnel__adopter" data-action="copier">Copier le bilan</button>
        <button type="button" class="tunnel__rejeter" data-action="rejouer">Rejouer</button>
      </div>
    </div>`;
}

/** Le texte du bilan à coller ailleurs — la version défi du verdict. */
export function bilanTexte(etat: EtatTunnel, missionEuros: number): string {
  const p = profil(etat);
  const nFranchis = paliersTunnel(etat, missionEuros).filter((x) => x.franchi).length;
  return (
    `${p.nom} — ${millions(comble(etat) * 1e6)} trouvés sur les ${compteur(missionEuros)} ` +
    `qui manquent aux budgets publics (${nFranchis} palier${nFranchis > 1 ? "s" : ""} sur 4). ` +
    `Faites mieux : ${location.origin}/simulateur`
  );
}

function renduPied(): string {
  return `<p class="tunnel__source">La mission est calculée sur les budgets publiés. Les effets
    des mesures sont des ordres de grandeur du débat public — lois de finances, rapports
    parlementaires, chiffrages d'instituts —, affichés avec leurs réserves. Les réactions des
    soutiens sont des règles du jeu, pas des mesures.
    <button type="button" class="tunnel__expert" data-action="expert">Régler ligne à ligne
    (l'atelier expert)</button></p>`;
}

export function rendu(etat: EtatTunnel, missionEuros: number): string {
  const corps =
    etat.phase === "mission"
      ? renduMission(etat, missionEuros)
      : etat.phase === "conseil"
        ? renduConseil(etat, missionEuros)
        : renduVerdict(etat, missionEuros);
  return `<div class="tunnel__cadre">${corps}${renduPied()}</div>`;
}

/**
 * Monter le tunnel dans son cadre. Un seul écouteur, délégué : le cadre est
 * repeint à chaque tampon, et des écouteurs posés sur les boutons repartiraient
 * avec eux.
 */
export function afficherTunnel(
  cadre: HTMLElement,
  options: { missionEuros: number; surModeExpert: () => void },
): void {
  let etat = etatInitial();
  const peindre = () => {
    cadre.innerHTML = rendu(etat, options.missionEuros);
  };
  cadre.addEventListener("click", (evenement) => {
    const cible = (evenement.target as HTMLElement).closest<HTMLElement>(
      "[data-geste], [data-action], [data-engagement]",
    );
    if (!cible) return;
    const engagement = cible.dataset.engagement;
    if (engagement) {
      etat = basculerEngagement(etat, engagement);
      return peindre();
    }
    const geste = cible.dataset.geste;
    if (geste === "adopter" || geste === "rejeter") {
      etat = tamponner(etat, geste === "adopter" ? "adopte" : "rejete");
      return peindre();
    }
    if (geste === "ajourner") {
      etat = ajourner(etat);
      return peindre();
    }
    if (cible.dataset.action === "commencer") {
      etat = commencer(etat);
      return peindre();
    }
    if (cible.dataset.action === "rejouer") {
      etat = etatInitial();
      return peindre();
    }
    if (cible.dataset.action === "expert") return options.surModeExpert();
    if (cible.dataset.action === "copier") {
      const texte = bilanTexte(etat, options.missionEuros);
      void navigator.clipboard?.writeText(texte).then(
        () => {
          cible.textContent = "Copié — collez-le où vous défiez";
        },
        () => {
          // Presse-papiers refusé (permissions, contexte non sécurisé) : le
          // texte reste lisible dans une invite, plutôt que rien.
          window.prompt("Votre bilan — copiez-le :", texte);
        },
      );
    }
  });
  peindre();
}
