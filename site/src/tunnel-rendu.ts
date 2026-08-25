/** Les rendus purs du simulateur en tunnel. */

import { millions } from "./echelle.ts";
import { dilemmeDe } from "./dilemmes.ts";
import { CONTRATS } from "./mission.ts";
import { MESURES, type Soutien } from "./mesures.ts";
import {
  CRISES,
  REPORTS_GRATUITS,
  SOUTIENS,
  TELEX,
  comble,
  courante,
  decorations,
  mesureParId,
  missionRestante,
  paliersTunnel,
  profil,
  soutiens,
  type EtatTunnel,
} from "./tunnel-modele.ts";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
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
  const mode = `<div class="tunnel__modes" role="group" aria-label="Mode de séance">
    <button type="button" class="tunnel__mode${etat.mode === "express" ? " tunnel__mode--actif" : ""}" data-action="mode-express" aria-pressed="${etat.mode === "express"}">Conseil de crise · 15 mesures · environ 5 minutes</button>
    <button type="button" class="tunnel__mode${etat.mode === "integral" ? " tunnel__mode--actif" : ""}" data-action="mode-integral" aria-pressed="${etat.mode === "integral"}">Conseil intégral · 96 mesures · environ 25 minutes</button>
  </div>`;
  return `
    <div class="tunnel__mission">
      <div class="tunnel__mission-intro">
        <h1 class="tunnel__mission-titre">Le déficit à combler</h1>
        <p class="tunnel__compteur-geant">${compteur(missionEuros)}</p>
        <p class="tunnel__chapeau">Le déficit mesure ce que les administrations publiques dépensent au-delà de leurs recettes sur une année.</p>
        <p class="tunnel__mission-bilan">À la fin, vous obtenez un bilan de votre budget, de votre mandat et de vos soutiens.</p>
      </div>
      <div class="tunnel__mission-actions">
        ${mode}
        <button type="button" class="tunnel__commencer" data-action="commencer">Prendre mes fonctions&nbsp;&#8594;</button>
      </div>
    </div>`;
}

/** Les pastilles d'un jeu de réactions : « Opinion −4 · Marchés +5 ». */
function pastilles(jeu: Partial<Record<Soutien, number>>): string {
  return SOUTIENS.filter(({ cle }) => jeu[cle])
    .map(({ cle, nom }) => {
      const delta = jeu[cle]!;
      return `<span class="tunnel__reaction">${echapper(nom)}&nbsp;${delta > 0 ? "+" : "−"}${Math.abs(delta)}</span>`;
    })
    .join("");
}

function reactionsEnPartie(jeu: Partial<Record<Soutien, number>>, depart: number, nombre: number): Partial<Record<Soutien, number>> {
  return Object.fromEntries(
    SOUTIENS.filter(({ cle }) => jeu[cle]).slice(depart, depart + nombre).map(({ cle }) => [cle, jeu[cle]!]),
  ) as Partial<Record<Soutien, number>>;
}

function renduTelex(id: string): string {
  const t = TELEX.find((x) => x.id === id);
  if (!t) return "";
  return `
    <article class="tunnel-evenement--persistant tunnel__carte tunnel__carte--telex" aria-live="assertive">
      <header class="tunnel__carte-tete">
        <span class="tunnel__carte-chapitre">Télex · entre deux mesures</span>
      </header>
      <h3 class="tunnel__carte-titre">${echapper(t.nom)}</h3>
      <p class="tunnel__carte-detail">${echapper(t.texte)}</p>
      ${
        t.issues
          ? `<div class="tunnel__choix">${t.issues
              .map(
                (issue) => `<div class="tunnel__issue">
                  <button type="button" class="tunnel__adopter" data-telex="${echapper(issue.cle)}">${echapper(issue.bouton)}</button>
                  <p class="tunnel__prix">${
                    issue.effet !== 0
                      ? `<span class="tunnel__reaction">${echapper(millions(Math.abs(issue.effet) * 1e6))} de plus à trouver</span>`
                      : ""
                  }${pastilles(issue.soutiens)}</p>
                </div>`,
              )
              .join("")}</div>`
          : t.effet !== 0
          ? `<div class="tunnel__carte-effet"><div>
              <p class="tunnel__surtitre">Ça vous coûte</p>
              <p class="tunnel__montant">${echapper(millions(Math.abs(t.effet) * 1e6))} de plus à trouver</p>
            </div></div>`
          : ""
      }
      ${
        t.issues
          ? ""
          : `<div class="tunnel__tampons" style="grid-template-columns: 1fr">
        <button type="button" class="tunnel__adopter" data-action="poursuivre">Poursuivre</button>
      </div>`
      }
    </article>`;
}

