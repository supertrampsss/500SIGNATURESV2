/** La façade publique et le contrôleur du simulateur en tunnel. */

import {
  CHRONO_SECONDES,
  TELEX,
  ajourner,
  annuler,
  basculerEngagement,
  commencer,
  comble,
  courante,
  decoderDefi,
  encoderDefi,
  etatInitial,
  mesureParId,
  paliersTunnel,
  poursuivreTelex,
  tamponner,
  trancherTelex,
  verifierCensure,
  verifierTelex,
  profil,
  type EtatTunnel,
} from "./tunnel-modele.ts";
import { millions } from "./echelle.ts";
import { CONTRATS } from "./mission.ts";
import { rendu as renduPur, renduVerdict as renduVerdictPur } from "./tunnel-rendu.ts";

export * from "./tunnel-modele.ts";
export * from "./tunnel-rendu.ts";

/* --------------------------------------------------------------------------
 * La partie survit au rechargement.
 *
 * Sur téléphone — le vrai public — un onglet se recharge sans prévenir, et
 * une pile de 78 mesures perdue au tampon 60 ne se repardonne pas. L'état vit
 * dans `sessionStorage` : la session, pas plus — une partie n'est pas un
 * document, et la retrouver trois jours plus tard n'aurait pas de sens.
 * Chaque lecture et chaque écriture est gardée : navigation privée, quotas et
 * iframes rendent le stockage indisponible sans prévenir, et le jeu doit
 * jouer pareil sans lui.
 * ----------------------------------------------------------------------- */

const CLE_PARTIE = "tunnel-partie";

function sauver(etat: EtatTunnel): void {
  try {
    sessionStorage.setItem(CLE_PARTIE, JSON.stringify(etat));
  } catch {
    // Stockage indisponible : la partie vit en mémoire, c'est tout.
  }
}

function effacer(): void {
  try {
    sessionStorage.removeItem(CLE_PARTIE);
  } catch {
    // Rien à effacer là où rien ne s'écrit.
  }
}

/** L'état sauvé, s'il est encore valable — une pile qui cite une mesure
 *  disparue du catalogue est jetée entière : mieux vaut recommencer que
 *  jouer une partie qui ne se terminera pas. */
export function restaurer(): EtatTunnel | null {
  try {
    const brut = sessionStorage.getItem(CLE_PARTIE);
    if (!brut) return null;
    const lu = JSON.parse(brut) as EtatTunnel;
    if (lu.phase !== "mission" && lu.phase !== "conseil" && lu.phase !== "verdict") return null;
    if (!Array.isArray(lu.ordre) || !lu.ordre.every((id) => mesureParId(id))) return null;
    if (lu.phase !== "mission" && lu.ordre.length === 0) return null;
    return {
      phase: lu.phase,
      engagements: (lu.engagements ?? []).filter((cle) => CONTRATS.some((c) => c.cle === cle)),
      ordre: lu.ordre,
      tampons: Object.fromEntries(
        Object.entries(lu.tampons ?? {}).filter(
          ([id, t]) => mesureParId(id) && (t === "adopte" || t === "rejete" || t === "exclue"),
        ),
      ),
      historique: Array.isArray(lu.historique)
        ? lu.historique.filter(
            (h) => h && mesureParId(h.id) && Array.isArray(h.exclues) && h.exclues.every((i) => mesureParId(i)),
          )
        : [],
      // Une sauvegarde d'avant les télex n'en portait pas : elle repart avec
      // un ciel calme plutôt que d'être jetée.
      telex:
        lu.telex && Array.isArray(lu.telex.vus) && Number.isFinite(lu.telex.surcout)
          ? {
              vus: lu.telex.vus.filter((id) => TELEX.some((t) => t.id === id)),
              surcout: lu.telex.surcout,
              soutiens: lu.telex.soutiens ?? {},
            }
          : { vus: [], surcout: 0, soutiens: {} },
      // Une sauvegarde d'avant les reports repart à zéro report.
      reports: Number.isFinite(lu.reports) && lu.reports >= 0 ? lu.reports : 0,
      ...(typeof lu.telexEnCours === "string" && TELEX.some((t) => t.id === lu.telexEnCours)
        ? { telexEnCours: lu.telexEnCours }
        : {}),
      ...(lu.chrono ? { chrono: true } : {}),
      ...(lu.defi && Number.isFinite(lu.defi.comble) ? { defi: { comble: lu.defi.comble } } : {}),
      ...(typeof lu.censure === "string" ? { censure: lu.censure } : {}),
    };
  } catch {
    return null;
  }
}

const CLE_DECORATIONS = "tunnel-decorations";

/** La collection, enrichie des gagnées du jour. Rendue telle quelle si le
 *  stockage refuse — la vitrine vit alors le temps de la page. */
