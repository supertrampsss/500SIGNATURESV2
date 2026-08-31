# V3 Five Analyses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish five source-backed analyses on German nuclear power and prices, school supplies, household gas prices, homebuyer age and quality of life.

**Architecture:** Add focused normalizers to the existing Python pipeline, publish versioned country-level series, then create five JSON analysis pages consumed by the current pre-renderer. The France page becomes a featured view plus searchable progressive catalogue, so adding analyses no longer creates a full-page content wall.

**Tech Stack:** Python pipeline, Eurostat JSON-stat API, Insee BDM and downloadable tables, DuckDB tests, TypeScript renderer, Vite pre-render

## Global Constraints

- Every visible number has a source, period, unit and methodological reserve.
- Prefer primary official sources.
- Do not infer causality from the German nuclear chronology alone.
- Do not describe the school-supply CPI as the complete back-to-school cost.
- Do not confuse gas consumption with gas price.
- Do not derive purchaser age from DVF or interpolate missing survey years.
- Do not create a proprietary quality-of-life composite.
- No em dash in published copy.

---

## File Structure

- Create `pipeline/plateforme/normalize/prix_energie_menages.py`: Eurostat electricity and gas price series.
- Create `pipeline/tests/test_prix_energie_menages.py`: filters, units, tax bands and periods.
- Create `pipeline/plateforme/normalize/nucleaire_europe.py`: nuclear production share and chronology.
- Create `pipeline/tests/test_nucleaire_europe.py`: Germany, France and comparable neighbours.
- Create `pipeline/plateforme/normalize/fournitures_scolaires.py`: Insee BDM series `001765036`.
- Create `pipeline/tests/test_fournitures_scolaires.py`: index identity and comparison with general CPI.
- Create `pipeline/plateforme/normalize/acquisition_residence.py`: discrete Insee HVP and logement survey distributions.
- Create `pipeline/tests/test_acquisition_residence.py`: age brackets, survey waves and non-interpolation.
- Create `pipeline/plateforme/normalize/qualite_vie.py`: Insee and Eurostat life-satisfaction series.
- Create `pipeline/tests/test_qualite_vie.py`: scale and separate dimensions.
- Create five files under `site/analyses/` with stable slugs.
- Modify `site/src/insights-france.ts`: add five teaser cards.
- Modify `site/src/insights-rendu.ts`: featured and searchable catalogue modes.
- Modify `site/src/insights-rendu.test.ts`, `site/src/insights-france.test.ts`, `site/scripts/prerendre.test.ts`: publication gates.

### Task 1: Ingest household electricity and gas prices

**Files:**
- Create: `pipeline/plateforme/normalize/prix_energie_menages.py`
- Create: `pipeline/tests/test_prix_energie_menages.py`

**Interfaces:**
- Consumes: Eurostat datasets `nrg_pc_204` and `nrg_pc_202` through `connectors.eurostat`.
- Produces: harmonised country and semester observations for a declared household consumption band.

- [ ] **Step 1: Write fixture tests for strict dimensions**

```py
def test_garde_une_tranche_et_separe_les_taxes(payload):
    series = energie.lire_prix(payload, dataset="nrg_pc_202")
    assert set(series) == {
        "eurostat_gaz_menages_ttc",
        "eurostat_gaz_menages_hors_taxes",
    }
    assert all(cle[1] in {"FR", "DE", "BE", "ES", "IT", "NL"} for valeurs in series.values() for cle in valeurs)
    assert all(cle[2].endswith(("-S1", "-S2")) for valeurs in series.values() for cle in valeurs)

def test_refuse_un_melange_de_tranches(payload):
    charge = avec_deux_tranches(payload)
    with pytest.raises(ValueError, match="consumption band"):
        energie.lire_prix(charge, dataset="nrg_pc_202")
```

- [ ] **Step 2: Run the test**

Run: `cd pipeline && pytest tests/test_prix_energie_menages.py -q`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Define strict filters and indicators**

```py
DATASETS = {"electricite": "nrg_pc_204", "gaz": "nrg_pc_202"}
PAYS = ("FR", "DE", "BE", "ES", "IT", "NL")
TAXES = {
    "X_TAX": "hors_taxes",
    "I_TAX": "ttc",
}
INDICATEURS = {
    ("electricite", "ttc"): "eurostat_electricite_menages_ttc",
    ("electricite", "hors_taxes"): "eurostat_electricite_menages_hors_taxes",
    ("gaz", "ttc"): "eurostat_gaz_menages_ttc",
    ("gaz", "hors_taxes"): "eurostat_gaz_menages_hors_taxes",
}
```

Use the medium household band documented by Eurostat for each energy. Filter `currency=EUR` and the price unit published per 100 kWh. Read JSON-stat dimensions by name, never by assumed array position. Convert Eurostat semester labels to `YYYY-S1` and `YYYY-S2`.