export type BilanVerdict = {
  trouve: number;
  reste: number;
  soutiens: ReturnType<typeof soutiens>;
  engagements: { cle: string; nom: string; statut: "tenue" | "impossibilite_detectee" }[];
  crises: EtatTunnel["crisesVues"];
  reports: number;
  gestes: { id: string; titre: string; effet: number; montantAbsolu: number }[];
  profil: ReturnType<typeof profil>;
};

/** Les faits du mandat, prêts à être rendus ou repris par une autre vue. */
export function bilanVerdict(etat: EtatTunnel, missionEuros: number): BilanVerdict {
  const gestes = etat.ordre
    .filter((id) => etat.tampons[id] === "adopte")
    .map((id) => mesureParId(id))
    .filter((mesure): mesure is NonNullable<typeof mesure> => mesure !== undefined)
    .sort((a, b) => Math.abs(b.effet) - Math.abs(a.effet))
    .slice(0, 3)
    .map((mesure) => ({
      id: mesure.id,
      titre: mesure.titre,
      effet: mesure.effet,
      montantAbsolu: Math.abs(mesure.effet),
    }));
  const engagements = CONTRATS.filter((contrat) => etat.engagements.includes(contrat.cle)).map((contrat) => ({
    cle: contrat.cle,
    nom: contrat.nom,
    statut: etat.ordre.some(
      (id) => etat.tampons[id] === "adopte" && mesureParId(id)?.bloqueePar?.includes(contrat.cle),
    )
      ? "impossibilite_detectee" as const
      : "tenue" as const,
  }));
  return {
    trouve: comble(etat),
    reste: missionRestante(etat, missionEuros),
    soutiens: soutiens(etat, missionEuros),
    engagements,
    crises: [...etat.crisesVues],
    reports: etat.reports,
    gestes,
    profil: profil(etat),
  };
}

function renduCrise(soutien: Soutien): string {
  const crise = CRISES.find((x) => x.soutien === soutien);
  if (!crise) return "";
  return `
    <article class="tunnel-evenement--persistant tunnel__carte tunnel__carte--telex" aria-live="assertive">
      <header class="tunnel__carte-tete">
        <span class="tunnel__carte-chapitre">Crise · décision immédiate</span>
      </header>
      <h3 class="tunnel__carte-titre">${echapper(crise.nom)}</h3>
      <p class="tunnel__carte-detail">${echapper(crise.texte)}</p>
      <div class="tunnel__choix">${crise.issues
        .map(
          (issue) => `<div class="tunnel__issue">
            <button type="button" class="tunnel__adopter" data-crise="${echapper(issue.cle)}">${echapper(issue.bouton)}</button>
            <p class="tunnel__prix">${
              issue.effet !== 0
                ? `<span class="tunnel__reaction">${echapper(millions(Math.abs(issue.effet) * 1e6))} de plus à trouver</span>`
                : "<span class=\"tunnel__reaction\">Aucun coût budgétaire immédiat</span>"
            }${pastilles(issue.soutiens)}</p>
          </div>`,
        )
        .join("")}</div>
    </article>`;
}

/** La réglette de séance : le chiffre et l'avancement restent lisibles sans HUD. */
export function renduBarreEtat(etat: EtatTunnel, missionEuros: number): string {
  const resteEuros = missionRestante(etat, missionEuros);
  const faits = etat.ordre.filter((id) => etat.tampons[id]).length;
  const parActe = Math.max(1, Math.ceil(etat.ordre.length / 3));
  const acte = Math.min(3, Math.floor(faits / parActe) + 1);
  const dernierId = etat.ordre.filter((id) => etat.tampons[id]).at(-1);
  const dernier = dernierId ? mesureParId(dernierId) : undefined;
  const statut = dernierId ? etat.tampons[dernierId] : undefined;
  return `<section class="tunnel__etat-compact" aria-label="État du conseil">
    <p class="tunnel__etat-acte">Acte ${acte} <span aria-hidden="true">·</span> ${faits} / ${etat.ordre.length}</p>
    <p class="tunnel__etat-reste"><span>Reste à trouver</span> <strong>${compteur(resteEuros)}</strong></p>
    ${renduSoutiens(etat, missionEuros)}
    ${
      dernier
        ? `<p class="tunnel__etat-dernier">Dernier tampon : ${echapper(dernier.titre)} · ${
            statut === "exclue" ? "incompatible" : statut === "adopte" ? "adoptée" : "rejetée"
          }</p>`
        : ""
    }
  </section>`;
}

