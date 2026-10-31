/**
 * Le récit : une seule page qui se lit en défilant, de la facture de la France jusqu'au jeu.
 * Elle remplace l'accueil, France et Ville (décision du propriétaire, 31 octobre 2026).
 *
 * Rendu pur, partagé par le pré-rendu et le navigateur. La scène (visuels) reste collée à
 * l'écran ; les cartes de texte défilent par-dessus et la pilotent (runtime.ts).
 * Sans JavaScript, les cartes se lisent en continu.
 */
import type { Territoire } from "../donnees.ts";
import { echapper } from "../texte.ts";
import {
  comptes, comparaison, dette, PAIE, PENSIONS_EDUCATION, periodeLisible, prelevements, repartition, repereFrance, SOURCES,
} from "./calculs.ts";

export const CHAPITRES = [
  ["facture", "La facture"], ["recettes", "Les recettes"], ["deficit", "Le déficit"], ["dette", "La dette"],
  ["argent", "Où va l’argent"], ["europe", "En Europe"], ["salaire", "Votre salaire"], ["ville", "Votre ville"], ["mandats", "Mandats"],
] as const;
export type Chapitre = typeof CHAPITRES[number][0];
export type Chapitres = readonly (readonly [string, string])[];

/** Une carte du récit. L'année est écrite dans `lib` ; les sources sont listées en pied de page. */
export type Etape = {
  chapitre: string;
  tableau: string;
  k?: number;
  titre: string;
  lib?: string;
  valeur?: number;
  decimales?: number;
  unite?: string;
  sous?: string;
  ton?: "or" | "argile";
  desc?: string;
  direct?: boolean;
  contenu?: string;
  attributs?: Record<string, string>;
};