- [ ] **Step 4: Add publication metadata**

Declare all four indicators as non-additive, country-level, semestrial, observed and official. The technical definition must name the chosen band, taxes status, currency and Eurostat regulation basis.

- [ ] **Step 5: Run and commit**

Run: `cd pipeline && pytest tests/test_prix_energie_menages.py tests/test_jsonstat.py -q`

Expected: PASS.

```bash
git add pipeline/plateforme/normalize/prix_energie_menages.py pipeline/tests/test_prix_energie_menages.py
git commit -m "feat: ingest household energy prices"
```

### Task 2: Ingest German nuclear chronology without causal claims

**Files:**
- Create: `pipeline/plateforme/normalize/nucleaire_europe.py`
- Create: `pipeline/tests/test_nucleaire_europe.py`

**Interfaces:**
- Consumes: Eurostat `nrg_bal_c` and the same country list as Task 1.
- Produces: nuclear generation and total electricity generation series with a computed, documented share.

- [ ] **Step 1: Write identity tests**

```py
def test_part_nucleaire_est_un_ratio_documente(series):
    resultat = nucleaire.calculer_part(series)
    assert resultat[("DE", "2021")] == pytest.approx(
        series[("DE", "2021", "nuclear")] / series[("DE", "2021", "total")] * 100
    )

def test_une_annee_sans_total_n_est_pas_publiee(series):
    del series[("DE", "2021", "total")]
    assert ("DE", "2021") not in nucleaire.calculer_part(series)
```

- [ ] **Step 2: Implement separate observed and computed indicators**

```py
INDICATEURS = {
    "eurostat_electricite_nucleaire_gwh": ("gwh", "observed"),
    "eurostat_electricite_totale_gwh": ("gwh", "observed"),
    "eurostat_part_nucleaire_electricite": ("percent", "computed"),
}
```

The ratio formula is `nuclear generation / total gross electricity generation * 100`. Store the two source observations and the computed share separately. Propagate provisional and break flags from Eurostat.

- [ ] **Step 3: Add plausibility and coverage gates**

Require the nuclear share to remain between 0 and 100. Require Germany and France to have at least ten common annual periods before publication. A missing year remains missing.

- [ ] **Step 4: Run and commit**

Run: `cd pipeline && pytest tests/test_nucleaire_europe.py tests/test_europe.py -q`

Expected: PASS.

```bash
git add pipeline/plateforme/normalize/nucleaire_europe.py pipeline/tests/test_nucleaire_europe.py
git commit -m "feat: ingest European nuclear chronology"
```

### Task 3: Ingest the school-supply price index

**Files:**
- Create: `pipeline/plateforme/normalize/fournitures_scolaires.py`
- Create: `pipeline/tests/test_fournitures_scolaires.py`

**Interfaces:**
- Consumes: Insee BDM series `001765036` and the already published general CPI series.
- Produces: `insee_prix_fournitures_scolaires_indice` at monthly frequency.

- [ ] **Step 1: Write source-identity tests**

```py
def test_la_serie_bdm_est_exactement_celle_des_fournitures():
    assert fournitures.SERIE_BDM == "001765036"
    assert "Autres fournitures scolaires et de bureau" in fournitures.FICHE["technique"]

def test_le_module_ne_publie_aucun_cout_de_rentree():
    assert all("cout_rentree" not in identifiant for identifiant in fournitures.INDICATEURS)
```

- [ ] **Step 2: Implement the BDM normalizer**

Use `connectors.insee.bdm_sdmx(SERIE_BDM)`. Reuse the existing SDMX parsing pattern from `normalize/prix.py`, retain raw monthly index levels and preserve the series base in the technical definition.

```py
SERIE_BDM = "001765036"
INDICATEUR = "insee_prix_fournitures_scolaires_indice"
UNITE = "index"
```

- [ ] **Step 3: Add the comparison helper**

Create a pure function that intersects the school series and general CPI on common months before calculating rebased chart values. It must return an empty result when fewer than 24 common months exist.

- [ ] **Step 4: Run and commit**

Run: `cd pipeline && pytest tests/test_fournitures_scolaires.py tests/test_prix.py -q`

Expected: PASS.

```bash
git add pipeline/plateforme/normalize/fournitures_scolaires.py pipeline/tests/test_fournitures_scolaires.py
git commit -m "feat: ingest school supply price index"
```

### Task 4: Publish discrete homebuyer age distributions

**Files:**
- Create: `pipeline/plateforme/normalize/acquisition_residence.py`
- Create: `pipeline/tests/test_acquisition_residence.py`

**Interfaces:**
- Consumes: downloadable Insee tables linked from the HVP 2017-2018 and Logement 2024 publications.
- Produces: percentages by survey wave, purchaser definition and age bracket.