function renduOptionDecision(
  camp: "adopter" | "rejeter",
  libelle: string,
  gagnants: readonly string[],
  perdants: readonly string[],
  montant: string,
  reactions: Partial<Record<Soutien, number>>,
  impact: "positif" | "negatif" | "neutre",
): string {
  const apercuReactions = reactionsEnPartie(reactions, 0, 2);
  return `<section class="tunnel-decision__option tunnel__camp tunnel__camp--${camp} tunnel__camp--impact-${impact}">
    <h4 class="tunnel__camp-titre">${echapper(libelle)}</h4>
    <p class="tunnel__camp-montant">${montant}</p>
    <p class="tunnel-decision__politique">Impact : ${echapper(perdants.join(", ") || gagnants.join(", ") || "à préciser")}</p>
    <div class="tunnel__reactions" aria-label="Réactions des soutiens">${pastilles(apercuReactions)}</div>
  </section>`;
}

/** Les deux conséquences d'un vote, sans faire porter le sens par la couleur. */
export function renduComparaison(mesure: (typeof MESURES)[number], dilemme = dilemmeDe(mesure.id)): string {
  const adopter = dilemme?.adopter ?? {
    libelle: "Adopter",
    argument: mesure.detail,
    gagnants: [],
    perdants: [],
  };
  const rejeter = dilemme?.rejeter ?? {
    libelle: "Rejeter",
    argument: "Le budget et les soutiens restent soumis aux règles de la séance.",
    gagnants: [],
    perdants: [],
  };
  const montant = `${mesure.effet >= 0 ? "Vous trouvez " : "Vous engagez "}${echapper(millions(mesure.effet * 1e6))}`;
  const reactionsAdopter = mesure.reactions;
  const reactionsRejeter = mesure.rejet ?? {};
  const preuveOption = (
    libelle: string,
    gagnants: readonly string[],
    perdants: readonly string[],
    reactions: Partial<Record<Soutien, number>>,
  ) => `<section class="tunnel-decision__preuve-option">
      <h4>${echapper(libelle)}</h4>
      <dl>
        <div><dt>Gagnants</dt><dd>${echapper(gagnants.join(", ") || "Aucun indiqué")}</dd></div>
        <div><dt>Perdants</dt><dd>${echapper(perdants.join(", ") || "Aucun indiqué")}</dd></div>
      </dl>
      <div class="tunnel__reactions" aria-label="Réactions complémentaires">${pastilles(reactionsEnPartie(reactions, 2, SOUTIENS.length)) || '<span class="tunnel__reaction">Aucune réaction complémentaire</span>'}</div>
    </section>`;
  return `<div class="tunnel__comparaison">
    ${renduOptionDecision("adopter", adopter.libelle, adopter.gagnants, adopter.perdants, montant, reactionsAdopter, mesure.effet > 0 ? "positif" : mesure.effet < 0 ? "negatif" : "neutre")}
    ${renduOptionDecision(
      "rejeter",
      rejeter.libelle,
      rejeter.gagnants,
      rejeter.perdants,
      mesure.rejet ? "Rejeter a aussi un prix politique." : "Le rejet ne modifie pas le compteur.",
      reactionsRejeter,
      "neutre",
    )}
    <details class="tunnel-decision__details" data-details="preuve">
      <summary>Voir les conséquences et le chiffrage</summary>
      <div class="tunnel-decision__preuve">
        ${preuveOption(adopter.libelle, adopter.gagnants, adopter.perdants, reactionsAdopter)}
        ${preuveOption(rejeter.libelle, rejeter.gagnants, rejeter.perdants, reactionsRejeter)}
        ${mesure.precision ? `<p class="tunnel-decision__source">Chiffrage : ${echapper(mesure.precision)}</p>` : ""}
      </div>
    </details>
  </div>`;
}

