/** Le moteur pur du simulateur en tunnel. */

import { CONTRATS, PALIERS } from "./mission.ts";
import { MESURES, type Mesure, type Soutien } from "./mesures.ts";
import { ordreExpress, type ModeTunnel } from "./campagne.ts";

export type { ModeTunnel } from "./campagne.ts";

/** `exclue` : écartée d'office parce qu'une mesure incompatible a été
 *  adoptée — on ne vote pas deux barèmes de l'IR. */
export type Tampon = "adopte" | "rejete" | "exclue";

export type Phase = "mission" | "conseil" | "verdict";

export type DefiTunnel = {
  comble: number;
  engagements: string[];
  /** Absent dans un défi historique : il rejoue alors l'intégrale. */
  mode?: ModeTunnel;
  graine?: number;
};

export type EtatTunnel = {
  version: 2;
  mode: ModeTunnel;
  graine: number;
  phase: Phase;
  /** Les clés des contrats signés à l'écran de mission. */
  engagements: string[];
  /** La pile, dans l'ordre où elle défile — les ajournées repassent en queue. */
  ordre: string[];
  tampons: Record<string, Tampon>;
  /** Le défi reçu par l'adresse : le comblé à battre, en M€, sous les
   *  engagements pré-signés. Absent hors défi. */
  defi?: { comble: number };
  /** Les tampons dans l'ordre où ils ont été posés, avec les exclusions que
   *  chacun a entraînées : c'est ce que « Annuler » dépile. */
  historique: { id: string; exclues: string[] }[];
  /** Le soutien qui a fait tomber le gouvernement, s'il est tombé. */
  censure?: string;
  /** Les télex : les événements déjà tombés (un télex ne tombe qu'une fois),
   *  le surcoût qu'ils ont ajouté à la mission (négatif), et ce qu'ils ont
   *  fait aux soutiens. Un télex est le destin : « Annuler » n'y revient pas. */
  telex: { vus: string[]; surcout: number; soutiens: Partial<Record<Soutien, number>> };
  /** Le télex affiché en ce moment — la carte de mesure attend derrière. */
  telexEnCours?: string;
  /** Le conseil de crise : vingt secondes par mesure, sinon elle est
   *  ajournée d'office. Choisi à l'écran de mission. */
  chrono?: boolean;
  /** Les ajournements posés depuis le début du conseil. Au-delà de
   *  `REPORTS_GRATUITS`, chaque report coûte un point à chaque soutien :
   *  l'immobilisme se paie, et il ne s'annule pas. */
  reports: number;
};

/** Les reports sans prix. Au-delà, chaque ajournement coûte un point à
 *  chaque soutien : on peut temporiser, pas gouverner par le report. */
export const REPORTS_GRATUITS = 5;

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

/** Retrouve une mesure du catalogue sans exposer l'index interne. */
export function mesureParId(id: string): Mesure | undefined {
  return PAR_ID.get(id);
}

/** Les incompatibilités, symétrisées : `exclut` se déclare d'un côté du
 *  catalogue, la table vaut dans les deux sens. */
const EXCLUSIONS = new Map<string, Set<string>>();
for (const m of MESURES) {
  for (const autre of m.exclut ?? []) {
    if (!EXCLUSIONS.has(m.id)) EXCLUSIONS.set(m.id, new Set());
    if (!EXCLUSIONS.has(autre)) EXCLUSIONS.set(autre, new Set());
    EXCLUSIONS.get(m.id)!.add(autre);
    EXCLUSIONS.get(autre)!.add(m.id);
  }
}

/** Sous ce niveau, un soutien fait TOMBER le gouvernement : la partie
 *  s'arrête, le compteur aussi. C'est la mort subite de septennats — un
 *  soutien n'est pas une jauge décorative. */
export const SEUIL_CENSURE = 10;

/** Le conseil de crise : ce que dure une mesure avant d'être ajournée. */
export const CHRONO_SECONDES = 20;

/** Une issue de télex : ce que coûte UNE des deux réponses possibles. */
type IssueTelex = {
  cle: string;
  /** Le libellé du bouton. */
  bouton: string;
  /** M€ ajoutés à la mission (négatif : la vie devient plus chère). */
  effet: number;
  soutiens: Partial<Record<Soutien, number>>;
};

type Telex = {
  id: string;
  nom: string;
  texte: string;
  /** M€ appliqués dès la chute du télex — les bonnes nouvelles sans choix. */
  effet: number;
  soutiens: Partial<Record<Soutien, number>>;
  /** Les deux issues d'un télex de crise : chacune a un prix, c'est le
   *  dilemme. Absent pour les télex sans choix. */
  issues?: [IssueTelex, IssueTelex];
  declenche: (jauges: Record<Soutien, number>, combleM: number, poses: number) => boolean;
};

