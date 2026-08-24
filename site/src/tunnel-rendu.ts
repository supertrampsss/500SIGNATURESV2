/** Les rendus purs du simulateur en tunnel. */

import { millions } from "./echelle.ts";
import { dilemmeDe } from "./dilemmes.ts";
import { CONTRATS } from "./mission.ts";
import { MESURES, type Soutien } from "./mesures.ts";
import {
  CHRONO_SECONDES,
  CRISES,
  DECORATIONS,
  REPORTS_GRATUITS,
  SOUTIENS,
  TELEX,
  comble,
  courante,
  decorations,
  mesureParId,
  missionRestante,
  paliersTunnel,
  pile,
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
  const chips = CONTRATS.map((contrat) => {
    const signe = etat.engagements.includes(contrat.cle);
    return `<button type="button" class="tunnel__engagement${signe ? " tunnel__engagement--signe" : ""}"
      data-engagement="${echapper(contrat.cle)}" aria-pressed="${signe}">${echapper(contrat.nom)}</button>`;
  }).join("");
  const retirees = MESURES.length - pile(etat.engagements).length;
  const n = etat.engagements.length;
  const phrase =
    n === 0
      ? "Aucun engagement : l'exercice facile. Personne ne vous croira."
      : n === 1
        ? `1 engagement signé : ${retirees} mesures quittent la pile. L'exercice intéressant commence à deux.`
        : `${n} engagements signés : ${retirees} mesures quittent la pile. Chacun ferme des portes, c'est le jeu.`;
  const defi = etat.defi
    ? `<p class="tunnel__defi">Défi reçu&nbsp;: quelqu'un a trouvé
        <strong>${echapper(millions(etat.defi.comble * 1e6))}</strong>. Faites mieux.
        Ses engagements sont pré-signés.</p>`
    : "";
  const mode =
    etat.mode === "express"
      ? `<button type="button" class="tunnel__engagement" data-action="mode-integral">Conseil intégral · 96 mesures</button>`
      : `<button type="button" class="tunnel__engagement" data-action="mode-express">Campagne express · 15 mesures</button>`;
  return `
    <div class="tunnel__mission">
      <p class="tunnel__surtitre">Votre mission</p>
      <p class="tunnel__compteur-geant">${compteur(missionEuros)}</p>
      <p class="tunnel__chapeau">C'est ce qui manque aux budgets publics pour tenir sans
        emprunter : le vrai compteur, calculé sur les comptes publiés. Toute la scène
        politique va défiler : à vous de tamponner.</p>
      <p class="tunnel__surtitre">Signez vos engagements : chacun retire ses mesures de la pile</p>
      <div class="tunnel__engagements">${chips}</div>
      <p class="tunnel__note">${echapper(phrase)}</p>
      <button type="button" class="tunnel__engagement${etat.chrono ? " tunnel__engagement--signe" : ""}"
        data-action="chrono" aria-pressed="${etat.chrono ? "true" : "false"}">Conseil de crise : ${CHRONO_SECONDES}&#8239;s par mesure</button>
      ${mode}
      ${defi}
      <button type="button" class="tunnel__commencer" data-action="commencer">Prendre mes fonctions&nbsp;&#8594;</button>
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

function renduTelex(id: string): string {
  const t = TELEX.find((x) => x.id === id);
  if (!t) return "";
  return `
    <article class="tunnel__carte tunnel__carte--telex" aria-live="assertive">
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
    <article class="tunnel__carte tunnel__carte--telex" aria-live="assertive">
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

function renduCote(
  camp: "adopter" | "rejeter",
  libelle: string,
  argument: string,
  gagnants: readonly string[],
  perdants: readonly string[],
  montant: string,
  reactions: string,
  impact: "positif" | "negatif" | "neutre",
): string {
  const titre = camp === "adopter" ? "Adopter" : "Rejeter";
  return `<section class="tunnel__camp tunnel__camp--${camp} tunnel__camp--impact-${impact}">
    <p class="tunnel__camp-sens">${titre}</p>
    <h4 class="tunnel__camp-titre">${echapper(libelle)}</h4>
    <p class="tunnel__camp-argument">${echapper(argument)}</p>
    <dl class="tunnel__camp-parties">
      <div><dt>Gagnants</dt><dd>${echapper(gagnants.join(", ") || "Aucun indiqué")}</dd></div>
      <div><dt>Perdants</dt><dd>${echapper(perdants.join(", ") || "Aucun indiqué")}</dd></div>
    </dl>
    <p class="tunnel__camp-montant">${montant}</p>
    <div class="tunnel__reactions" aria-label="Réactions des soutiens">${reactions || '<span class="tunnel__reaction">Aucune réaction prévue</span>'}</div>
  </section>`;
}

function libelleContextuel(mesure: (typeof MESURES)[number]): string {
  return mesure.titre || "la mesure";
}

/** Les deux conséquences d'un vote, sans faire porter le sens par la couleur. */
export function renduComparaison(mesure: (typeof MESURES)[number], dilemme = dilemmeDe(mesure.id)): string {
  const adopter = dilemme?.adopter ?? {
    libelle: libelleContextuel(mesure),
    argument: mesure.detail,
    gagnants: [],
    perdants: [],
  };
  const rejeter = dilemme?.rejeter ?? {
    libelle: libelleContextuel(mesure),
    argument: "Le budget et les soutiens restent soumis aux règles de la séance.",
    gagnants: [],
    perdants: [],
  };
  const montant = `${mesure.effet >= 0 ? "Vous trouvez " : "Vous engagez "}${echapper(millions(mesure.effet * 1e6))}${
    mesure.precision ? ` <small>${echapper(mesure.precision)}</small>` : ""
  }`;
  return `<div class="tunnel__comparaison">
    ${renduCote("adopter", adopter.libelle, adopter.argument, adopter.gagnants, adopter.perdants, montant, pastilles(mesure.reactions), mesure.effet > 0 ? "positif" : mesure.effet < 0 ? "negatif" : "neutre")}
    ${renduCote(
      "rejeter",
      rejeter.libelle,
      rejeter.argument,
      rejeter.gagnants,
      rejeter.perdants,
      mesure.rejet ? "Rejeter a aussi un prix politique." : "Le rejet ne modifie pas le compteur.",
      pastilles(mesure.rejet ?? {}),
      "neutre",
    )}
  </div>`;
}

/** La réserve éditoriale accompagne chaque montant au lieu d'être cachée dans la carte. */
export function renduPreuve(mesure: (typeof MESURES)[number]): string {
  return `<details class="tunnel__preuve">
    <summary>Chiffrage, hypothèses et source</summary>
    <p>${echapper(mesure.detail)}</p>
    ${mesure.precision ? `<p>${echapper(mesure.precision)}</p>` : ""}
    <p>Les réactions des soutiens sont des règles du jeu.</p>
  </details>`;
}

export function renduConseil(etat: EtatTunnel, missionEuros: number): string {
  const mesure = courante(etat);
  const dilemme = mesure && etat.mode === "express" ? dilemmeDe(mesure.id) : undefined;
  const contexte = mesure ? libelleContextuel(mesure) : "la mesure";
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
        ${renduPreuve(mesure)}
        <p class="tunnel__alerte" role="status">${
          etat.reports >= REPORTS_GRATUITS - 1
            ? `${etat.reports} report${etat.reports > 1 ? "s" : ""} : au-delà de ${REPORTS_GRATUITS}, chacun coûte 1 point à chaque soutien.`
            : "Chaque décision modifie le compteur et peut faire réagir les soutiens."
        }</p>
        <div class="tunnel__actions-fixes">
          <button type="button" class="tunnel__adopter" data-geste="adopter">Adopter — ${echapper(dilemme?.adopter.libelle ?? contexte)}</button>
          <button type="button" class="tunnel__rejeter" data-geste="rejeter">Rejeter — ${echapper(dilemme?.rejeter.libelle ?? contexte)}</button>
        </div>
        <div class="tunnel__seconds">
          <button type="button" class="tunnel__ajourner" data-geste="ajourner">Ajourner : elle reviendra en fin de pile</button>
          ${etat.historique.length ? '<button type="button" class="tunnel__ajourner" data-geste="annuler">&#8592; Annuler le dernier tampon</button>' : ""}
        </div>
      </article>`
        : "";
  const restants = Math.max(0, etat.ordre.length - faits);
  const dernieresDecisions = etat.historique.slice(-3).reverse().map(({ id }) => {
    const decision = mesureParId(id);
    const tampon = etat.tampons[id];
    return decision
      ? `<li><span>${echapper(decision.titre)}</span><b class="tunnel__tampon--${tampon}">${tampon === "adopte" ? "Adoptée" : tampon === "rejete" ? "Rejetée" : "Incompatible"}</b></li>`
      : "";
  }).join("");
  const alerte = etat.criseEnCours
    ? "Crise à traiter avant la suite de la séance."
    : etat.telexEnCours
      ? "Une conséquence exige votre réponse."
      : etat.reports >= REPORTS_GRATUITS - 1
        ? `Les prochains reports fragiliseront les quatre soutiens.`
        : "Les conséquences différées apparaîtront ici lorsqu'elles seront déclenchées.";
  return `
    <div class="tunnel__scene" aria-label="Salle de crise">
      <aside class="tunnel__panneau tunnel__panneau--soutiens" aria-label="Soutiens et engagement">
        ${renduBarreEtat(etat, missionEuros)}
        <section class="tunnel__progression" aria-labelledby="tunnel-progression">
          <p id="tunnel-progression" class="tunnel__panneau-titre">Progression de la séance</p>
          <p><strong>${faits}</strong> dossier${faits > 1 ? "s" : ""} tranché${faits > 1 ? "s" : ""} · ${restants} restant${restants > 1 ? "s" : ""}</p>
          <p>${etat.engagements.length ? `${etat.engagements.length} engagement${etat.engagements.length > 1 ? "s" : ""} signé${etat.engagements.length > 1 ? "s" : ""}` : "Aucun engagement signé"}</p>
        </section>
      </aside>
      <main class="tunnel__dilemme" aria-label="Dilemme en cours">
        ${evenement}
      </main>
      <aside class="tunnel__panneau tunnel__panneau--trajectoire" aria-label="Trajectoire et conséquences">
        <section class="tunnel__trajectoire" aria-labelledby="tunnel-trajectoire">
          <p id="tunnel-trajectoire" class="tunnel__panneau-titre">Trajectoire</p>
          <p class="tunnel__trajectoire-reste"><span>Reste à trouver</span><strong>${compteur(missionRestante(etat, missionEuros))}</strong></p>
          <p>Acte ${Math.min(3, Math.floor(faits / Math.max(1, Math.ceil(etat.ordre.length / 3))) + 1)} · ${restants} dossier${restants > 1 ? "s" : ""} en attente</p>
        </section>
        <section class="tunnel__consequences" aria-labelledby="tunnel-consequences-courantes">
          <p id="tunnel-consequences-courantes" class="tunnel__panneau-titre">Conséquences et alertes</p>
          <p class="tunnel__alerte" role="status">${alerte}</p>
        </section>
        ${dernieresDecisions ? `<section class="tunnel__journal" aria-label="Derniers tampons"><p class="tunnel__panneau-titre">Derniers tampons</p><ol>${dernieresDecisions}</ol></section>` : ""}
      </aside>
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
      <p class="tunnel__surtitre">Votre verdict</p>
      <p class="tunnel__verdict-bilan">
        <strong>${echapper(millions(combleM * 1e6))}</strong> trouvés sur les
        <strong>${compteur(missionEuros)}</strong> qui manquent ·
        ${nFranchis} palier${nFranchis > 1 ? "s" : ""} sur ${paliers.length}${
          resteEuros === 0 ? " · l'équilibre" : ""
        }</p>
      <section class="tunnel__stabilite" aria-labelledby="tunnel-stabilite">
        <p id="tunnel-stabilite" class="tunnel__surtitre">Soutiens et stabilité</p>
        ${renduSoutiens(etat, missionEuros)}
      </section>
      <section class="tunnel__mandat" aria-labelledby="tunnel-promesses">
        <p id="tunnel-promesses" class="tunnel__surtitre">Promesses tenues</p>
        <p><strong>Promesses tenues</strong> : ${bilan.engagements.length
          ? bilan.engagements.map((engagement) => `${echapper(engagement.nom)} — ${engagement.statut === "tenue" ? "tenue" : "impossibilité détectée"}`).join(" · ")
          : "aucune promesse signée"}.</p>
      </section>
      <section class="tunnel__mandat" aria-labelledby="tunnel-consequences">
        <p id="tunnel-consequences" class="tunnel__surtitre">Conséquences encore ouvertes</p>
        <p><strong>Conséquences encore ouvertes</strong> : ${bilan.crises.length
          ? `${bilan.crises.length} crise${bilan.crises.length > 1 ? "s" : ""} traversée${bilan.crises.length > 1 ? "s" : ""}`
          : "aucune crise"} · ${bilan.reports} report${bilan.reports > 1 ? "s" : ""}.</p>
      </section>
      <section class="tunnel__mandat" aria-labelledby="tunnel-mandat">
        <p id="tunnel-mandat" class="tunnel__surtitre">Votre mandat</p>
        <h3 class="tunnel__verdict-nom">${echapper(p.nom)}</h3>
        <p class="tunnel__chapeau">${echapper(p.phrase)}${
          rupture ? ` ${echapper(rupture.nom)} est au bord de la rupture.` : ""
        }</p>
      </section>
      ${duel}
      ${(() => {
        const gagnees = decorations(etat, missionEuros);
        if (!gagnees.length) return "";
        const collection = collectionner(gagnees);
        return `<div class="tunnel__decorations"><p class="tunnel__surtitre">Vos décorations</p>
          <div class="tunnel__decorations-rang">${gagnees
            .map((d) => `<span class="tunnel__decoration" title="${echapper(d.detail)}">${echapper(d.nom)}</span>`)
            .join("")}</div>
          <p class="tunnel__note">Collection : ${collection.length} / ${DECORATIONS.length}.</p>
        </div>`;
      })()}
      ${gestes ? `<div class="tunnel__verdict-gestes"><p class="tunnel__surtitre">Vos plus gros gestes</p>${gestes}</div>` : ""}
      <details class="tunnel__historique">
        <summary>Voir mes ${etat.historique.length} choix</summary>
        <ol>${etat.historique.map((choix) => {
          const mesure = mesureParId(choix.id);
          return `<li>${echapper(mesure?.titre ?? choix.id)} — ${etat.tampons[choix.id] === "adopte" ? "adoptée" : "rejetée"}</li>`;
        }).join("")}</ol>
      </details>
      <div class="tunnel__verdict-boutons">
        <button type="button" class="tunnel__adopter" data-action="revanche">Relever le défi</button>
        <button type="button" class="tunnel__rejeter" data-action="partager">Partager le bilan</button>
      </div>
      <p class="tunnel__note">Le défi partage une URL v2 : même mode, même graine, mêmes engagements et score à battre.</p>
    </div>`;
}
function renduPied(): string {
  return `<p class="tunnel__source">La mission est calculée sur les budgets publiés. Les effets
    des mesures sont des ordres de grandeur du débat public (lois de finances, rapports
    parlementaires, chiffrages d'instituts), affichés avec leurs réserves. Les réactions des
    soutiens, à l'adoption comme au rejet, et les issues des télex sont des
    règles du jeu, pas des mesures.</p>`;
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
  return `<div class="tunnel__cadre"><a class="tunnel__quitter" href="/">&#8592;&nbsp;Quitter le conseil</a>${corps}${renduPied()}</div>`;
}