function renduMissionDecision(etat: EtatTunnel, missionEuros: number): string {
  const faits = etat.ordre.filter((id) => etat.tampons[id]).length;
  const acte = Math.min(3, Math.floor(faits / Math.max(1, Math.ceil(etat.ordre.length / 3))) + 1);
  return `<div class="tunnel-decision__mission" aria-label="Déficit et progression">
    <p><span>Reste à trouver</span><strong>${compteur(missionRestante(etat, missionEuros))}</strong></p>
    <p>Acte ${acte} <span aria-hidden="true">·</span> ${faits} / ${etat.ordre.length}</p>
  </div>`;
}

export function renduConseil(etat: EtatTunnel, missionEuros: number): string {
  const mesure = courante(etat);
  const dilemme = mesure ? dilemmeDe(mesure.id) : undefined;
  const faits = etat.ordre.filter((id) => etat.tampons[id]).length;
  const evenement = etat.telexEnCours
    ? renduTelex(etat.telexEnCours)
    : etat.criseEnCours
      ? renduCrise(etat.criseEnCours)
      : mesure
        ? `<article class="tunnel__carte" aria-live="polite">
        ${etat.chrono ? '<span class="tunnel__chrono" aria-hidden="true"></span>' : ""}
        <header class="tunnel__carte-tete">
          <span class="tunnel__carte-chapitre">${echapper(mesure.chapitre)}</span>
          <span class="tunnel__carte-numero">Dossier ${faits + 1} / ${etat.ordre.length}</span>
        </header>
        <h3 class="tunnel__carte-titre">${echapper(dilemme?.question ?? mesure.titre)}</h3>
        <p class="tunnel__carte-detail">${echapper(dilemme?.contradiction ?? mesure.detail)}</p>
        ${renduComparaison(mesure, dilemme)}
        ${
          etat.reports >= REPORTS_GRATUITS - 1
            ? `<p class="tunnel__alerte" role="status">${etat.reports} report${etat.reports > 1 ? "s" : ""} : au-delà de ${REPORTS_GRATUITS}, chacun coûte 1 point à chaque soutien.</p>`
            : ""
        }
        <div class="tunnel__actions-fixes">
          <button type="button" class="tunnel__adopter" data-geste="adopter">${echapper(dilemme?.adopter.libelle ?? "Adopter")}</button>
          <button type="button" class="tunnel__rejeter" data-geste="rejeter">${echapper(dilemme?.rejeter.libelle ?? "Rejeter")}</button>
        </div>
        <div class="tunnel__seconds">
          <button type="button" class="tunnel__ajourner" data-geste="ajourner">Ajourner : elle reviendra en fin de pile</button>
          ${etat.historique.length ? '<button type="button" class="tunnel__ajourner" data-geste="annuler">&#8592; Annuler le dernier tampon</button>' : ""}
        </div>
      </article>`
        : "";
  return `
    <div class="tunnel__scene" aria-label="Salle de crise">
      ${renduMissionDecision(etat, missionEuros)}
      <section class="tunnel__dilemme" aria-label="Dilemme en cours">
        ${evenement}
      </section>
    </div>`;
}