/**
 * Les télex : le monde répond aux tampons, entre deux mesures.
 *
 * Chacun tombe UNE fois par partie, au premier tampon qui remplit sa
 * condition. Les mauvais tombent quand une jauge vacille (sous le seuil
 * d'alerte, avant la censure) ; les bons, quand un palier saute. Leurs effets
 * sont des règles du jeu, comme les réactions des mesures — et comme elles,
 * ils ne s'annulent pas : un télex est le destin, pas un tampon.
 */
export const TELEX: Telex[] = [
  {
    id: "taux",
    nom: "Les taux montent",
    texte: "Les investisseurs doutent de votre trajectoire : l'État emprunte plus cher. Rassurer les marchés se paie devant l'opinion ; laisser filer se paie en milliards.",
    effet: 0,
    soutiens: {},
    issues: [
      { cle: "a", bouton: "Annoncer un plan d'économies", effet: 0, soutiens: { marches: 5, opinion: -4 } },
      { cle: "b", bouton: "Laisser filer les taux", effet: -2000, soutiens: { marches: -2 } },
    ],
    declenche: (j) => j.marches < SEUIL_RUPTURE + 10,
  },
  {
    id: "greve",
    nom: "Grève générale",
    texte: "Le pays s'arrête un mardi, puis un jeudi. Céder rouvre le portefeuille ; tenir laisse pourrir, et l'activité fond des deux côtés.",
    effet: 0,
    soutiens: {},
    issues: [
      { cle: "a", bouton: "Céder : un geste social", effet: -2000, soutiens: { opinion: 5, entreprises: -2 } },
      { cle: "b", bouton: "Tenir bon", effet: -1500, soutiens: { opinion: -4, entreprises: -3 } },
    ],
    declenche: (j) => j.opinion < SEUIL_RUPTURE + 10,
  },
  {
    id: "maires",
    nom: "La fronde des maires",
    texte: "Mille écharpes tricolores sur les marches de votre ministère. Rouvrir la dotation coûte ; tenir bon fige les chantiers et braque les élus.",
    effet: 0,
    soutiens: {},
    issues: [
      { cle: "a", bouton: "Rouvrir la dotation", effet: -1000, soutiens: { territoires: 6 } },
      { cle: "b", bouton: "Tenir bon", effet: -500, soutiens: { territoires: -3, opinion: -2 } },
    ],
    declenche: (j) => j.territoires < SEUIL_RUPTURE + 10,
  },
  {
    id: "embauches",
    nom: "Gel des embauches",
    texte: "Les entreprises repoussent leurs investissements. Un geste sur les charges coûte tout de suite ; l'attentisme coûte en activité et en impôt.",
    effet: 0,
    soutiens: {},
    issues: [
      { cle: "a", bouton: "Un geste ciblé sur les charges", effet: -1500, soutiens: { entreprises: 5 } },
      { cle: "b", bouton: "Attendre que ça passe", effet: -2000, soutiens: { opinion: -2 } },
    ],
    declenche: (j) => j.entreprises < SEUIL_RUPTURE + 10,
  },
  {
    id: "notation",
    nom: "La revue de notation",
    texte: "Mi-parcours : beaucoup de tampons, peu de milliards trouvés. L'agence sort sa loupe. Promettre la rigueur rassure les marchés et se paie devant l'opinion ; l'ignorer se paie sur la note.",
    effet: 0,
    soutiens: {},
    issues: [
      { cle: "a", bouton: "Recevoir l'agence, promettre la rigueur", effet: 0, soutiens: { marches: 4, opinion: -3 } },
      { cle: "b", bouton: "Ignorer la revue", effet: 0, soutiens: { marches: -5 } },
    ],
    declenche: (_j, combleM, poses) => poses >= 40 && combleM < 20000,
  },
  {
    id: "perspective",
    nom: "Perspective relevée",
    texte: "Les agences de notation saluent le cap des 50 000 M€ trouvés. Emprunter coûte un peu moins cher : les marchés respirent.",
    effet: 0,
    soutiens: { marches: 6 },
    declenche: (_j, combleM) => combleM >= 50000,
  },
  {
    id: "confiance",
    nom: "Le retour de la confiance",
    texte: "Cap des 100 000 M€. Les investisseurs reviennent, le patronat parle de « sérieux retrouvé ». Personne ne vous dira merci dans la rue.",
    effet: 0,
    soutiens: { marches: 4, entreprises: 3 },
    declenche: (_j, combleM) => combleM >= 100000,
  },
];