- [ ] **Step 1: Write non-interpolation tests**

```py
def test_les_vagues_restent_discretes(observations):
    periods = sorted({row["periode"] for row in observations})
    assert periods == [row for row in periods if row in acquisition.VAGUES_PUBLIEES]
    assert not any("2019" <= period <= "2023" for period in periods if period not in acquisition.VAGUES_PUBLIEES)

def test_les_parts_d_age_ferment_a_cent(observations):
    for _, groupe in groupby_key(observations, "periode", "population"):
        assert sum(row["value"] for row in groupe) == pytest.approx(100, abs=0.2)
```

- [ ] **Step 2: Discover and archive the official table asset**

Fetch the publication HTML, select the official `.xlsx` data link in the article's data block, archive both HTML and spreadsheet through `entrepot.record_asset()`, and fail if zero or more than one matching data workbook is found.

```py
SOURCES = {
    "2018": "https://www.insee.fr/fr/statistiques/5371267?sommaire=5371304",
    "2024": "https://www.insee.fr/fr/statistiques/8727513",
}
```

- [ ] **Step 3: Parse only declared populations and brackets**

```py
POPULATIONS = ("acquereurs_recents", "accedants", "primo_accedants")
AGE_BRACKETS = ("moins_30", "30_39", "40_49", "50_64", "65_plus")
INDICATEUR = "insee_acquereurs_residence_principale_part_age"
```

If a workbook uses different brackets, retain its published brackets under distinct dimension values instead of forcing them into these five. Publish no arithmetic mean unless the workbook directly supplies one under a stable definition.

- [ ] **Step 4: Run and commit**

Run: `cd pipeline && pytest tests/test_acquisition_residence.py -q`

Expected: PASS.

```bash
git add pipeline/plateforme/normalize/acquisition_residence.py pipeline/tests/test_acquisition_residence.py
git commit -m "feat: ingest homebuyer age distributions"
```

### Task 5: Ingest life satisfaction without a composite score

**Files:**
- Create: `pipeline/plateforme/normalize/qualite_vie.py`
- Create: `pipeline/tests/test_qualite_vie.py`

**Interfaces:**
- Consumes: Insee SRCV life-satisfaction table and Eurostat `ilc_pw01`.
- Produces: separate satisfaction series in points on their published scale.

- [ ] **Step 1: Write unit and separation tests**

```py
def test_la_satisfaction_est_une_note_pas_un_pourcentage():
    assert qualite.INDICATEURS["insee_satisfaction_vie_moyenne"]["unit"] == "score_0_10"

def test_aucun_indice_composite_n_est_declare():
    assert not any("composite" in identifiant or "qualite_vie_globale" in identifiant for identifiant in qualite.INDICATEURS)
```

- [ ] **Step 2: Implement source-specific parsers**

Keep Insee and Eurostat indicators distinct. Normalise period labels, not the observed values. Reject values outside 0 to 10 and preserve survey breaks as quality flags.

- [ ] **Step 3: Run and commit**

Run: `cd pipeline && pytest tests/test_qualite_vie.py tests/test_jsonstat.py -q`

Expected: PASS.

```bash
git add pipeline/plateforme/normalize/qualite_vie.py pipeline/tests/test_qualite_vie.py
git commit -m "feat: ingest life satisfaction series"
```

### Task 6: Register, publish and control all new indicators

**Files:**
- Modify: `pipeline/plateforme/ingest.py`
- Modify: `pipeline/plateforme/publish.py`
- Modify: `pipeline/tests/test_publication.py`
- Modify: `docs/01-registre-sources.md`

**Interfaces:**
- Consumes: normalizers from Tasks 1 to 5.
- Produces: new indicators in versioned `indicateurs.json` and country series exports.

- [ ] **Step 1: Add a publication test listing required IDs**

```py
REQUIRED = {
    "eurostat_electricite_menages_ttc",
    "eurostat_gaz_menages_ttc",
    "eurostat_part_nucleaire_electricite",
    "insee_prix_fournitures_scolaires_indice",
    "insee_acquereurs_residence_principale_part_age",
    "insee_satisfaction_vie_moyenne",
}
assert REQUIRED <= {item["id"] for item in publication["indicateurs"]}
```

- [ ] **Step 2: Register runners and publication families**

Add the five modules to the existing ingestion registry. Include their source IDs and datasets in the public source registry. Publish country-level series for all declared comparison countries.

- [ ] **Step 3: Run pipeline tests**

