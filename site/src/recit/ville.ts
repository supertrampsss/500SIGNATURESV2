/**
 * Les étapes d'une commune choisie dans le récit. Rendu pur : comptes OFGL, impôts DGFiP,
 * délits SSMSI et portrait Insee de la commune, comparés à la France quand la définition est la même.
 * Une étape sans donnée disparaît.
 */
import { echapper } from "../texte.ts";
import type { RepereFrance, Ville } from "./calculs.ts";
import { fmt, renduEtape, type Etape } from "./rendu.ts";

const montant = (n: number) => Math.abs(n) >= 1e9 ? { valeur: n / 1e9, unite: "Md€", d: 2 } : { valeur: n / 1e6, unite: "M€", d: Math.abs(n) < 1e7 ? 2 : 1 };
const texteMontant = (n: number) => { const x = montant(n); return `${fmt(x.valeur, x.d)} ${x.unite}`; };

/** Une ligne de barres : nom, valeur (échelle), texte affiché, couleur, repère national, part hachurée et précision. */
export type LigneBarre = { n: string; v: number; t: string; c?: "or" | "argile" | "bleu" | "vert"; r?: number; rt?: string; p?: number; s?: string };
export type VueVille =
  | { mode: "ecart"; rec: number; dep: number; ouvert: boolean }
  | { mode: "barres"; lignes: LigneBarre[]; legende?: string; repere?: string }
  | { mode: "tuiles"; tuiles: [string, string, string?][] };