/** La pile pour un jeu d'engagements : les mesures couvertes disparaissent,
 *  dans l'ordre validé du catalogue. */
export function pile(engagements: readonly string[]): Mesure[] {
  return MESURES.filter((m) => !m.bloqueePar?.some((cle) => engagements.includes(cle)));
}

function graineInitiale(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

export function estGraineValide(graine: unknown): graine is number {
  return typeof graine === "number" && Number.isInteger(graine) && graine >= 0 && graine <= 0xffff_ffff;
}

export function etatInitial(defi?: DefiTunnel | null): EtatTunnel {
  const mode = defi?.mode ?? (defi ? "integral" : "express");
  const graineDefi = defi?.graine;
  const graine = estGraineValide(graineDefi) ? graineDefi : graineInitiale();
  if (!defi) {
    return {
      version: 2,
      mode,
      graine,
      phase: "mission",
      engagements: [],
      ordre: [],
      tampons: {},
      historique: [],
      telex: { vus: [], surcout: 0, soutiens: {} },
      reports: 0,
    };
  }
  // Un défi pré-signe les engagements de l'adversaire : « faites mieux, sous
  // les mêmes règles ». Le joueur peut les dédire — le verdict comparera
  // quand même, et c'est sa partie qui le dira.
  return {
    version: 2,
    mode,
    graine,
    phase: "mission",
    engagements: defi.engagements,
    ordre: [],
    tampons: {},
    historique: [],
    telex: { vus: [], surcout: 0, soutiens: {} },
    reports: 0,
    defi: { comble: defi.comble },
  };
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
    ordre:
      etat.mode === "express"
        ? ordreExpress(etat.engagements, etat.graine)
        : pile(etat.engagements).map((m) => m.id),
    tampons: {},
    historique: [],
    telex: { vus: [], surcout: 0, soutiens: {} },
    reports: 0,
  };
}

/** La mesure sur le bureau : la première de l'ordre encore sans tampon. */
export function courante(etat: EtatTunnel): Mesure | null {
  const id = etat.ordre.find((i) => !etat.tampons[i]);
  return id ? (PAR_ID.get(id) ?? null) : null;
}

export function tamponner(etat: EtatTunnel, verdict: "adopte" | "rejete"): EtatTunnel {
  const mesure = courante(etat);
  if (!mesure) return etat;
  const tampons: Record<string, Tampon> = { ...etat.tampons, [mesure.id]: verdict };
  // Adopter écarte les incompatibles encore en jeu : elles quittent le
  // conseil avec le tampon `exclue`, et « Annuler » les ramènera avec elle.
  const exclues: string[] = [];
  if (verdict === "adopte") {
    for (const autre of EXCLUSIONS.get(mesure.id) ?? []) {
      if (etat.ordre.includes(autre) && !tampons[autre]) {
        tampons[autre] = "exclue";
        exclues.push(autre);
      }
    }
  }
  const historique = [...etat.historique, { id: mesure.id, exclues }];
  const reste = etat.ordre.some((i) => !tampons[i]);
  return { ...etat, tampons, historique, phase: reste ? "conseil" : "verdict" };
}

/**
 * Annuler le dernier tampon — et lui seul.
 *
 * Le retour existe parce qu'un pouce glisse ; il dépile, il ne navigue pas :
 * revenir trois mesures en arrière se fait en annulant trois fois, et les
 * exclusions posées par le tampon annulé reviennent avec lui. Une censure
 * s'annule aussi — c'est le même geste de trop.
 */
export function annuler(etat: EtatTunnel): EtatTunnel {
  const dernier = etat.historique[etat.historique.length - 1];
  if (!dernier) return etat;
  const tampons = { ...etat.tampons };
  delete tampons[dernier.id];
  for (const id of dernier.exclues) delete tampons[id];
  const { censure: _censure, ...sans } = etat;
  return { ...sans, tampons, historique: etat.historique.slice(0, -1), phase: "conseil" };
}

/** La censure : si un soutien est au tapis, la partie s'arrête là. À appeler
 *  après chaque tampon — pur, comme le reste. */
export function verifierCensure(etat: EtatTunnel, missionEuros: number): EtatTunnel {
  if (etat.phase !== "conseil") return etat;
  const tombe = soutiens(etat, missionEuros).find((s) => s.valeur <= SEUIL_CENSURE);
  return tombe ? { ...etat, phase: "verdict", censure: tombe.nom } : etat;
}

