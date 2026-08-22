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
 * Un seul tampon par mesure : ADOPTER applique l'effet, REJETER est gratuit
 * pour le compteur mais pas pour les soutiens des cartes totem (le second
 * prix, affiché sur la carte : c'est le dilemme), AJOURNER renvoie la mesure
 * en fin de pile — une fois tamponnée, on ne revient pas, comme en conseil.
 * Au-delà de `REPORTS_GRATUITS` ajournements, chaque report coûte un point à
 * chaque soutien : l'immobilisme se paie. Les engagements signés au départ (les
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

/** `exclue` : écartée d'office parce qu'une mesure incompatible a été
 *  adoptée — on ne vote pas deux barèmes de l'IR. */
export type Tampon = "adopte" | "rejete" | "exclue";

export type Phase = "mission" | "conseil" | "verdict";

export type EtatTunnel = {
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

export function etatInitial(defi?: { comble: number; engagements: string[] } | null): EtatTunnel {
  if (!defi) {
    return { phase: "mission", engagements: [], ordre: [], tampons: {}, historique: [], telex: { vus: [], surcout: 0, soutiens: {} }, reports: 0 };
  }
  // Un défi pré-signe les engagements de l'adversaire : « faites mieux, sous
  // les mêmes règles ». Le joueur peut les dédire — le verdict comparera
  // quand même, et c'est sa partie qui le dira.
  return {
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
    ordre: pile(etat.engagements).map((m) => m.id),
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
  return `${Math.round(comble(etat))}${engagements.length ? "~" + engagements.join(".") : ""}`;
}

export function decoderDefi(texte: string | null): { comble: number; engagements: string[] } | null {
  if (!texte) return null;
  const [brut, reste] = texte.split("~", 2);
  const combleM = Number(brut);
  if (!Number.isFinite(combleM) || combleM < 0 || combleM > 10_000_000) return null;
  const engagements = (reste ? reste.split(".") : []).filter((cle) =>
    CONTRATS.some((c) => c.cle === cle),
  );
  return { comble: Math.round(combleM), engagements };
}

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
    if (!Array.isArray(lu.ordre) || !lu.ordre.every((id) => PAR_ID.has(id))) return null;
    if (lu.phase !== "mission" && lu.ordre.length === 0) return null;
    return {
      phase: lu.phase,
      engagements: (lu.engagements ?? []).filter((cle) => CONTRATS.some((c) => c.cle === cle)),
      ordre: lu.ordre,
      tampons: Object.fromEntries(
        Object.entries(lu.tampons ?? {}).filter(
          ([id, t]) => PAR_ID.has(id) && (t === "adopte" || t === "rejete" || t === "exclue"),
        ),
      ),
      historique: Array.isArray(lu.historique)
        ? lu.historique.filter(
            (h) => h && PAR_ID.has(h.id) && Array.isArray(h.exclues) && h.exclues.every((i) => PAR_ID.has(i)),
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

/* --------------------------------------------------------------------------
 * Les décorations : ce qu'une partie raconte d'elle-même.
 *
 * Huit, pas une de plus — une vitrine pleine ne se regarde plus. Chacune se
 * décrit par ce qu'il a fallu FAIRE, jamais par un jugement, et la collection
 * (toutes parties confondues) vit dans `localStorage` : c'est le seul état du
 * tunnel qui mérite de survivre à la session, parce qu'une collection est une
 * promesse de revenir.
 * ----------------------------------------------------------------------- */

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

export function renduVerdict(etat: EtatTunnel, missionEuros: number): string {
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

/** L'adresse qui porte le défi : la même pile, les mêmes engagements, le
 *  score à battre. */
export function adresseDefi(etat: EtatTunnel): string {
  return `${location.origin}/simulateur?defi=${encodeURIComponent(encoderDefi(etat))}`;
}

/** Le texte du bilan à coller ailleurs — la version défi du verdict. */
export function bilanTexte(etat: EtatTunnel, missionEuros: number): string {
  const p = profil(etat);
  const nFranchis = paliersTunnel(etat, missionEuros).filter((x) => x.franchi).length;
  return (
    `${p.nom} : ${millions(comble(etat) * 1e6)} trouvés sur les ${compteur(missionEuros)} ` +
    `qui manquent aux budgets publics (${nFranchis} palier${nFranchis > 1 ? "s" : ""} sur 4). ` +
    `Faites mieux : ${adresseDefi(etat)}`
  );
}

function renduPied(): string {
  return `<p class="tunnel__source">La mission est calculée sur les budgets publiés. Les effets
    des mesures sont des ordres de grandeur du débat public (lois de finances, rapports
    parlementaires, chiffrages d'instituts), affichés avec leurs réserves. Les réactions des
    soutiens, à l'adoption comme au rejet, et les issues des télex sont des
    règles du jeu, pas des mesures.</p>`;
}

export function rendu(etat: EtatTunnel, missionEuros: number): string {
  const corps =
    etat.phase === "mission"
      ? renduMission(etat, missionEuros)
      : etat.phase === "conseil"
        ? renduConseil(etat, missionEuros)
        : renduVerdict(etat, missionEuros);
  // La porte de sortie du plein écran : le seul lien vers le site quand le
  // tunnel occupe tout l'écran. Invisible hors plein écran (style.css).
  return `<div class="tunnel__cadre"><a class="tunnel__quitter" href="/">&#8592;&nbsp;Quitter le conseil</a>${corps}${renduPied()}</div>`;
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