export function etapesVille(v: Ville, france: RepereFrance = {}): Etape[] {
  const nom = echapper(v.nom);
  const e: Etape[] = [];
  const vue = (sujet: string, x: VueVille) => ({ "data-sujet": sujet, "data-ville": JSON.stringify(x) });
  const parHab = (n: number) => v.population ? `${fmt(n / v.population)} € par habitant` : undefined;
  const barres = (lignes: [string, number][], c: LigneBarre["c"] = "bleu"): LigneBarre[] => lignes.map(([n, x]) => ({ n, v: x, t: texteMontant(x), c }));

  const r = montant(v.recettes);
  e.push({
    chapitre: "ville", tableau: "ville", k: 1, titre: `${nom} : <em>l’argent qui rentre</em> chaque année.`, lib: `Budget de l’année · ${v.annee}`, valeur: r.valeur, decimales: r.d, unite: r.unite, ton: "or",
    sous: parHab(v.recettes),
    desc: "De quoi payer le quotidien de la ville : agents, écoles, entretien, aides.",
    attributs: vue("recettes", v.entrees ? { mode: "barres", lignes: barres(v.entrees, "or") } : { mode: "ecart", rec: v.recettes, dep: v.depenses, ouvert: false }),
  });
  const d = montant(v.depenses);
  e.push({
    chapitre: "ville", tableau: "ville", k: 2, titre: `Et <em>ce qui en sort</em>.`, lib: `Dépenses du quotidien · ${v.annee}`, valeur: d.valeur, decimales: d.d, unite: d.unite,
    sous: v.epargne >= 0 ? `Il reste ${texteMontant(v.epargne)} pour rembourser et investir` : `Il manque ${texteMontant(-v.epargne)}`, ton: v.epargne >= 0 ? "or" : "argile",
    attributs: vue("depenses", v.sorties ? { mode: "barres", lignes: barres(v.sorties) } : { mode: "ecart", rec: v.recettes, dep: v.depenses, ouvert: true }),
  });

  if (v.missions && v.population) {
    const pop = v.population;
    const ecoles = v.missions.lignes.find(([n]) => n === "Écoles et formation") ?? v.missions.lignes[0];
    e.push({
      chapitre: "ville", tableau: "ville", k: 3, titre: "Mission par mission, <em>ce que paie la mairie</em>.", lib: `${ecoles[0]} · ${v.missions.annee}`, valeur: Math.round(ecoles[1] / pop), unite: "€", sous: "par habitant et par an",
      attributs: vue("missions", { mode: "barres", legende: "Par habitant", lignes: v.missions.lignes.map(([n, x]) => ({ n, v: x, t: `${fmt(x / pop)} €`, c: n === ecoles[0] ? "or" : "bleu" })) }),
    });
  }

  if (v.associations) {
    const a = v.associations, m = montant(a.montant);
    const lignes: LigneBarre[] = [{ n: `La mairie · ${a.annee}`, v: a.montant, t: texteMontant(a.montant), c: "or" }];
    if (a.etat) lignes.push({ n: `L’État · ${a.etat.annee}`, v: a.etat.montant, t: texteMontant(a.etat.montant), c: "bleu" });
    e.push({
      chapitre: "ville", tableau: "ville", k: 4, titre: "Les <em>associations</em> et les clubs.", lib: `Subventions de la mairie · ${a.annee}`, valeur: m.valeur, decimales: m.d, unite: m.unite, ton: "or",
      sous: parHab(a.montant),
      desc: a.etat ? `L’État a aussi versé ${texteMontant(a.etat.montant)} en ${a.etat.annee} à des associations installées dans la commune${a.etat.nombre ? ` (${fmt(a.etat.nombre)} établissements)` : ""}.` : "Sport, culture, solidarité : versées aux associations et autres organismes privés.",
      attributs: vue("associations", { mode: "barres", lignes }),
    });
  }

  if (v.parts) {
    const p = v.parts;
    const morceaux: LigneBarre[] = p.nette !== undefined
      ? [{ n: "Dépenses du quotidien", v: p.fonctionnement, t: `${fmt(p.fonctionnement, 2)} €`, c: "bleu" }, { n: "Remboursement de la dette", v: p.capital!, t: `${fmt(p.capital!, 2)} €`, c: "argile" }, { n: "Reste pour investir", v: p.nette, t: `${fmt(p.nette, 2)} €`, c: "or" }]
      : [{ n: "Dépenses du quotidien", v: p.fonctionnement, t: `${fmt(p.fonctionnement, 2)} €`, c: "bleu" }, { n: "Reste avant la dette", v: p.brute!, t: `${fmt(p.brute!, 2)} €`, c: "or" }];
    const reste = p.nette ?? p.brute ?? 0;
    e.push({
      chapitre: "ville", tableau: "ville", k: 5, titre: "Sur 100 € qui rentrent, <em>combien restent&nbsp;?</em>", lib: `${p.nette !== undefined ? "Reste pour investir" : "Reste avant la dette"} · ${v.annee}`, valeur: reste, decimales: 2, unite: "€",
      sous: `sur 100 € du budget de l’année`, ton: reste >= 10 ? "or" : "argile",
      attributs: vue("reste", { mode: "barres", lignes: morceaux }),
    });
  }

  if (v.dette) {
    const s = montant(v.dette.stock);
    const variation = v.dette.precedent !== undefined ? v.dette.stock - v.dette.precedent : undefined;
    const lignes = barres([["Dette", v.dette.stock], ["Emprunté dans l’année", v.dette.emprunts ?? NaN], ["Remboursé dans l’année", v.dette.remboursements ?? NaN]].filter(l => Number.isFinite(l[1])) as [string, number][]);
    lignes[0].c = "argile";
    e.push({
      chapitre: "ville", tableau: "ville", k: 6, titre: `La dette de <em>${nom}</em>.`, lib: `Au 31 décembre ${v.dette.annee}`, valeur: s.valeur, decimales: s.d, unite: s.unite,
      sous: variation === undefined ? parHab(v.dette.stock) : variation > 0 ? `+${texteMontant(variation)} en un an` : variation < 0 ? `−${texteMontant(-variation)} en un an` : "Stable sur un an", ton: variation !== undefined && variation > 0 ? "argile" : "or",
      desc: v.epargne > 0 ? `Il faudrait ${fmt(v.dette.stock / v.epargne, 1)} ans d’économies de la mairie pour tout rembourser.` : undefined,
      attributs: vue("dette", { mode: "barres", lignes }),
    });
  }

  if (v.investissement) {
    const i = montant(v.investissement.montant);
    e.push({
      chapitre: "ville", tableau: "ville", k: 7, titre: "Ce que la ville <em>construit</em>.", lib: `Investissement · ${v.investissement.annee}`, valeur: i.valeur, decimales: i.d, unite: i.unite, ton: "or",
      sous: parHab(v.investissement.montant),
      desc: "Écoles, rues, gymnases, rénovations : ce qui durera plus d’un an.",
      attributs: vue("investissement", { mode: "barres", lignes: v.investissement.lignes.length ? barres(v.investissement.lignes, "vert") : barres([["Investissement", v.investissement.montant]], "vert") }),
    });
  }

  if (v.foncier) {
    const f = v.foncier;
    e.push({
      chapitre: "ville", tableau: "ville", k: 8, titre: "La <em>taxe foncière</em>.", lib: `Taux voté par la commune · ${f.annee}`, valeur: f.taux, decimales: 2, unite: "%",
      sous: f.tauxGlobal && f.tauxGlobal !== f.taux ? `${fmt(f.tauxGlobal, 2)} % au total sur l’avis d’imposition` : undefined,
      desc: "Appliqué à la valeur locative du bien, payé chaque année par les propriétaires.",
      attributs: vue("foncier", { mode: "barres", legende: `Payé dans la commune en ${f.annee}`, lignes: barres(f.lignes, "or") }),
    });
  }

  if (v.delits) {
    const t = v.delits, fr = france.delits?.annee === t.annee ? france.delits.taux : {};
    const tete = t.lignes[0];
    const frTete = fr[tete[0]];
    e.push({
      chapitre: "ville", tableau: "ville", k: 9, titre: "Sécurité : <em>ce que la police enregistre</em>.", lib: `${tete[1]} · ${t.annee}`, valeur: tete[3], decimales: 1, unite: "pour 1 000 hab.",
      sous: `${fmt(tete[2])} faits enregistrés${frTete ? ` · France : ${fmt(frTete, 1)} pour 1 000` : ""}`, ton: frTete && tete[3] > frTete ? "argile" : "or",
      attributs: vue("securite", { mode: "barres", legende: "Pour 1 000 habitants", repere: Object.keys(fr).length ? "France" : undefined, lignes: t.lignes.map(([id, n, , x]) => ({ n, v: x, t: fmt(x, 1), c: fr[id] && x > fr[id] ? "argile" : "bleu", r: fr[id], rt: fr[id] ? fmt(fr[id], 1) : undefined })) }),
    });
  }

  const p = v.portrait;
  if (p || v.population) {
    const tuiles: [string, string, string?][] = [];
    if (v.population) tuiles.push(["Habitants", fmt(v.population)]);
    if (p?.pauvrete) tuiles.push([`Taux de pauvreté · ${p.pauvrete[0]}`, `${fmt(p.pauvrete[1], 1)} %`, france.pauvrete ? `France ${fmt(france.pauvrete[1], 1)} % (${france.pauvrete[0]})` : undefined]);
    if (p?.niveauVie) tuiles.push([`Niveau de vie médian, par an · ${p.niveauVie[0]}`, `${fmt(p.niveauVie[1])} €`, france.niveauVie ? `France ${fmt(france.niveauVie[1])} € (${france.niveauVie[0]})` : undefined]);
    if (p?.salaire) tuiles.push([`Salaire net moyen, par mois · ${p.salaire[0]}`, `${fmt(p.salaire[1])} €`, france.salaire ? `France ${fmt(france.salaire[1])} € (${france.salaire[0]})` : undefined]);
    if (p?.chomage) tuiles.push([`Chômage (recensement) · ${p.chomage[0]}`, `${fmt(p.chomage[1], 1)} %`]);
    if (p?.logementsSociaux) tuiles.push([`Logements sociaux · ${p.logementsSociaux[0]}`, `${fmt(p.logementsSociaux[1], 1)} %`, "des résidences principales"]);
    if (p?.ecoles) tuiles.push([`Écoles · ${p.ecoles[0]}`, fmt(p.ecoles[1]), p.colleges ? `${fmt(p.colleges[1])} collèges et lycées` : undefined]);
    if (tuiles.length >= 2) e.push({
      chapitre: "ville", tableau: "ville", k: 10, titre: `Qui vit à <em>${nom}</em>&nbsp;?`, lib: p?.pauvrete ? `Taux de pauvreté · ${p.pauvrete[0]}` : "Habitants", valeur: p?.pauvrete ? p.pauvrete[1] : v.population!, decimales: p?.pauvrete ? 1 : 0, unite: p?.pauvrete ? "%" : "",
      sous: p?.pauvrete && france.pauvrete ? `France : ${fmt(france.pauvrete[1], 1)} % en ${france.pauvrete[0]}` : undefined, ton: p?.pauvrete && france.pauvrete && p.pauvrete[1] > france.pauvrete[1] ? "argile" : undefined,
      attributs: vue("portrait", { mode: "tuiles", tuiles }),
    });
  }
  if (e.length) e[e.length - 1].contenu = `<a class="etape__lien" href="#ville" data-autre-ville>Choisir une autre ville</a>`;
  return e;
}

export function renduVille(v: Ville, depart: number, france?: RepereFrance): string {
  return etapesVille(v, france).map((x, i) => renduEtape(x, depart + i)).join("");
}