const md = (n: number) => n / 1e9;
const nombre = (d: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Espace insécable ordinaire : l’espace fine de l’Intl est invisible dans certaines graisses. */
export const fmt = (n: number, d = 0) => nombre(d).format(n).replace(/\u202f/g, "\u00a0");

export function etapesFrance(pays: Record<string, Territoire | undefined>): Etape[] {
  const france = pays.FR;
  const c = comptes(france);
  if (!c) return [];
  const a = c.annee;
  const e: Etape[] = [];
  const t1 = "Chaque année, la France <em>dépense</em>…";
  e.push({ chapitre: "facture", tableau: "carte", k: 1, titre: t1, lib: `Dépenses publiques · ${a}`, valeur: md(c.depenses), decimales: 1, unite: "Md€", sous: "État, Sécurité sociale, collectivités" });
  const pop = france?.population;
  if (pop && pop > 0) e.push({ chapitre: "facture", tableau: "carte", k: 2, titre: "Ramené à <em>chacun</em>.", lib: `Par habitant · ${a}`, valeur: Math.round(c.depenses / pop), unite: "€", sous: `${fmt(md(c.depenses), 1)} Md€ ÷ ${fmt(pop / 1e6, 1)} millions d’habitants`, desc: "Bébés et retraités compris." });

  e.push({ chapitre: "recettes", tableau: "billets", titre: "D’où vient <em>l’argent</em>&nbsp;?", lib: `Recettes publiques · ${a}`, valeur: md(c.recettes), decimales: 1, unite: "Md€", sous: "Impôts, cotisations, autres recettes", ton: "or", desc: "TVA, CSG, impôt sur le revenu, cotisations sur les salaires…" });
  const po = prelevements(france);
  if (po) e.push({ chapitre: "recettes", tableau: "billets", k: 1, titre: po.part >= 40 ? "Près de <em>la moitié</em> de la richesse produite." : "Une part de <em>la richesse produite</em>.", lib: `Prélèvements obligatoires · ${po.annee}`, valeur: po.part, decimales: 1, unite: "% du PIB", desc: "Impôts et cotisations sociales, rapportés à tout ce que le pays produit en un an." });

  const t3 = "Ce qui entre, <em>ce qui sort</em>.";
  e.push({ chapitre: "deficit", tableau: "ecart", k: 0, titre: t3, lib: `Recettes · ${a}`, valeur: md(c.recettes), decimales: 1, unite: "Md€", sous: `face à ${fmt(md(c.depenses), 1)} Md€ de dépenses` });
  if (c.nature === "deficit") {
    e.push({ chapitre: "deficit", tableau: "ecart", k: 1, titre: "Il manque <em>chaque année</em>…", lib: `Déficit public · ${a}`, valeur: md(c.ecart), decimales: 1, unite: "Md€", sous: `${fmt(c.ecart / c.recettes * 100, 2)} € empruntés pour 100 € de recettes`, ton: "argile" });
    const parSeconde = c.ecart / (365 * 24 * 3600);
    e.push({ chapitre: "deficit", tableau: "ecart", k: 1, direct: true, titre: "Depuis que vous lisez <em>cette page</em>…", lib: "Emprunté depuis votre arrivée", valeur: parSeconde, unite: "€", sous: `${fmt(parSeconde, 0)} € par seconde, en moyenne`, ton: "argile" });
  } else {
    e.push({ chapitre: "deficit", tableau: "ecart", k: 1, titre: t3, lib: `${c.nature === "excedent" ? "Excédent" : "Équilibre"} · ${a}`, valeur: md(Math.abs(c.ecart)), decimales: 1, unite: "Md€",  });
  }

  const d = dette(france);
  if (d) {
    const quand = periodeLisible(d.periode);
    const annees = d.stock / c.recettes;
    e.push({ chapitre: "dette", tableau: "dette", k: 0, titre: "Les déficits <em>s’accumulent</em>.", lib: `Dette publique · ${quand}`, valeur: md(d.stock), decimales: 0, unite: "Md€", sous: d.partPib !== undefined ? `${fmt(d.partPib, 1)} % du PIB` : undefined, ton: "argile", desc: `Soit ${fmt(annees, 1)} années de recettes publiques (${a}).`, attributs: { "data-dette": String(md(d.stock)), "data-recettes": String(md(c.recettes)) } });
    if (d.interets) e.push({ chapitre: "dette", tableau: "dette", k: 1, titre: "Et la dette <em>coûte</em>.", lib: `Intérêts versés · ${d.interets.annee}`, valeur: md(d.interets.montant), decimales: 1, unite: "Md€", sous: `${fmt(d.interets.montant / c.recettes * 100, 2)} € sur 100 € de recettes`, ton: "argile" });
  }

  const r = repartition(france);
  if (r) {
    const t4 = "Pour 100 € de recettes, <em>où va l’argent&nbsp;?</em>";
    const DESC: Record<string, string> = { Retraites: "Pensions de retraite et de réversion, fonctionnaires compris.", "Rémunérations des agents publics": "Agents de l’État, des hôpitaux et des collectivités.", "Soins et services remboursés": "Soins, médicaments et services remboursés aux ménages.", "Achats de biens et services": "Fournitures, énergie, prestations achetées.", Investissement: "Routes, bâtiments, équipements, défense.", "Intérêts de la dette": "Le coût de la dette déjà accumulée." };
    r.postes.slice(0, 6).forEach((p, i) => {
      e.push({ chapitre: "argent", tableau: "arbre", k: i, titre: t4, lib: `${p.nom} · ${r.annee}`, valeur: p.part, decimales: 2, unite: "€", sous: `sur 100 € de recettes`, desc: DESC[p.nom] });
      if (p.nom === "Retraites") {
        const pe = PENSIONS_EDUCATION;
        e.push({ chapitre: "argent", tableau: "bercy", titre: "Un tiers du budget de l’Éducation <em>paie des retraites</em>.", lib: `Éducation nationale · budget ${pe.annee}`, valeur: pe.part, unite: "€", sous: "sur 100 € servent aux retraites des anciens agents", ton: "argile", desc: `${fmt(pe.pensions, 1)} Md€ sur ${fmt(pe.credits, 1)} Md€. Cet argent fait déjà partie des ${fmt(p.part, 2)} € des retraites.` });
      }
    });
    e.push({ chapitre: "argent", tableau: "arbre", k: 9, titre: t4, lib: `Au total · ${r.annee}`, valeur: r.total, decimales: 2, unite: "€", sous: r.total > 100 ? `${fmt(r.total - 100, 2)} € de plus que ce qui est entré` : undefined, ton: r.total > 100 ? "argile" : undefined });
  }

  const dep = comparaison(pays, "eurostat_depenses_publiques_pib");
  const dpib = comparaison(pays, "eurostat_dette_pib");
  const RANGS = ["", "première", "deuxième", "troisième", "quatrième"];
  for (const [k, comp, sujet, lib] of [[0, dep, "dépense", "Dépenses publiques"], [1, dpib, "dette", "Dette publique"]] as const) {
    if (!comp) continue;
    const fr = comp.valeurs.find(v => v.code === "FR")!;
    const rang = 1 + comp.valeurs.filter(v => v.valeur > fr.valeur).length;
    const titre = sujet === "dépense"
      ? (rang === 1 ? "La France dépense <em>plus que ses voisins</em>." : `La <em>${RANGS[rang]}</em> dépense publique des quatre.`)
      : (rang === 1 ? "Et elle est <em>la plus endettée</em> des quatre." : `La <em>${RANGS[rang]}</em> dette publique des quatre.`);
    const autres = comp.valeurs.filter(v => v.code !== "FR").map(v => `${v.nom} ${fmt(v.valeur, 1)} %`).join(" · ");
    e.push({ chapitre: "europe", tableau: "europe", k, titre, lib: `${lib} · ${comp.annee}`, valeur: fr.valeur, decimales: 1, unite: "% du PIB", sous: autres, attributs: { "data-europe": JSON.stringify(comp.valeurs.map(v => [v.nom, v.valeur])) } });
  }

  const paie = etapesPaie("salaire");
  paie[paie.length - 1].contenu = `<a class="etape__lien" href="/salaires/">Voir où va cet argent</a>`;
  e.push(...paie);
  return e;
}

/**
 * Le salaire, de ce que paie l'employeur à ce qui reste (OCDE, salaire moyen, célibataire sans enfant).
 * Partagé par le récit et la page Salaires ; le visuel est `vuePaie()`.
 */
export function etapesPaie(chapitre: string): Etape[] {
  const brut = 100 - PAIE.patronales, net = brut - PAIE.salariales;
  const e: Etape[] = [
    { chapitre, tableau: "paie", k: 0, titre: "Votre salaire, <em>vu par votre employeur</em>.", lib: "Ce que paie l’employeur · 2025", valeur: 100, decimales: 2, unite: "€", sous: "pour un salarié payé au salaire moyen", ton: "or", desc: "Célibataire, sans enfant. Suivons ces 100 € jusqu’à son compte en banque." },
    { chapitre, tableau: "paie", k: 1, titre: `Avant même la fiche de paie, <em>${fmt(PAIE.patronales, 2)} € partent</em>.`, lib: "Cotisations patronales", valeur: PAIE.patronales, decimales: 2, unite: "€", sous: `Il reste ${fmt(brut, 2)} € : le salaire brut`, ton: "argile", desc: "Elles financent les retraites, l’assurance maladie, le chômage et les allocations familiales." },
    { chapitre, tableau: "paie", k: 2, titre: `Sur la fiche de paie, <em>${fmt(PAIE.salariales, 2)} € de plus</em>.`, lib: "Cotisations salariales et CSG", valeur: PAIE.salariales, decimales: 2, unite: "€", sous: `Il reste ${fmt(net, 2)} € : le net avant impôt`, ton: "argile", desc: "Retraite complémentaire, CSG et CRDS, retenues avant le virement." },
    { chapitre, tableau: "paie", k: 3, titre: "Puis <em>l’impôt sur le revenu</em>.", lib: "Prélevé à la source", valeur: PAIE.impot, decimales: 2, unite: "€", sous: `Il reste ${fmt(PAIE.reste, 2)} €`, ton: "argile" },
    { chapitre, tableau: "paie", k: 4, titre: `Au bout du compte, <em>il reste ${fmt(PAIE.reste, 2)} €</em>.`, lib: "Ce que le salarié garde", valeur: PAIE.reste, decimales: 2, unite: "€", sous: `${fmt(100 - PAIE.reste, 2)} € sont partis aux caisses publiques`, ton: "or" },
  ];
  return e;
}

/** Le visuel du salaire : quatre barres sur la même échelle de 100 €, chaque prélèvement en argile. */
export function vuePaie(): string {
  const brut = 100 - PAIE.patronales, net = brut - PAIE.salariales;
  const lignes: [string, number, number, string][] = [
    ["Ce que paie l’employeur", 100, 0, ""], ["Salaire brut", brut, PAIE.patronales, "cotisations patronales"],
    ["Net avant impôt", net, PAIE.salariales, "cotisations salariales et CSG"], ["Ce qui reste", PAIE.reste, PAIE.impot, "impôt sur le revenu"],
  ];
  return `<div class="viz viz--paie" data-viz="paie">${lignes.map(([nom, garde, part, quoi], i) => `<div class="paie__ligne" data-i="${i}">
    <p><span>${nom}</span><b>${fmt(garde, 2)}&nbsp;€</b></p>
    <div class="paie__barre"><i class="garde" style="--w:${garde}%"></i>${part ? `<i class="part" style="--x:${garde}%;--w:${part}%"></i>` : ""}</div>
    ${part ? `<small>−${fmt(part, 2)}&nbsp;€ ${quoi}</small>` : ""}
  </div>`).join("")}</div>`;
}

/** La carte de recherche de commune ; les étapes de la ville choisie s'insèrent juste après. */
export function etapeRechercheVille(pays: Record<string, Territoire | undefined> = {}): Etape {
  return {
    chapitre: "ville", tableau: "ville", k: 0, titre: "Et dans <em>votre</em> ville&nbsp;?",
    desc: "Budget, impôts, associations, sécurité : les chiffres de votre commune.",
    attributs: { "data-france": JSON.stringify(repereFrance(pays.FR)) },
    contenu: `<form class="ville-recherche" action="/" method="get" role="search">
      <label class="sr-only" for="ville-champ">Rechercher une commune</label>
      <input id="ville-champ" name="ville" placeholder="Nom de votre commune" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="ville-suggestions" aria-autocomplete="list" required minlength="2">
      <button type="submit">Voir</button>
      <ul class="ville-suggestions" id="ville-suggestions" role="listbox" hidden></ul>
      <p class="ville-etat" role="status" aria-live="polite"></p>
    </form>`,
  };
}

export function etapeMandats(pays: Record<string, Territoire | undefined>): Etape {
  const c = comptes(pays.FR);
  return {
    chapitre: "mandats", tableau: "final", titre: "À vous de <em>gouverner</em>.",
    desc: "Cinq ans à l’Élysée. Le budget, l’Assemblée, la rue, les marchés : chaque décision a un prix.",
    contenu: `<div class="final__ligne"><span><b>5 ans</b>de mandat</span><span><b>577</b>députés</span>${c?.nature === "deficit" ? `<span><b>${fmt(md(c.ecart), 1)} Md€</b>de déficit à reprendre</span>` : ""}</div>
      <a class="final__cta" href="/mandats/">Commencer mon mandat</a><p class="final__note">Jeu gratuit, sans compte. Les résultats de la partie sont simulés.</p>`,
  };
}

export function renduEtape(x: Etape, i: number, h1 = false, chapitres: Chapitres = CHAPITRES): string {
  const balise = h1 ? "h1" : "h2";
  const chiffre = x.valeur === undefined ? "" : `<p class="etape__lib">${echapper(x.lib ?? "")}</p><p class="etape__gros" data-valeur="${x.valeur}" data-decimales="${x.decimales ?? 0}" data-unite="${echapper(x.unite ?? "")}"${x.direct ? " data-direct" : ""}>${x.direct ? "0" : fmt(x.valeur, x.decimales ?? 0)}<span class="etape__u">${echapper(x.unite ?? "")}</span></p>${x.sous ? `<p class="etape__sous${x.ton ? ` ${x.ton}` : ""}">${echapper(x.sous)}</p>` : ""}`;
  const attrs = Object.entries(x.attributs ?? {}).map(([k, v]) => ` ${k}="${echapper(v)}"`).join("");
  return `<section class="etape" data-i="${i}" data-chapitre="${x.chapitre}" data-tableau="${x.tableau}"${x.k !== undefined ? ` data-k="${x.k}"` : ""}${attrs}>
    <div class="etape__carte">
      <p class="etape__chap">${echapper(chapitres.find(([c]) => c === x.chapitre)?.[1] ?? "")}</p>
      <${balise} class="etape__titre">${x.titre}</${balise}>${chiffre}${x.desc ? `<p class="etape__desc">${echapper(x.desc)}</p>` : ""}${x.contenu ?? ""}
    </div>
  </section>`;
}

const VILLES_CARTE: [string, number, number][] = [["Paris", 59, 27], ["Lille", 61, 15], ["Strasbourg", 79, 30], ["Rennes", 43, 36], ["Nantes", 43, 46], ["Bordeaux", 47, 62], ["Toulouse", 55, 75], ["Montpellier", 65, 74], ["Marseille", 72, 77], ["Lyon", 70, 52], ["Nice", 81, 71], ["Clermont-Ferrand", 61, 55]];

function scene(pays: Record<string, Territoire | undefined>): string {
  const c = comptes(pays.FR);
  const r = repartition(pays.FR);
  const max = c ? Math.max(c.recettes, c.depenses) : 1;
  const barres = (rec: number, dep: number, m: number, cls = "") => `<div class="viz viz--ecart${cls}" data-viz="ecart"><div class="col"><div class="barre rec" style="--h:${(rec / m * 100).toFixed(2)}%"></div><p>Recettes<b>${fmt(md(rec), 1)} Md€</b></p></div><div class="col"><div class="barre dep" style="--h:${(dep / m * 100).toFixed(2)}%"><div class="trou" style="--t:${(Math.max(0, dep - rec) / Math.max(dep, 1) * 100).toFixed(2)}%"></div></div><p>Dépenses<b>${fmt(md(dep), 1)} Md€</b></p></div></div>`;
  return `<div class="recit__scene" aria-hidden="true">
    <div class="fond fond--carte"><div class="plan"><div class="carte"><img src="/mandats/art/national-relief-1536.webp" alt="" width="1536" height="1024" fetchpriority="high">${VILLES_CARTE.map(([n, x, y], i) => `<i class="lumiere" style="left:${x}%;top:${y}%;--d:${(i * .3).toFixed(1)}s" data-n="${n}"></i>`).join("")}</div></div><div class="voile"></div></div>
    <div class="fond fond--hemi"><div class="plan"></div><div class="voile"></div></div>
    <canvas class="fx"></canvas>
    <div class="zone">
      ${c ? barres(c.recettes, c.depenses, max) : ""}
      <div class="viz viz--dette" data-viz="dette"><div class="col"><div class="barre dette"></div><p>Dette<b data-v="dette"></b></p></div><div class="col"><div class="barre rec"></div><p>Une année de recettes<b data-v="recettes"></b></p></div></div>
      ${r ? `<div class="viz viz--arbre" data-viz="arbre" data-postes='${echapper(JSON.stringify(r.postes.map(p => [p.nom.replace("Rémunérations des agents publics", "Rémunérations").replace("Soins et services remboursés", "Soins remboursés").replace("Achats de biens et services", "Achats"), Math.round(p.part * 100) / 100])))}'></div>` : ""}
      <div class="viz viz--bercy" data-viz="bercy"><p class="leg"><span><b class="p"></b>Retraites · ${PENSIONS_EDUCATION.part} €</span><span><b></b>Le reste du budget · ${100 - PENSIONS_EDUCATION.part} €</span></p><div class="cent">${Array.from({ length: 100 }, (_, i) => `<i${i < PENSIONS_EDUCATION.part ? ' class="p"' : ""} style="--k:${i}"></i>`).join("")}</div></div>
      <div class="viz viz--europe" data-viz="europe"></div>
      ${vuePaie()}
      <div class="viz viz--ville" data-viz="ville"></div>
    </div>
  </div>`;
}

export function rail(chapitres: Chapitres = CHAPITRES): string {
  return `<nav class="recit__rail" aria-label="Chapitres" style="--n:${chapitres.length}"><ol>${chapitres.map(([c, nom]) => `<li><a href="#${c}" data-rail="${c}"><i></i><span>${nom}</span></a></li>`).join("")}</ol></nav>`;
}

export function sources(liste: readonly { nom: string; titre: string; url: string }[] = Object.values(SOURCES)): string {
  return `<footer class="recit__pied" id="sources">
    <div class="pied__bloc"><h2>Les chiffres, à la source.</h2>
      <p>Chaque montant de cette page vient d’une des publications officielles ci-dessous. L’année de chaque chiffre est écrite juste au-dessus de lui.</p>
      <ul class="pied__sources">${liste.map(s => `<li><a href="${s.url}" rel="noreferrer noopener" target="_blank">${echapper(s.nom)}</a><span>${echapper(s.titre)}</span></li>`).join("")}</ul>
    </div>
    <div class="pied__bloc"><h2>Le projet.</h2>
      <p>500 Signatures rend les comptes publics lisibles par tous, puis vous laisse gouverner dans Mandats. Le site est gratuit, sans compte et indépendant de tout parti.</p>
      <p class="pied__liens"><a href="/salaires/">Salaires</a><a href="/mandats/">Mandats</a><a href="/confidentialite/">Confidentialité</a><a href="https://x.com/500Signatures" rel="noreferrer noopener" target="_blank">500 Signatures sur X</a></p>
    </div>
  </footer>`;
}

/** La page entière. Sans comptes publiés, une introduction honnête remplace le récit chiffré. */
export function renduRecit(pays: Record<string, Territoire | undefined>): string {
  const france = etapesFrance(pays);
  if (!france.length) {
    return `<div class="recit recit--vide" data-recit-vide><section class="etape"><div class="etape__carte"><h1 class="etape__titre">Les comptes publics, <em>à portée de main</em>.</h1><p class="etape__desc">Les comptes nationaux sont momentanément indisponibles. Vous pouvez chercher votre commune ou jouer à Mandats.</p></div></section>${renduEtape(etapeRechercheVille(pays), 0)}${renduEtape(etapeMandats(pays), 1)}${sources()}</div>`;
  }
  const etapes = [...france, etapeRechercheVille(pays), etapeMandats(pays)];
  const html = etapes.map((x, i) => {
    const debut = etapes.findIndex(y => y.chapitre === x.chapitre) === i;
    const ancre = debut ? `<span class="ancre" id="${x.chapitre}"></span>` : "";
    return ancre + renduEtape(x, i, i === 0) + (x.tableau === "ville" ? `<div class="recit__ville" data-ville-etapes></div>` : "");
  }).join("");
  return `<div class="recit" data-recit>
    ${scene(pays)}
    <div class="recit__flux">${rail()}${html}</div>
    ${sources()}
  </div>`;
}