export function collectionner(gagnees: readonly { id: string }[]): string[] {
  let collection: string[] = [];
  try {
    const brut = localStorage.getItem(CLE_DECORATIONS);
    if (brut) {
      const lu = JSON.parse(brut) as unknown;
      if (Array.isArray(lu)) collection = lu.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // Navigation privée : la collection repart de la partie du jour.
  }
  for (const d of gagnees) if (!collection.includes(d.id)) collection.push(d.id);
  try {
    localStorage.setItem(CLE_DECORATIONS, JSON.stringify(collection));
  } catch {
    // Sans stockage, la collection du jour reste vraie à l'écran.
  }
  return collection;
}

/** L'adresse qui porte le défi : la même pile, les mêmes engagements, le score à battre. */
export function adresseDefi(etat: EtatTunnel): string {
  return `${location.origin}/simulateur?defi=${encodeURIComponent(encoderDefi(etat))}`;
}

/** Le texte du bilan à coller ailleurs — la version défi du verdict. */
export function bilanTexte(etat: EtatTunnel, missionEuros: number): string {
  const p = profil(etat);
  const nFranchis = paliersTunnel(etat, missionEuros).filter((x) => x.franchi).length;
  return (
    `${p.nom} : ${millions(comble(etat) * 1e6)} trouvés sur les ${millions(Math.round(missionEuros / 1e6) * 1e6)} ` +
    `qui manquent aux budgets publics (${nFranchis} palier${nFranchis > 1 ? "s" : ""} sur 4). ` +
    `Faites mieux : ${adresseDefi(etat)}`
  );
}

/** La version publique branche la collection locale sur le rendu pur. */
export function renduVerdict(etat: EtatTunnel, missionEuros: number): string {
  return renduVerdictPur(etat, missionEuros, collectionner);
}

export function rendu(etat: EtatTunnel, missionEuros: number): string {
  return renduPur(etat, missionEuros, collectionner);
}

/**
 * Monter le tunnel dans son cadre. Un seul écouteur, délégué : le cadre est
 * repeint à chaque tampon, et des écouteurs posés sur les boutons repartiraient
 * avec eux.
 */
/**
 * Ce qui s'ouvre au montage : la sauvegarde, ou un défi reçu par l'adresse.
 * Un défi l'emporte sur une sauvegarde restée à l'écran de mission : rien n'y
 * est joué, il n'y a rien à protéger — sans ça, la simple visite d'hier
 * avalerait le lien de défi d'aujourd'hui. Une partie en conseil ou au
 * verdict, elle, reste prioritaire.
 */
export function reprendre(
  sauve: EtatTunnel | null,
  recu: ReturnType<typeof decoderDefi>,
): EtatTunnel {
  if (sauve && !(recu && sauve.phase === "mission")) return sauve;
  return etatInitial(recu);
}

export function afficherTunnel(cadre: HTMLElement, options: { missionEuros: number }): void {
  // La partie en cours d'abord ; sinon le défi que l'adresse porte ; sinon
  // une partie neuve. Un défi reçu pendant une partie en cours ne l'écrase
  // pas : la partie du joueur vaut plus qu'un lien.
  const recu = decoderDefi(new URLSearchParams(location.search).get("defi"));
  let etat = reprendre(restaurer(), recu);
  // Le minuteur du conseil de crise : réarmé à chaque peinture, désarmé
  // avant — une seule échéance vit à la fois. À l'expiration, la mesure est
  // ajournée d'office : le conseil n'attend pas.
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const peindre = () => {
    sauver(etat);
    cadre.innerHTML = rendu(etat, options.missionEuros);
    clearTimeout(minuteur);
    if (etat.chrono && etat.phase === "conseil" && !etat.telexEnCours && courante(etat)) {
      minuteur = setTimeout(() => {
        etat = ajourner(etat);
        peindre();
      }, CHRONO_SECONDES * 1000);
    }
  };
  cadre.addEventListener("click", (evenement) => {
    const cible = (evenement.target as HTMLElement).closest<HTMLElement>(
      "[data-geste], [data-action], [data-engagement], [data-telex]",
    );
    if (!cible) return;
    const issue = cible.dataset.telex;
    if (issue) {
      etat = trancherTelex(etat, issue, options.missionEuros);
      return peindre();
    }
    const engagement = cible.dataset.engagement;
    if (engagement) {
      etat = basculerEngagement(etat, engagement);
      return peindre();
    }
    const geste = cible.dataset.geste;
    if (geste === "adopter" || geste === "rejeter") {
      // Le télex tombe AVANT la censure : ses effets peuvent être ce qui
      // censure, et le joueur doit lire pourquoi avant de tomber.
      etat = verifierTelex(
        tamponner(etat, geste === "adopter" ? "adopte" : "rejete"),
        options.missionEuros,
      );
      if (!etat.telexEnCours) etat = verifierCensure(etat, options.missionEuros);
      return peindre();
    }
    if (geste === "ajourner") {
      etat = ajourner(etat);
      return peindre();
    }
    if (geste === "annuler") {
      etat = annuler(etat);
      return peindre();
    }
    if (cible.dataset.action === "commencer") {
      etat = commencer(etat);
      return peindre();
    }
    if (cible.dataset.action === "poursuivre") {
      etat = poursuivreTelex(etat, options.missionEuros);
      return peindre();
    }
    if (cible.dataset.action === "chrono") {
      etat = { ...etat, chrono: !etat.chrono };
      return peindre();
    }
    if (cible.dataset.action === "rejouer") {
      effacer();
      etat = etatInitial();
      return peindre();
    }
    if (cible.dataset.action === "defier") {
      const adresse = adresseDefi(etat);
      void navigator.clipboard?.writeText(adresse).then(
        () => {
          cible.textContent = "Lien copié, envoyez-le";
        },
        () => {
          window.prompt("Le lien du défi, à copier :", adresse);
        },
      );
      return;
    }
    if (cible.dataset.action === "copier") {
      const texte = bilanTexte(etat, options.missionEuros);
      void navigator.clipboard?.writeText(texte).then(
        () => {
          cible.textContent = "Copié, collez-le où vous défiez";
        },
        () => {
          // Presse-papiers refusé (permissions, contexte non sécurisé) : le
          // texte reste lisible dans une invite, plutôt que rien.
          window.prompt("Votre bilan, à copier :", texte);
        },
      );
    }
  });
  peindre();
}
