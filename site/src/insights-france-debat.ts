import type { Indicateur, Territoire } from "./donnees.ts";
import { periodeCommune, type Insight, type PreuveInsight } from "./insights.ts";

type Series = Territoire["series"];

const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function preuve(indicateur: string, periode: string, valeur: number, libelle: string): PreuveInsight {
  return { indicateur, periode, valeur, libelle };
}

function unite(catalogue: Indicateur[], id: string, attendue: string): boolean {
  return catalogue.find((indicateur) => indicateur.id === id)?.unite === attendue;
}

function milliards(valeur: number): string {
  return `${entier.format(valeur / 1_000_000_000)} Md€`;
}

const OFFICIELLES: Insight[] = [
  {
    id: "ir-foyers-imposes",
    famille: "fiscalite",
    surtitre: "Impôt sur le revenu · qui paie",
    titre: "47 % des foyers paient l'impôt sur le revenu",
    texte: "Sur 41,5 millions de foyers fiscaux, 19,6 millions ont payé un impôt net sur leurs revenus de 2024.",
    reserve: "",
    sourceIds: ["dgfip-ir-2024"],
    preuves: [],
  },
  {
    id: "tres-hauts-revenus",
    famille: "fiscalite",
    surtitre: "Revenus · tout en haut de l'échelle",
    titre: "Les revenus du 0,1 % ont augmenté de 119 % depuis 2003",
    texte: "Pour les autres foyers, la hausse atteint 46 %. Les 40 700 foyers concernés acquittent 13 % de l'impôt sur le revenu.",
    reserve: "",
    sourceIds: ["insee-tres-hauts-revenus"],
    preuves: [],
  },
  {
    id: "redistribution-ocde",
    famille: "services",
    surtitre: "Redistribution · le résultat comparé",
    titre: "La redistribution réduit la pauvreté de 28 points",
    texte: "C'est la plus forte réduction mesurée par l'OCDE parmi les pays étudiés.",
    reserve: "",
    sourceIds: ["ocde-redistribution"],
    preuves: [],
  },
  {
    id: "pauvrete-actifs-retraites",
    famille: "generation",
    surtitre: "Générations · revenus et patrimoine",
    titre: "Actifs et retraités : 10,4 % de pauvreté chacun",
    texte: "Le taux est identique en 2024. Après 70 ans, 74 % des ménages possèdent un bien immobilier et 51 % une assurance-vie.",
    reserve: "",
    sourceIds: ["insee-pauvrete-2024", "insee-patrimoine-age"],
    preuves: [],
  },
  {
    id: "majoration-trois-enfants",
    famille: "generation",
    surtitre: "Retraites · l'avantage familial",
    titre: "8 Md€ pour la majoration de pension à trois enfants",
    texte: "Elle représente 2,9 % des pensions directes et ne modifie presque pas la distribution des pensions entre retraités.",
    reserve: "",
    sourceIds: ["drees-majoration-enfants"],
    preuves: [],
  },
  {
    id: "projection-charge-dette",
    famille: "budget",
    surtitre: "Dette · le risque de refinancement",
    titre: "112 Md€ d'intérêts en 2029 dans le scénario dégradé",
    texte: "La Cour des comptes chiffre alors la charge à 3,4 % du PIB, devant le budget de l'enseignement scolaire.",
    reserve: "",
    sourceIds: ["cour-comptes-finances-2025"],
    preuves: [],
  },
  {
    id: "surtaxe-exceptionnelle-prolongee",
    famille: "fiscalite",
    surtitre: "Entreprises · l'exception qui dure",
    titre: "La contribution exceptionnelle est prolongée en 2026",
    texte: "Créée pour un exercice, la contribution sur les bénéfices des grandes entreprises s'applique un exercice de plus.",
    reserve: "",
    sourceIds: ["bofip-contribution-exceptionnelle-2026"],
    preuves: [],
  },
  {
    id: "sncf-financement-public",
    famille: "services",
    surtitre: "Transport · le chiffre qui circule",
    titre: "20 Md€ pour la SNCF ? Le total mélange plusieurs dépenses",
    texte: "Il additionne compensations de service public, TER, infrastructures et retraites. Les subventions d'investissement atteignaient 7 Md€ en 2023.",
    reserve: "",
    sourceIds: ["assemblee-nationale-sncf"],
    preuves: [],
  },
];

