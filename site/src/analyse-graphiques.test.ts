import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contratDossierAnalyse, rendu, type Analyse } from "./analyse-rendu.ts";
import { graphiqueAnalyse } from "./analyse-graphiques.ts";
import { budgetComparison } from "./budget-comparison.ts";
import { budgetFlow } from "./budget-flow.ts";
import { validerDossierAnalyse, type DossierAnalyse } from "./analyse-contrat.ts";
import { formaterValeurAnalyse, libelleUniteAnalyse, formater, valeurEtUniteAnalyse } from "./echelle.ts";

const lire = (slug: string): Analyse => JSON.parse(readFileSync(new URL(`../analyses/${slug}.json`, import.meta.url), "utf8"));

test("les nouveaux montants gardent leur échelle, y compris dans une citation", () => {
  assert.equal(formaterValeurAnalyse(11.6, "billion_EUR"), "11,6");
  assert.equal(libelleUniteAnalyse("billion_EUR"), "milliards d’euros");
  assert.equal(formater(11.6, "billion_EUR", false), "11,6 milliards d’euros");
  assert.equal(formaterValeurAnalyse(1.8, "percent_GDP"), "1,8");
});

test("une unité déjà écrite dans une valeur n'est jamais répétée", () => {
  assert.equal(valeurEtUniteAnalyse(39, "percent"), "39\u202f%");
  assert.equal(valeurEtUniteAnalyse(0.4023, "EUR_per_kWh"), "0,4023\u202f€/kWh");
  assert.equal(valeurEtUniteAnalyse(266, "billion_EUR"), "266 milliards d’euros");
  const html = rendu(lire("defense-europe-depenses-2024"), [], "", "https://500signatures.fr/analyses/defense-europe-depenses-2024/");
  assert.doesNotMatch(html, /%\s+pourcentage/);
});

test("les références externes sont toutes en fin de dossier, les séries restent attribuées", () => {
  for (const slug of ["defense-europe-depenses-2024", "ukraine-pret-europeen-90-milliards", "groenland-accord-securite-europe", "prix-gaz-menages-2022-2025", "defense-credits-votes-consommes-2025"]) {
    const analyse = lire(slug);
    const html = rendu(analyse, [], "", `https://500signatures.fr/analyses/${slug}/`);
    const debut = html.indexOf('id="sources"');
    assert.ok(debut > 0, slug);
    assert.doesNotMatch(html.slice(0, debut), /href="https?:/);
    for (const source of analyse.sources) assert.ok(html.slice(debut).includes(source.url.replaceAll("&", "&amp;")), source.url);
  }
});

test("la courbe garde chaque observation et chaque période", () => {
  const contrat = contratDossierAnalyse(lire("defense-europe-depenses-2024"))!;
  const svg = graphiqueAnalyse(contrat.dossier.visualisations[0]!, contrat);
  assert.equal((svg.slice(0, svg.indexOf("</svg>")).match(/<circle /g) ?? []).length, 5);
  assert.match(svg, /2020/);
  assert.match(svg, /2024/);
  assert.match(svg, /266/);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test("des instantanés sans groupe comparable ne deviennent pas un graphique de classement", () => {
  const analyse = lire("ukraine-pret-europeen-90-milliards");
  let contrat = contratDossierAnalyse(analyse)!;
  assert.match(graphiqueAnalyse(contrat.dossier.visualisations[0]!, contrat), /width:100%/);
  assert.match(graphiqueAnalyse(contrat.dossier.visualisations[0]!, contrat), /width:50%/);
  for (const preuve of analyse.dossier!.preuves) delete preuve.comparableGroup;
  contrat = contratDossierAnalyse(analyse)!;
  assert.equal(graphiqueAnalyse(contrat.dossier.visualisations[0]!, contrat), "");
});


test("les barres restent à droite des graduations sur ordinateur et mobile",()=>{
  const contrat=contratDossierAnalyse(lire("electricite-exportee-facture-francais"))!;
  const figure=contrat.dossier.visualisations.find(v=>v.type==="bar")!;
  const svg=graphiqueAnalyse(figure,contrat);
  const positions=[...svg.matchAll(/<rect x="([0-9.]+)"/g)].map(m=>Number(m[1]));
  assert.ok(positions.length>=4);
  assert.ok(positions.every(x=>x>=58),"aucune barre ne doit recouvrir les valeurs de l’axe");
});

test("le flux résout les budgets choisis dans leur ordre puis conserve toutes les lignes", () => {
  const dossier: DossierAnalyse = {
    chapo: "Une sélection de budgets", series: [], limitations: [],
    preuves: [
      ["budget-alpha", 100e6], ["retraites-alpha", 30e6],
      ["budget-beta", 200e6], ["retraites-beta", 50e6], ["budget-gamma", 40e6],
    ].map(([id, value]) => ({ id: String(id), libelle: String(id), value: Number(value), unit: "EUR", period: "2027", definition: "Crédits", sourceId: "source-test" })),
    visualisations: [{
      id: "selection", type: "budget_flow", titre: "Flux", resume: "Lecture",
      preuveIds: ["budget-alpha", "retraites-alpha", "budget-beta", "retraites-beta", "budget-gamma"],
      focusBudgetIds: ["budget-beta", "budget-alpha"],
      budgetRows: [
        { label: "Alpha", budgetId: "budget-alpha", retirementId: "retraites-alpha", estimated: true },
        { label: "Beta", flowLabel: "Beta court", budgetId: "budget-beta", retirementId: "retraites-beta", estimated: false },
        { label: "Gamma", budgetId: "budget-gamma" },
      ],
    }],
    sections: [{ id: "lecture", titre: "Lecture", paragraphes: ["Lecture"], visualisationIds: ["selection"] }],
  };
  const contrat = validerDossierAnalyse(dossier, [{ id: "source-test", titre: "Source", url: "https://exemple.test", consulteLe: "2026-10-20" }])!;
  const alpha = { label: "Alpha", budget: 100e6, retirement: 30e6, estimated: true };
  const beta = { label: "Beta", budget: 200e6, retirement: 50e6, estimated: false };
  const table = budgetComparison([alpha, beta, { label: "Gamma", budget: 40e6, retirement: null }]);
  const html = graphiqueAnalyse(dossier.visualisations[0]!, contrat);
  assert.equal(html, budgetFlow([{ ...beta, label: "Beta court" }, alpha]) + '<h3 class="analyse-budget-table-title">Tous les budgets</h3>' + table);
  assert.equal((html.match(/class="budget-comparison__row"/g) ?? []).length, 3);
  dossier.visualisations[0]!.type = "budget_comparison";
  assert.equal(graphiqueAnalyse(dossier.visualisations[0]!, contrat), table);
});

