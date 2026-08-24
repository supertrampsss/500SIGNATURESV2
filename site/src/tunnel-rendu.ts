/** Les rendus purs du simulateur en tunnel. */

import { millions } from "./echelle.ts";
import { CONTRATS } from "./mission.ts";
import { MESURES, type Soutien } from "./mesures.ts";
import {
  CHRONO_SECONDES,
  DECORATIONS,
  REPORTS_GRATUITS,
  SOUTIENS,
  TELEX,
  comble,
  courante,
  decorations,
  mesureParId,
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
      ${defi}
      <button type="button" class="tunnel__commencer" data-action="commencer">Prendre mes fonctions&nbsp;&#8594;</button>
    </div>`;
}

function renduChapitres(etat: EtatTunnel): string {
  const enJeu = etat.ordre.map((id) => mesureParId(id)!).filter(Boolean);
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
      const m = mesureParId(id)!;
      const tampon = etat.tampons[id];
      return `<div class="tunnel__tampon${tampon === "adopte" ? " tunnel__tampon--adopte" : ""}">
        <span>${echapper(m.titre)}</span>
        <b>${
          tampon === "adopte"
            ? echapper(millions(m.effet * 1e6))
            : tampon === "exclue"
              ? "incompatible"
              : "rejetée"
        }</b>
      </div>`;
    })
    .join("");
  return `<div class="tunnel__journal" aria-label="Vos derniers tampons">
    <p class="tunnel__surtitre">Vos tampons</p>
    ${lignes || '<p class="tunnel__note">Aucun encore. Le premier dossier attend.</p>'}
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
  const reactions = pastilles(mesure.reactions);
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
            return `<span class="${
              t === "adopte" ? "tunnel__jalon--adopte" : t ? "tunnel__jalon--rejete" : ""
            }"></span>`;
          })
          .join("")}</div>
        <p class="tunnel__fanfare">${echapper(fanfare)}</p>
      </div>
      ${renduSoutiens(etat, missionEuros)}
    </div>
    <div class="tunnel__scene">
      ${renduChapitres(etat)}
      ${etat.telexEnCours ? renduTelex(etat.telexEnCours) : `<article class="tunnel__carte" aria-live="polite">
        ${etat.chrono ? '<span class="tunnel__chrono" aria-hidden="true"></span>' : ""}
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
        ${
          mesure.rejet
            ? `<p class="tunnel__prix">Rejeter a aussi un prix&nbsp;: ${pastilles(mesure.rejet)}</p>`
            : ""
        }
        <div class="tunnel__tampons">
          <button type="button" class="tunnel__rejeter" data-geste="rejeter">Rejeter</button>
          <button type="button" class="tunnel__adopter" data-geste="adopter">Adopter</button>
        </div>
        <div class="tunnel__seconds">
          <button type="button" class="tunnel__ajourner" data-geste="ajourner">Ajourner : elle reviendra en fin de pile</button>
          ${
            etat.reports >= REPORTS_GRATUITS - 1
              ? `<span class="tunnel__note">${etat.reports} report${etat.reports > 1 ? "s" : ""} · au-delà de ${REPORTS_GRATUITS}, chacun coûte 1 point à chaque soutien</span>`
              : ""
          }
          ${etat.historique.length ? '<button type="button" class="tunnel__ajourner" data-geste="annuler">&#8592; Annuler le dernier tampon</button>' : ""}
        </div>
      </article>`}
      ${renduJournal(etat)}
    </div>`;
}

export function renduVerdict(
  etat: EtatTunnel,
  missionEuros: number,
  collectionner: (gagnees: readonly { id: string }[]) => string[] = () => [],
): string {
  const combleM = comble(etat);
  const resteEuros = Math.max(0, missionEuros - combleM * 1e6);
  const p = etat.censure
    ? {
        nom: "Censuré",
        phrase: `${etat.censure} a lâché : le gouvernement tombe, le compteur s'arrête à ${millions(combleM * 1e6)}. Annulez le tampon de trop, ou rejouez autrement.`,
      }
    : profil(etat);
  const paliers = paliersTunnel(etat, missionEuros);
  const nFranchis = paliers.filter((x) => x.franchi).length;
  const adoptees = etat.ordre
    .filter((id) => etat.tampons[id] === "adopte")
    .map((id) => mesureParId(id)!)
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
      ${renduSoutiens(etat, missionEuros)}
      <div class="tunnel__verdict-boutons">
        <button type="button" class="tunnel__adopter" data-action="defier">Défier quelqu'un</button>
        <button type="button" class="tunnel__rejeter" data-action="copier">Copier le bilan</button>
        ${etat.censure ? '<button type="button" class="tunnel__rejeter" data-geste="annuler">&#8592; Annuler</button>' : ""}
        <button type="button" class="tunnel__rejeter" data-action="rejouer">Rejouer</button>
      </div>
      <p class="tunnel__note">« Défier » copie un lien : la personne joue la même pile, sous vos
        engagements, avec votre score à battre.</p>
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