function insightChargeDetteSurIr(series: Series, catalogue: Indicateur[]): Insight | null {
  const detteId = "etat_charge_dette";
  const irId = "etat_impot_revenu";
  if (!unite(catalogue, detteId, "EUR") || !unite(catalogue, irId, "EUR")) return null;
  const periode = periodeCommune([series[detteId], series[irId]]);
  if (!periode) return null;
  const dette = series[detteId][periode];
  const ir = series[irId][periode];
  if (dette < 0 || !(ir > 0)) return null;
  const rapport = (dette / ir) * 100;
  return {
    id: "charge-dette-sur-ir",
    famille: "budget",
    surtitre: "Dette · une recette fiscale comme repère",
    titre: `La charge de la dette vaut ${entier.format(rapport)} € pour 100 € d'impôt sur le revenu`,
    texte: `En ${periode}, elle atteint ${milliards(dette)}, contre ${milliards(ir)} d'impôt sur le revenu.`,
    reserve: "",
    preuves: [
      preuve(detteId, periode, dette, "Charge de la dette"),
      preuve(irId, periode, ir, "Impôt sur le revenu"),
    ],
  };
}

function periodesCommunes(a?: Record<string, number>, b?: Record<string, number>): string[] {
  if (!a || !b) return [];
  return Object.keys(a)
    .filter((periode) => periode >= "2017" && Number.isFinite(a[periode]) && Number.isFinite(b[periode]))
    .sort((periodeA, periodeB) => periodeA.localeCompare(periodeB));
}

function insightRattrapagePologne(series: Series, pays?: Record<string, Territoire>): Insight | null {
  const id = "eurostat_pib_habitant_spa";
  const pologne = pays?.PL?.series[id];
  const periodes = periodesCommunes(series[id], pologne);
  if (periodes.length < 2) return null;
  const debut = periodes[0];
  const fin = periodes.at(-1)!;
  const franceDebut = series[id][debut];
  const franceFin = series[id][fin];
  const pologneDebut = pologne![debut];
  const pologneFin = pologne![fin];
  if (!(franceDebut > 0) || !(franceFin > 0) || pologneDebut < 0 || pologneFin < 0) return null;
  const ratioDebut = (pologneDebut / franceDebut) * 100;
  const ratioFin = (pologneFin / franceFin) * 100;
  const gain = ratioFin - ratioDebut;
  return {
    id: "rattrapage-pologne",
    famille: "travail",
    surtitre: "Europe · le rattrapage économique",
    titre: `Le niveau polonais atteint ${entier.format(ratioFin)} % du niveau français`,
    texte: `Il en représentait ${entier.format(ratioDebut)} % en ${debut}, soit ${decimal.format(Math.abs(gain))} points de ${gain >= 0 ? "rattrapage" : "recul"} en ${fin}.`,
    reserve: "",
    comparaison: `France ${entier.format(franceFin)} · Pologne ${entier.format(pologneFin)}, standard de pouvoir d'achat`,
    preuves: [
      preuve(id, debut, franceDebut, "France au départ"),
      preuve(id, fin, franceFin, "France à l'arrivée"),
      preuve(id, debut, pologneDebut, "Pologne au départ"),
      preuve(id, fin, pologneFin, "Pologne à l'arrivée"),
    ],
  };
}

export function insightsFranceDebat(
  series: Series,
  catalogue: Indicateur[],
  pays?: Record<string, Territoire>,
): Insight[] {
  const parId = new Map(OFFICIELLES.map((insight) => [insight.id, insight]));
  const charge = insightChargeDetteSurIr(series, catalogue);
  const pologne = insightRattrapagePologne(series, pays);
  return [
    parId.get("ir-foyers-imposes"),
    parId.get("tres-hauts-revenus"),
    parId.get("redistribution-ocde"),
    parId.get("pauvrete-actifs-retraites"),
    parId.get("majoration-trois-enfants"),
    parId.get("projection-charge-dette"),
    charge,
    parId.get("surtaxe-exceptionnelle-prolongee"),
    pologne,
    parId.get("sncf-financement-public"),
  ].filter((insight): insight is Insight => insight !== null && insight !== undefined);
}