/** Le premier télex dont la condition vient d'être remplie tombe — un seul
 *  par tampon, une seule fois par partie. Ses effets s'appliquent tout de
 *  suite ; l'écran, lui, attend « Poursuivre ». */
export function verifierTelex(etat: EtatTunnel, missionEuros: number): EtatTunnel {
  if (etat.phase !== "conseil" || etat.telexEnCours) return etat;
  const jauges = Object.fromEntries(
    soutiens(etat, missionEuros).map((s) => [s.cle, s.valeur]),
  ) as Record<Soutien, number>;
  const combleM = comble(etat);
  const poses = Object.keys(etat.tampons).length;
  const tombe = TELEX.find((t) => !etat.telex.vus.includes(t.id) && t.declenche(jauges, combleM, poses));
  if (!tombe) return etat;
  const cumules = { ...etat.telex.soutiens };
  for (const [cle, delta] of Object.entries(tombe.soutiens)) {
    cumules[cle as Soutien] = (cumules[cle as Soutien] ?? 0) + delta;
  }
  return {
    ...etat,
    telexEnCours: tombe.id,
    telex: { vus: [...etat.telex.vus, tombe.id], surcout: etat.telex.surcout + tombe.effet, soutiens: cumules },
  };
}

/** Refermer un télex sans choix — et regarder si ses effets censurent. */
export function poursuivreTelex(etat: EtatTunnel, missionEuros: number): EtatTunnel {
  const { telexEnCours: _lu, ...sans } = etat;
  return verifierCensure(sans, missionEuros);
}

/**
 * Trancher un télex de crise : appliquer le prix de l'issue choisie, puis
 * refermer. Les deux issues coûtent — c'est le dilemme — et comme tout
 * télex, le choix est le destin : « Annuler » n'y revient pas.
 */
export function trancherTelex(etat: EtatTunnel, cle: string, missionEuros: number): EtatTunnel {
  const telex = TELEX.find((t) => t.id === etat.telexEnCours);
  const issue = telex?.issues?.find((i) => i.cle === cle);
  if (!issue) return etat;
  const cumules = { ...etat.telex.soutiens };
  for (const [soutien, delta] of Object.entries(issue.soutiens)) {
    cumules[soutien as Soutien] = (cumules[soutien as Soutien] ?? 0) + delta;
  }
  return poursuivreTelex(
    {
      ...etat,
      telex: { ...etat.telex, surcout: etat.telex.surcout + issue.effet, soutiens: cumules },
    },
    missionEuros,
  );
}

export function ajourner(etat: EtatTunnel): EtatTunnel {
  const mesure = courante(etat);
  if (!mesure) return etat;
  const ordre = [...etat.ordre.filter((i) => i !== mesure.id), mesure.id];
  return { ...etat, ordre, reports: etat.reports + 1 };
}

/** Le solde des tampons ADOPTÉS plus le surcoût des télex, en M€ — les
 *  mesures qui coûtent et le destin retranchent pareil. */
export function trouve(etat: EtatTunnel): number {
  return (
    etat.ordre.reduce(
      (somme, id) =>
        etat.tampons[id] === "adopte" ? somme + (PAR_ID.get(id)?.effet ?? 0) : somme,
      0,
    ) + etat.telex.surcout
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
    let v = base + (etat.telex.soutiens[cle] ?? 0);
    for (const id of etat.ordre) {
      const tampon = etat.tampons[id];
      if (tampon === "adopte") v += PAR_ID.get(id)?.reactions[cle] ?? 0;
      // Le rejet a un prix sur les cartes qui en déclarent un : rejeter la
      // mesure préférée d'un camp le fâche. Une exclue ne compte pas — ce
      // n'était pas un choix.
      else if (tampon === "rejete") v += PAR_ID.get(id)?.rejet?.[cle] ?? 0;
    }
    // L'immobilisme se paie : chaque report au-delà des gratuits coûte un
    // point à chaque soutien, et le report ne s'annule pas.
    v -= Math.max(0, etat.reports - REPORTS_GRATUITS);
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
      phrase: "Vous avez dépensé plus que vous n'avez trouvé. C'est un choix, il a un coût, il est affiché.",
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
    phrase: "Moitié recettes, moitié coupes : le plan qui fâche tout le monde un peu.",
  };
}

/* --------------------------------------------------------------------------
 * Le défi : un plan qui voyage dans l'adresse.
 *
 * `?defi=12500~ecole-sante.sans-impot` : le comblé à battre en M€, puis les
 * engagements signés, séparés par des points. Rien d'autre ne voyage — ni le
 * détail des tampons (la partie de l'adversaire lui appartient), ni le profil
 * (il se recalcule). Un défi illisible est ignoré en silence : une adresse
 * abîmée ouvre le simulateur normal, jamais une erreur.
 * ----------------------------------------------------------------------- */

