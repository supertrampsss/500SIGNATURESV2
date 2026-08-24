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
  estGraineValide,
  etatInitial,
  mesureParId,
  paliersTunnel,
  poursuivreTelex,
  resoudreFinConseil,
  tamponner,
  trancherTelex,
  trancherCrise,
  profil,
  type EtatTunnel,
} from "./tunnel-modele.ts";
import { millions } from "./echelle.ts";
import { CONTRATS } from "./mission.ts";
import { rendu as renduPur, renduVerdict as renduVerdictPur } from "./tunnel-rendu.ts";
import { impactDecision, jouerRetour } from "./tunnel-retour.ts";
import { acteDe, type Acte } from "./campagne.ts";
import { emettreEvenement } from "./tunnel-evenements.ts";

export * from "./tunnel-modele.ts";
export * from "./tunnel-rendu.ts";
export * from "./tunnel-retour.ts";
export * from "./tunnel-evenements.ts";
export { EXPRESS_PAR_ACTE, acteDe, ordreExpress, type Acte } from "./campagne.ts";

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
    const tampons = Object.fromEntries(
      Object.entries(lu.tampons ?? {}).filter(
        ([id, t]) => mesureParId(id) && (t === "adopte" || t === "rejete" || t === "exclue"),
      ),
    );
    const censureHistorique = (lu as unknown as { censure?: unknown }).censure;
    const criseHistorique: EtatTunnel["crisesVues"][number] | undefined =
      lu.phase === "verdict" && typeof censureHistorique === "string"
        ? ({ Opinion: "opinion", Entreprises: "entreprises", Territoires: "territoires", Marchés: "marches" } as const)[censureHistorique]
        : undefined;
    const finHistorique = criseHistorique !== undefined && lu.ordre.every((id) => tampons[id] !== undefined);
    const telexEnCours =
      typeof lu.telexEnCours === "string" && TELEX.some((t) => t.id === lu.telexEnCours) ? lu.telexEnCours : undefined;
    const criseEnCours: EtatTunnel["crisesVues"][number] | undefined =
      criseHistorique ??
      (lu.criseEnCours === "opinion" || lu.criseEnCours === "entreprises" || lu.criseEnCours === "territoires" || lu.criseEnCours === "marches"
        ? lu.criseEnCours
        : undefined);
    const crisesVues = Array.isArray(lu.crisesVues)
      ? lu.crisesVues.filter((cle): cle is "opinion" | "entreprises" | "territoires" | "marches" =>
          cle === "opinion" || cle === "entreprises" || cle === "territoires" || cle === "marches",
        )
      : [];
    // Une ancienne sauvegarde pouvait avoir peint la crise avant que le télex
    // concurrent ne prenne l'écran. Le télex l'emporte : la crise interrompue
    // n'est pas tranchée et doit donc pouvoir revenir après sa fermeture.
    const crisesVuesRestaurees = telexEnCours && criseEnCours
      ? crisesVues.filter((cle) => cle !== criseEnCours)
      : crisesVues;
    // Les sauvegardes antérieures au marqueur ne peuvent pas prouver que le
    // retour du dernier tampon a déjà fini : par défaut, on vérifie donc une
    // fois plutôt que de taire arbitrairement un télex. Un télex encore à
    // l'écran (ou une crise historique déjà ouverte) prouve en revanche que
    // cette vérification a bien eu lieu.
    const telexVerifie = lu.telexVerifie === true || telexEnCours !== undefined || criseHistorique !== undefined;
    return {
      // Les sauvegardes historiques n'avaient ni version, ni mode : leur
      // ordre est celui de l'intégrale et doit rester tel quel.
      version: 2,
      mode: lu.version === 2 && (lu.mode === "express" || lu.mode === "integral") ? lu.mode : "integral",
      graine: estGraineValide(lu.graine) ? lu.graine : Math.floor(Math.random() * 0x1_0000_0000),
      phase: criseHistorique ? "conseil" : lu.phase,
      engagements: (lu.engagements ?? []).filter((cle) => CONTRATS.some((c) => c.cle === cle)),
      ordre: lu.ordre,
      tampons,
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
      // Les sauvegardes historiques n'avaient pas encore de crises : elles
      // reprennent sans coût ni crise déjà consommée.
      crisesVues: crisesVuesRestaurees,
      criseSurcout: Number.isFinite(lu.criseSurcout) ? lu.criseSurcout : 0,
      criseSoutiens: lu.criseSoutiens ?? {},
      // Une sauvegarde d'avant les reports repart à zéro report.
      reports: Number.isFinite(lu.reports) && lu.reports >= 0 ? lu.reports : 0,
      ...(telexEnCours !== undefined ? { telexEnCours } : {}),
      ...(telexVerifie ? { telexVerifie: true as const } : {}),
      ...(criseEnCours !== undefined && telexEnCours === undefined ? { criseEnCours } : {}),
      ...(finHistorique || lu.finDifferee === true ? { finDifferee: true } : {}),
      ...(lu.chrono ? { chrono: true } : {}),
      ...(lu.defi && Number.isFinite(lu.defi.comble) ? { defi: { comble: lu.defi.comble } } : {}),
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

const ORDRE_REVANCHE = ["sans-impot", "sans-prestation", "ecole-sante", "sans-collectivites"] as const;

/** Une nouvelle partie, un cran de contrainte en plus — puis une nouvelle graine. */
export function nouvelleContrainte(etat: EtatTunnel): EtatTunnel {
  const absente = ORDRE_REVANCHE.find((cle) => !etat.engagements.includes(cle));
  return {
    ...etatInitial(),
    mode: etat.mode,
    graine: absente ? etat.graine : (etat.graine + 1) >>> 0,
    engagements: absente ? [...etat.engagements, absente] : [...etat.engagements],
  };
}

function acteAnonyme(etat: EtatTunnel, id: string, numero: number): Acte {
  const acte = acteDe(id);
  if (acte !== undefined) return acte;
  return Math.min(3, Math.floor((numero - 1) / Math.max(1, Math.ceil(etat.ordre.length / 3))) + 1) as Acte;
}

/** Les suites qui ne deviennent vraies qu'après le retour visuel du tampon. */
function emettreSuite(etat: EtatTunnel): void {
  if (etat.criseEnCours) emettreEvenement({ type: "crise", soutien: etat.criseEnCours });
  if (etat.phase === "verdict") {
    emettreEvenement({ type: "partie_terminee", mode: etat.mode, dossiers: etat.ordre.length });
  }
}

/** Les événements du monde ne suivent qu'après le retour du tampon persistant. */
export function transitionApresRetour(etat: EtatTunnel, missionEuros: number): EtatTunnel {
  return resoudreFinConseil(etat, missionEuros);
}

/** Un même cadre remonté deux fois ne laisse jamais son ancien retour vivre. */
const MONTAGES = new WeakMap<HTMLElement, () => void>();

export function afficherTunnel(cadre: HTMLElement, options: { missionEuros: number }): () => void {
  MONTAGES.get(cadre)?.();
  // La partie en cours d'abord ; sinon le défi que l'adresse porte ; sinon
  // une partie neuve. Un défi reçu pendant une partie en cours ne l'écrase
  // pas : la partie du joueur vaut plus qu'un lien.
  const recu = decoderDefi(new URLSearchParams(location.search).get("defi"));
  let etat = transitionApresRetour(reprendre(restaurer(), recu), options.missionEuros);
  // Le minuteur du conseil de crise : réarmé à chaque peinture, désarmé
  // avant — une seule échéance vit à la fois. À l'expiration, la mesure est
  // ajournée d'office : le conseil n'attend pas.
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  // Le tampon est déjà acquis pendant son retour visuel, mais aucun autre
  // geste ne peut se glisser avant la carte (ou le télex) suivante.
  let retourEnCours = false;
  let annulerRetour: (() => void) | undefined;
  // Le tampon reste acquis si BFCache coupe son animation : il recevra son
  // unique résolution au retour, sans jamais rejouer le retour visuel.
  let tamponEnRetour: EtatTunnel | undefined;
  const interrompreRetour = () => {
    annulerRetour?.();
    annulerRetour = undefined;
    retourEnCours = false;
  };
  const peindre = () => {
    interrompreRetour();
    sauver(etat);
    cadre.innerHTML = rendu(etat, options.missionEuros);
    clearTimeout(minuteur);
    if (etat.chrono && etat.phase === "conseil" && !etat.telexEnCours && !etat.criseEnCours && courante(etat)) {
      minuteur = setTimeout(() => {
        const id = courante(etat)?.id ?? "";
        etat = ajourner(etat);
        const numero = etat.historique.length + etat.reports;
        emettreEvenement({ type: "decision", acte: acteAnonyme(etat, id, numero), numero, verdict: "ajourne" });
        peindre();
      }, CHRONO_SECONDES * 1000);
    }
  };
  const resoudreRetour = () => {
    const tampon = tamponEnRetour;
    if (!tampon) return;
    tamponEnRetour = undefined;
    annulerRetour = undefined;
    retourEnCours = false;
    etat = transitionApresRetour(tampon, options.missionEuros);
    sauver(etat);
    emettreSuite(etat);
    peindre();
  };
  const clic = (evenement: MouseEvent) => {
    if ((evenement.target as HTMLElement).closest(".tunnel__quitter")) {
      interrompreRetour();
      return;
    }
    if (retourEnCours) return;
    const cible = (evenement.target as HTMLElement).closest<HTMLElement>(
      "[data-geste], [data-action], [data-engagement], [data-telex], [data-crise]",
    );
    if (!cible) return;
    const issue = cible.dataset.telex;
    if (issue) {
      etat = trancherTelex(etat, issue, options.missionEuros);
      emettreSuite(etat);
      return peindre();
    }
    const issueCrise = cible.dataset.crise;
    if (issueCrise === "conceder" || issueCrise === "tenir") {
      etat = trancherCrise(etat, issueCrise, options.missionEuros);
      emettreSuite(etat);
      return peindre();
    }
    const engagement = cible.dataset.engagement;
    if (engagement) {
      etat = basculerEngagement(etat, engagement);
      return peindre();
    }
    const geste = cible.dataset.geste;
    if (geste === "adopter" || geste === "rejeter") {
      // Le tampon est la seule chose qui existe pendant le retour : le télex
      // et les crises attendent que ce geste, déjà sauvegardé, ait été lu.
      const avant = etat;
      const tampon = tamponner(etat, geste === "adopter" ? "adopte" : "rejete");
      const impact = impactDecision(avant, tampon, options.missionEuros);
      etat = tampon;
      tamponEnRetour = tampon;
      sauver(etat);
      const numero = tampon.historique.length + tampon.reports;
      emettreEvenement({
        type: "decision",
        acte: acteAnonyme(tampon, courante(avant)!.id, numero),
        numero,
        verdict: geste === "adopter" ? "adopte" : "rejete",
      });
      clearTimeout(minuteur);
      interrompreRetour();
      retourEnCours = true;
      annulerRetour = jouerRetour(cadre, impact, () => {
        resoudreRetour();
      });
      return;
    }
    if (geste === "ajourner") {
      const id = courante(etat)?.id ?? "";
      etat = ajourner(etat);
      const numero = etat.historique.length + etat.reports;
      emettreEvenement({ type: "decision", acte: acteAnonyme(etat, id, numero), numero, verdict: "ajourne" });
      return peindre();
    }
    if (geste === "annuler") {
      etat = annuler(etat);
      return peindre();
    }
    if (cible.dataset.action === "commencer") {
      etat = commencer(etat);
      emettreEvenement({ type: "partie_demarre", mode: etat.mode });
      return peindre();
    }
    if (cible.dataset.action === "mode-integral") {
      etat = { ...etat, mode: "integral" };
      return peindre();
    }
    if (cible.dataset.action === "mode-express") {
      etat = { ...etat, mode: "express" };
      return peindre();
    }
    if (cible.dataset.action === "poursuivre") {
      etat = poursuivreTelex(etat, options.missionEuros);
      emettreSuite(etat);
      return peindre();
    }
    if (cible.dataset.action === "chrono") {
      etat = { ...etat, chrono: !etat.chrono };
      return peindre();
    }
    if (cible.dataset.action === "revanche") {
      effacer();
      etat = nouvelleContrainte(etat);
      emettreEvenement({ type: "revanche" });
      return peindre();
    }
    if (cible.dataset.action === "partager") {
      const texte = bilanTexte(etat, options.missionEuros);
      const adresse = adresseDefi(etat);
      emettreEvenement({ type: "partage" });
      void (async () => {
        try {
          if (typeof navigator.share === "function") {
            await navigator.share({ title: "Mon bilan du conseil", text: texte, url: adresse });
            return;
          }
        } catch {
          // Le refus du partage reprend le chemin utilisable partout.
        }
        try {
          await navigator.clipboard?.writeText(texte);
          cible.textContent = "Copié, partagez votre bilan";
        } catch {
          window.prompt("Votre bilan, à copier :", texte);
        }
      })();
    }
  };
  cadre.addEventListener("click", clic);
  const demonter = () => {
    interrompreRetour();
    clearTimeout(minuteur);
    cadre.removeEventListener("click", clic);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", pageshow);
    if (MONTAGES.get(cadre) === demonter) MONTAGES.delete(cadre);
  };
  const pagehide = (evenement: PageTransitionEvent) => {
    // Le BFCache garde le DOM : retirer l'écouteur ici le rendrait inerte au
    // retour. On stoppe seulement ce qui peut reprendre hors contexte.
    if (evenement.persisted) {
      interrompreRetour();
      clearTimeout(minuteur);
      return;
    }
    demonter();
  };
  const pageshow = (evenement: PageTransitionEvent) => {
    if (!evenement.persisted) return;
    if (tamponEnRetour) resoudreRetour();
    else peindre();
  };
  MONTAGES.set(cadre, demonter);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", pageshow);
  peindre();
  return demonter;
}