Run: `cd pipeline && pytest tests/test_prix_energie_menages.py tests/test_nucleaire_europe.py tests/test_fournitures_scolaires.py tests/test_acquisition_residence.py tests/test_qualite_vie.py tests/test_publication.py -q`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add pipeline/plateforme/ingest.py pipeline/plateforme/publish.py pipeline/tests/test_publication.py docs/01-registre-sources.md
git commit -m "feat: publish five new analysis datasets"
```

### Task 7: Create five pre-rendered analysis pages

**Files:**
- Create: `site/analyses/nucleaire-allemand-prix-energie.json`
- Create: `site/analyses/prix-fournitures-scolaires.json`
- Create: `site/analyses/evolution-prix-gaz-menages.json`
- Create: `site/analyses/age-achat-residence-principale.json`
- Create: `site/analyses/evolution-qualite-vie.json`
- Modify: `site/src/analyse-rendu.test.ts`
- Modify: `site/scripts/prerendre.test.ts`

**Interfaces:**
- Consumes: published indicator IDs from Task 6.
- Produces: five shareable `/analyses/<slug>/` routes and OG cards.

- [ ] **Step 1: Add the publication contract test**

```ts
const slugs = new Set((await analysesPubliees()).map(({ slug }) => slug));
for (const slug of [
  "nucleaire-allemand-prix-energie",
  "prix-fournitures-scolaires",
  "evolution-prix-gaz-menages",
  "age-achat-residence-principale",
  "evolution-qualite-vie",
]) assert.ok(slugs.has(slug), slug);
```

- [ ] **Step 2: Author the JSON using the existing `Analyse` schema**

Each file must contain only values read from the publication artifact for its declared indicator, country and period. Use `type: "comparaison"` for nuclear and gas, `type: "decryptage"` for supplies and quality of life, and `type: "mise_a_jour"` for buyer age. Put causal limits in `hypotheses`, not in a footnote outside the schema.

- [ ] **Step 3: Run pre-render tests**

Run: `cd site && node --experimental-strip-types --test src/analyse-rendu.test.ts scripts/prerendre.test.ts`

Expected: PASS and five new canonical routes in the site map.

- [ ] **Step 4: Commit**

```bash
git add site/analyses site/src/analyse-rendu.test.ts site/scripts/prerendre.test.ts
git commit -m "feat: publish five requested analyses"
```

### Task 8: Replace the France content wall with discovery controls

**Files:**
- Modify: `site/src/insights-rendu.ts`
- Modify: `site/src/insights-rendu.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/src/styles/bilan-guide.css`
- Modify: `site/scripts/prerendre.ts`

**Interfaces:**
- Consumes: all `Insight` items and five analysis routes.
- Produces: eight featured cards, filters, search and progressive catalogue.

- [ ] **Step 1: Write the eight-card initial-render test**

```ts
test("France peint huit analyses puis garde le catalogue recherchable", () => {
  const html = renduInsights(manyInsights(105), catalogue, { contexte: "france", initialLimit: 8 });
  assert.equal((html.match(/class="insight /g) ?? []).length, 8);
  assert.match(html, /type="search"/);
  assert.match(html, /data-insights-catalogue/);
});
```

- [ ] **Step 2: Add render options**

```ts
export type InsightRenderOptions = {
  contexte: "france" | "territoire";
  initialLimit?: number;
  query?: string;
  family?: string;
};
```

`renduInsights()` sorts featured items first, renders `initialLimit ?? items.length`, and embeds the remaining catalogue as escaped JSON for local filtering. The page must not duplicate the hidden cards as full HTML.

- [ ] **Step 3: Add local filtering**

In `main.ts`, normalise accents and case, filter by title, verdict text and keywords, then render results in batches of 12. Search never requests a server.

- [ ] **Step 4: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/insights-rendu.test.ts src/insights-france.test.ts scripts/prerendre.test.ts && npm run build`

Expected: PASS and build exit 0.

```bash
git add site/src/insights-rendu.ts site/src/insights-rendu.test.ts site/src/main.ts site/src/styles/bilan-guide.css site/scripts/prerendre.ts
git commit -m "feat: add progressive France analysis catalogue"
```

### Task 9: Run the analysis publication gate

**Files:**
- Modify only on failure: files from Tasks 1 to 8.

**Interfaces:**
- Consumes: pipeline and site work.
- Produces: fully verified new analysis release.

- [ ] **Step 1: Run complete pipeline tests**

Run: `cd pipeline && pytest -q`

Expected: PASS.

- [ ] **Step 2: Run complete site tests and build**

Run: `cd site && npm test && npm run build`

Expected: PASS.

- [ ] **Step 3: Verify factual prohibitions**

Run: `rg -n "DVF.*âge moyen|coût total de la rentrée|nucléaire.*cause unique|indice global de qualité de vie" site/analyses site/src pipeline/plateforme`

Expected: no published assertion matching these prohibited shortcuts.

- [ ] **Step 4: Commit gate-only fixes**

```bash
git add pipeline site docs/01-registre-sources.md
git commit -m "test: verify five new sourced analyses"
```