export function renduVerdict(
  etat: EtatTunnel,
  missionEuros: number,
  collectionner: (gagnees: readonly { id: string }[]) => string[] = () => [],
): string {
  const bilan = bilanVerdict(etat, missionEuros);
  const combleM = bilan.trouve;
  const resteEuros = bilan.reste;
  const p = bilan.profil;
  const paliers = paliersTunnel(etat, missionEuros);
  const nFranchis = paliers.filter((x) => x.franchi).length;
  const gestes = bilan.gestes
    .map(
      (m) => `<div class="tunnel__tampon tunnel__tampon--adopte">
        <span>${echapper(m.titre)}</span><b>${echapper(millions(m.effet * 1e6))}</b>
      </div>`,
    )
    .join("");
  const rupture = bilan.soutiens.find((s) => s.danger);
  // La collection reste alimentée pour les parties existantes, sans devenir un
  // second verdict qui détournerait du résultat du mandat.
  collectionner(decorations(etat, missionEuros));
  // Le duel : le comblé contre celui du défi. Aucun qualificatif de plus —
  // « battu » et « manqué » disent le fait, les nombres disent l'écart.
  const duel = etat.defi
    ? `<p class="tunnel__duel">${
        combleM > etat.defi.comble
          ? "Défi <strong>battu</strong>"
          : combleM === etat.defi.comble
            ? "Défi à <strong>égalité</strong>"
            : "Défi <strong>manqué</strong>"
      } : ${echapper(millions(combleM * 1e6))} contre ${echapper(millions(etat.defi.comble * 1e6))}.</p>`
    : "";
  return `
    <div class="tunnel__verdict">
      <header class="verdict__resultat tunnel__verdict-tete">
        <p class="tunnel__surtitre">Bilan du mandat</p>
        <h2 class="tunnel__verdict-chiffre"><strong>${echapper(millions(combleM * 1e6))}</strong> trouvés</h2>
        <p class="tunnel__verdict-paliers">Objectif : ${echapper(millions(missionEuros))}${resteEuros === 0 ? " · équilibre atteint" : ` · reste ${echapper(millions(resteEuros))}`}</p>
        <p class="tunnel__verdict-paliers">${nFranchis} / ${paliers.length} paliers franchis.</p>
        ${duel}
      </header>
      <section class="verdict__mandat tunnel__mandat" aria-labelledby="tunnel-mandat">
        <p id="tunnel-mandat" class="tunnel__surtitre">Votre mandat</p>
        <h3 class="tunnel__verdict-nom">${echapper(p.nom)}</h3>
        <p class="tunnel__chapeau">${echapper(p.phrase)}</p>
      </section>
      <section class="verdict__gestes tunnel__verdict-gestes" aria-labelledby="tunnel-gestes">
        <p id="tunnel-gestes" class="tunnel__surtitre">Vos choix décisifs</p>
        ${gestes || '<p class="tunnel__note">Aucun geste adopté : le budget reste à construire.</p>'}
      </section>
      <section class="verdict__stabilite tunnel__stabilite" aria-labelledby="tunnel-stabilite">
        <p id="tunnel-stabilite" class="tunnel__surtitre">Soutiens et conséquences</p>
        ${renduSoutiens(etat, missionEuros)}
        ${rupture ? `<p class="tunnel__note">Alerte : ${echapper(rupture.nom)} est au bord de la rupture.</p>` : ""}
        <p class="tunnel__note">${bilan.crises.length
          ? `${bilan.crises.length} crise${bilan.crises.length > 1 ? "s" : ""} traversée${bilan.crises.length > 1 ? "s" : ""}`
          : "Aucune crise"} · ${bilan.reports} report${bilan.reports > 1 ? "s" : ""}.</p>
      </section>
      <div class="verdict__actions tunnel__verdict-boutons">
        <button type="button" class="tunnel__adopter" data-action="revanche">Rejouer</button>
        <button type="button" class="tunnel__rejeter" data-action="expert">Comparer mon bilan</button>
        <button type="button" class="tunnel__rejeter" data-action="partager">Partager mon bilan</button>
      </div>
      <details class="verdict__details">
        <summary>Voir les ${etat.historique.length} décisions</summary>
        <ol>${etat.historique.map((choix) => {
          const mesure = mesureParId(choix.id);
          return `<li>${echapper(mesure?.titre ?? choix.id)} — ${etat.tampons[choix.id] === "adopte" ? "adoptée" : "rejetée"}</li>`;
        }).join("")}</ol>
      </details>
    </div>`;
}
export function rendu(
  etat: EtatTunnel,
  missionEuros: number,
  collectionner: (gagnees: readonly { id: string }[]) => string[] = () => [],
): string {
  const corps =
    etat.phase === "mission"
      ? renduMission(etat, missionEuros)
      : etat.phase === "conseil"
        ? renduConseil(etat, missionEuros)
        : renduVerdict(etat, missionEuros, collectionner);
  // La porte de sortie du plein écran : le seul lien vers le site quand le
  // tunnel occupe tout l'écran. Invisible hors plein écran (style.css).
  return `<div class="tunnel__cadre"><a class="tunnel__quitter" href="/">&#8592;&nbsp;Quitter le conseil</a>${corps}</div>`;
}