export function encoderDefi(etat: EtatTunnel): string {
  const engagements = etat.engagements.filter((cle) => CONTRATS.some((c) => c.cle === cle));
  return `v2~${etat.mode}~${etat.graine.toString(36)}~${Math.round(comble(etat)).toString(36)}~${encodeURIComponent(engagements.join(","))}`;
}

export function decoderDefi(texte: string | null): DefiTunnel | null {
  if (!texte) return null;
  if (texte.startsWith("v2~")) {
    const segments = texte.split("~");
    if (segments.length !== 5) return null;
    const [, mode, bruteGraine, brutScore, brutsEngagements] = segments;
    if ((mode !== "express" && mode !== "integral") || !/^[0-9a-z]+$/.test(bruteGraine ?? "") || !/^[0-9a-z]+$/.test(brutScore ?? "")) return null;
    const graine = Number.parseInt(bruteGraine!, 36);
    const combleM = Number.parseInt(brutScore!, 36);
    if (!estGraineValide(graine) || !Number.isSafeInteger(combleM) || combleM > 10_000_000) return null;
    let csv: string;
    try {
      csv = decodeURIComponent(brutsEngagements ?? "");
    } catch {
      return null;
    }
    const engagements = (csv ? csv.split(",") : []).filter((cle) => CONTRATS.some((c) => c.cle === cle));
    return { comble: combleM, engagements, mode, graine };
  }
  const [brut, reste] = texte.split("~", 2);
  const combleM = Number(brut);
  if (!Number.isFinite(combleM) || combleM < 0 || combleM > 10_000_000) return null;
  const engagements = (reste ? reste.split(".") : []).filter((cle) =>
    CONTRATS.some((c) => c.cle === cle),
  );
  return { comble: Math.round(combleM), engagements };
}
export const DECORATIONS: { id: string; nom: string; detail: string }[] = [
  { id: "equilibre", nom: "L'équilibre", detail: "Plus un euro à trouver." },
  { id: "sans-censure", nom: "Jamais censuré", detail: "Finir la pile, les quatre soutiens debout." },
  { id: "parole-x4", nom: "Parole tenue ×4", detail: "Jouer sous les quatre engagements à la fois." },
  { id: "zero-impot", nom: "Zéro impôt levé", detail: "Aucune recette nouvelle adoptée." },
  { id: "funambule", nom: "Le funambule", detail: "Finir avec un soutien à 15 % ou moins, sans tomber." },
  { id: "duel-gagne", nom: "Duel gagné", detail: "Battre le score d'un défi reçu." },
  { id: "grand-chelem", nom: "Le grand chelem", detail: "Trois paliers, et les quatre soutiens à 40 % ou plus." },
  { id: "integrale", nom: "L'intégrale", detail: "Tamponner les 78 mesures, sans engagement pour alléger la pile." },
];

/** Les décorations que CETTE partie vient de gagner — au verdict seulement. */
export function decorations(etat: EtatTunnel, missionEuros: number): typeof DECORATIONS {
  if (etat.phase !== "verdict") return [];
  const jauges = soutiens(etat, missionEuros);
  const combleM = comble(etat);
  const reste = Math.max(0, missionEuros - combleM * 1e6);
  const paliers = paliersTunnel(etat, missionEuros).filter((x) => x.franchi).length;
  const finie = !etat.censure;
  const gagnees = new Set<string>();
  if (reste === 0) gagnees.add("equilibre");
  if (finie) gagnees.add("sans-censure");
  if (finie && etat.engagements.length === CONTRATS.length) gagnees.add("parole-x4");
  if (
    finie &&
    combleM > 0 &&
    !etat.ordre.some(
      (id) => etat.tampons[id] === "adopte" && PAR_ID.get(id)?.bloqueePar?.includes("sans-impot"),
    )
  ) {
    gagnees.add("zero-impot");
  }
  if (finie && jauges.some((j) => j.valeur <= 15)) gagnees.add("funambule");
  if (finie && etat.defi && combleM > etat.defi.comble) gagnees.add("duel-gagne");
  if (finie && paliers >= 3 && jauges.every((j) => j.valeur >= 40)) gagnees.add("grand-chelem");
  if (finie && etat.ordre.length === MESURES.length) gagnees.add("integrale");
  return DECORATIONS.filter((d) => gagnees.has(d.id));
}
