# V3 Five Analyses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Every task uses TDD and receives an independent review before the next task begins.

**Goal:** Publish five source-backed analyses on German nuclear power and prices, school supplies, household gas prices, home purchase age and life satisfaction.

**Architecture:** Register every source and dataset first, archive raw official assets through the existing pipeline lineage, normalise only comparable observations, publish versioned country series, then render five pre-generated editorial dossiers. The home-purchase dossier is deliberately a table of heterogeneous official snapshots, not a reconstructed time series. `/bilan` keeps eight entry points while `/analyses/` becomes the progressive catalogue.

**Tech stack:** Python pipeline, Eurostat JSON-stat, ENTSO-E XML, Insee BDM SDMX, Insee Melodi, CRE open data, DuckDB publication tests, TypeScript contract and renderer, Vite pre-render.

## Global constraints

- Every visible number has a source, period, unit, definition and methodological reserve.
- Treat `../specs/2026-08-30-v3-direction-design-addendum.md` as an acceptance contract.
- Use primary official sources. No X input.
- Unit tests use archived fixtures and never depend on the network.
- `npm run build` never needs an ENTSO-E token or any other secret.
- Do not infer that German nuclear shutdowns alone caused a price movement.
- Do not present the school-supply index as the complete cost of the school year.
- Do not confuse gas consumption, price, CPI and supply-cost components.
- Do not derive purchaser age from DVF, interpolate missing survey years or join incompatible survey definitions.
- Do not publish a continuous `36 to 39 years` curve or slogan. The official points do not support it.
- Do not create a proprietary quality-of-life composite. The MVP publishes life satisfaction on its native 0-to-10 scale.
- No em dash in published copy.

## File structure

- Modify `infra/seed/source_registry.csv` and `infra/seed/dataset_registry.csv` before ingestion.
- Create focused normalisers and fixture tests under `pipeline/plateforme/normalize/` and `pipeline/tests/`.
- Keep ENTSO-E ingestion in an explicit editorial/manual command, outside the standard build.
- Create `site/src/analyse-contrat.ts`; do not repurpose `site/src/analyses.ts`, which renders territorial tables.
- Extend `site/src/analyse-rendu.ts`, `site/src/echelle.ts` and `site/src/styles/dossiers-verification.css` for sourced series, snapshots and multi-unit figures.
- Create five stable JSON dossiers under `site/analyses/`.
- Add a canonical pre-rendered `/analyses/` index, while keeping `/#analyses` only as a legacy fragment for `/bilan`.

### Task 0: Register sources, datasets and lineage

**Files:**
- Modify: `infra/seed/source_registry.csv`
- Modify: `infra/seed/dataset_registry.csv`
- Create: `pipeline/tests/test_registry_analyses_v3.py`

**Required dataset IDs:**

- `eurostat-nrg-pc-202`
- `eurostat-nrg-pc-204`
- `eurostat-nrg-bal-peh`
- `entsoe-a44-day-ahead`
- `bdm-fournitures-001765036`
- `bdm-ipc-ensemble-001764363`
- `bdm-gaz-menages-011815828`
- `cre-prvg-open-data`
- `cre-gaz-supply-reference`
- separate Insee publication datasets for every ENL/HVP housing asset actually used
- `melodi-srcv-satisfaction`

Add the official ENTSO-E Transparency source with `securityToken` authentication metadata, but never store the token. Each housing publication remains a separate dataset because definitions differ.

- [ ] Write a failing registry test that runs the existing registry sync, resolves every required ID, rejects duplicate IDs and proves that every recorded fixture asset references a known dataset.
- [ ] Add the registry rows with official landing URLs, owner, licence, update cadence and access mode.
- [ ] Run `cd pipeline && pytest tests/test_registry_analyses_v3.py -q`.
- [ ] Commit with `chore: register five analysis data sources`.

### Task 1A: Ingest comparable household electricity and gas prices

**Files:**
- Create: `pipeline/plateforme/normalize/prix_energie_menages.py`
- Create: `pipeline/tests/test_prix_energie_menages.py`

**Exact Eurostat selections:**

```py
ENERGIES = {
    "gaz": {
        "dataset": "nrg_pc_202",
        "siec": "G3000",
        "nrg_cons": "GJ20-199",       # D2, 20 to 199 GJ
    },
    "electricite": {
        "dataset": "nrg_pc_204",
        "siec": "E7000",
        "nrg_cons": "KWH2500-4999",  # DC, 2,500 to 4,999 kWh
    },
}
COMMON = {"freq": "S", "currency": "EUR", "unit": "KWH"}
TAXES = {
    "I_TAX": "ttc",
    "X_TAX": "hors_taxes_et_prelevements",
}
```

Read JSON-stat dimensions by name. Explicitly reject `X_VAT`, other currencies, units, consumption bands and energy products. Store the raw unit as `EUR_per_kWh`; an optional `EUR_per_100_kWh` display is a declared factor of 100 applied only by presentation. Convert periods to `YYYY-S1` and `YYYY-S2`.

- [ ] RED: fixture tests covering every named dimension, wrong bands, `X_VAT`, mixed currencies, flags and period labels.
- [ ] GREEN: one ingestion run and one archived raw asset per Eurostat dataset; observed TTC and excluding-tax series remain distinct.
- [ ] Run `cd pipeline && pytest tests/test_prix_energie_menages.py tests/test_jsonstat.py -q`.
- [ ] Commit with `feat: ingest household energy price bands`.

### Task 1B: Separate current French gas-price layers

**Files:**
- Create: `pipeline/plateforme/normalize/prix_gaz_france.py`
- Create: `pipeline/tests/test_prix_gaz_france.py`

Use three official layers without pretending they share a unit:

- Insee BDM `011815828`, monthly household-gas CPI, base 2025;
- CRE monthly reference supply cost;
- CRE PRVG open-data workbook and its published price components.

Archive every raw XML/workbook independently. Preserve the published units and component names. EEX spot values are outside the MVP because their redistribution/licensing contract is separate; no hidden scraping or copied chart values.

- [ ] RED: fixtures prove the exact BDM series ID, base, monthly frequency, CRE sheet/schema identity and rejection of unit mixing.
- [ ] GREEN: publish separate CPI, reference-supply-cost and PRVG component series with their own `sourceId`, unit and frequency.
- [ ] Run `cd pipeline && pytest tests/test_prix_gaz_france.py -q`.
- [ ] Commit with `feat: ingest official French gas price layers`.

### Task 2A: Ingest the German and French nuclear chronology

**Files:**
- Create: `pipeline/plateforme/normalize/nucleaire_europe.py`
- Create: `pipeline/tests/test_nucleaire_europe.py`

Use Eurostat `nrg_bal_peh`, never `nrg_bal_c`:

```py
FILTERS = {"freq": "A", "nrg_bal": "GEP", "unit": "GWH"}
NUMERATOR = {"siec": "N900H"}
DENOMINATOR = {"siec": "TOTAL"}
```

Publish observed nuclear generation, observed gross total generation and computed share `N900H / TOTAL * 100` as three indicators. Propagate Eurostat flags. Require common DE/FR years, keep missing years missing and enforce 0 to 100 percent. The editorial chronology may mark the official German final shutdown date, 15 April 2023, as an annotation sourced to BMUV/SMARD, not as a causal coefficient.

- [ ] RED: ratio, absent total, flags, bounds and common-year fixtures.
- [ ] GREEN: official annual series, with no interpolation or causal claim.
- [ ] Run `cd pipeline && pytest tests/test_nucleaire_europe.py tests/test_europe.py -q`.
- [ ] Commit with `feat: ingest European nuclear chronology`.

### Task 2B: Ingest official day-ahead wholesale prices manually

**Files:**
- Create: `pipeline/plateforme/normalize/entsoe_prix.py`
- Create: `pipeline/tests/test_entsoe_prix.py`
- Add: archived XML fixtures covering hourly and 15-minute resolutions
- Modify: the documented editorial ingestion command or manual workflow only

**Request contract:**

- endpoint `https://web-api.tp.entsoe.eu/api`;
- `documentType=A44`, `processType=A01`;
- `in_Domain == out_Domain`;
- France `10YFR-RTE------C`;
- Germany-Luxembourg `10Y1001A1001A82H`;
- one request per calendar year, starting in 2019 to avoid joining the old DE-AT-LU bidding zone;
- token from `ENTSOE_API_TOKEN` only.

Parse XML periods and aggregate annual `EUR_per_MWh` weighted by interval duration. The test must catch the switch to 15-minute prices in October 2025. The command fails clearly when invoked without a token, but no standard pipeline test, site pre-render or build invokes it.

- [ ] RED: XML fixtures for missing positions, duplicate positions, DST-like period boundaries, hourly and 15-minute weights.
- [ ] GREEN: deterministic annual output from fixtures and explicit raw-asset lineage.
- [ ] Run `cd pipeline && pytest tests/test_entsoe_prix.py -q`.
- [ ] Run `cd site && env -u ENTSOE_API_TOKEN npm run build`.
- [ ] Commit with `feat: add manual ENTSO-E wholesale ingestion`.

### Task 3: Ingest the annual school-supply index without inventing a cost

**Files:**
- Create: `pipeline/plateforme/normalize/fournitures_scolaires.py`
- Create: `pipeline/tests/test_fournitures_scolaires.py`

Use the two annual base-2015 BDM series:

```py
SERIES = {
    "fournitures": "001765036",
    "ensemble": "001764363",
}
```

For each XML, require `FREQ=A`, `REF_AREA=FE`, `UNIT_MEASURE=SO`, France, all households and a title naming base 2015. The school series title must contain `09.5.4.9.2` and `Autres fournitures scolaires et de bureau`; the comparator must identify the overall CPI. Publish `index_2015_100` and compare only common years. The usable run is annual 1990 to 2025 according to the current publication.

Do not concatenate the new base-2025 series `011817559` to the old index level. Show a visible `series stopped / base changed` reserve. Never output a `cout_rentree` indicator.

- [ ] RED: exact IDs, titles, frequency, base, separate assets, common-year intersection and prohibition tests.
- [ ] GREEN: two annual series and no monthly or 24-month minimum logic.
- [ ] Run `cd pipeline && pytest tests/test_fournitures_scolaires.py tests/test_prix.py -q`.
- [ ] Commit with `feat: ingest annual school supply indices`.

### Task 4: Publish heterogeneous official home-purchase snapshots

**Files:**
- Create: `pipeline/plateforme/normalize/acquisition_residence.py`
- Create: `pipeline/tests/test_acquisition_residence.py`
- Add: one archived fixture set per official Insee publication used

The output is not one annual indicator. It is a list of separately defined evidence objects, each carrying publication, survey, reference period, population, measure, unit, current-age versus purchase-age semantics and `sourceId`.

The minimum editorial set is:

- ENL 2002 point for first acquisitions in 1998 to 2001, reported around age 36 under that publication's definition;
- ENL 2006 point for 2002 to 2006, reported as 35 years and 2 months, with its separately published comparison point and method note;
- HVP 2017-2018 exact age distribution of recent principal-residence buyers when available in the official table;
- ENL 2013 and ENL 2023-2024 points only under their literal published definitions, clearly labelled when they are age at survey or buyer share among recent movers rather than age at purchase.

Do not relabel the ENL 2013 age-at-survey value 39 as an average purchase age. Do not force brackets across publications. Archive each publication HTML and each XLSX as separate assets, even when several assets belong to one run. A sum-to-100 test applies only to a source table that is explicitly a complete distribution over one population.

- [ ] RED: every evidence object has a definition and source; no generic annual ID; no interpolation; no forced common brackets; no universal sum-to-100 assertion; reject `36.*39` narrative shortcuts.
- [ ] GREEN: a dossier-ready snapshot table whose rows are explicitly marked `not directly comparable` unless their definitions match exactly.
- [ ] Run `cd pipeline && pytest tests/test_acquisition_residence.py -q`.
- [ ] Commit with `feat: ingest official home-purchase snapshots`.

### Task 5: Ingest life satisfaction on its published scale

**Files:**
- Create: `pipeline/plateforme/normalize/qualite_vie.py`
- Create: `pipeline/tests/test_qualite_vie.py`

Use only Insee Melodi `DS_SRCV_SATISFACTION` for the MVP. Exact selection:

```py
PARAMS = {
    "GEO": "2025-FRANCE-FM",
    "SRCV_MEASURE": "VIESATISF",
    "AGE": "Y_GE16",
    "PCS": "_T",
    "DECILE_NIVVIE": "_T",
    "SRCV_NB_DIFF": "_T",
    "SEX": "_T",
    "SRCV_HLTH_SPH": "_T",
    "SRCV_SATISFNOTE": "_T",
    "EDUC": "_T",
    "TPH": "_T",
    "NATIONALITY_TYPE": "_T",
    "EMPSTA_ENQ": "_T",
}
MEASURE = "OBS_VALUE_NIVEAU"
```

Publish France metropolitan, people aged 16 or over, annual 2010 to 2024, unit `score_0_10`. Reject a row when any breakdown dimension is not `_T`. Preserve the 2020 and 2022 breaks as visible quality flags. Useful fixture anchors are 2010 `7.3`, 2021 `6.8` and 2024 `7.2`; do not transform the values.

Eurostat `ilc_pw01` is excluded from the MVP because its comparable coverage is sparse/discontinuous. No composite and no percentage conversion.

- [ ] RED: one valid total row plus one counterexample for every breakdown dimension, bounds, flags and anchor values.
- [ ] GREEN: one native 0-to-10 series with literal scope.
- [ ] Run `cd pipeline && pytest tests/test_qualite_vie.py -q`.
- [ ] Commit with `feat: ingest Insee life satisfaction`.

### Task 6A: Wire runners, assets and documentation

**Files:**
- Modify: existing registry-driven ingestion workflow files
- Modify: `infra/seed/source_registry.csv`
- Modify: `infra/seed/dataset_registry.csv`
- Modify: `docs/01-registre-sources.md`
- Create or modify: focused asset-lineage tests

Do not add five hard-coded branches to `pipeline/plateforme/ingest.py`. Use the existing registry and module runners. Add source modules without secrets to the standard ingestion workflow. Keep ENTSO-E in its explicit manual editorial workflow.

Test exact asset counts and formats: Eurostat JSON, BDM XML, Melodi response, CRE workbook/response, Insee publication HTML and XLSX. Every asset references a known dataset and run.

- [ ] Run all focused normaliser and registry tests.
- [ ] Commit with `feat: wire analysis ingestion assets`.

### Task 6B: Publish through the generic observation path

**Files:**
- Modify only if necessary: `pipeline/plateforme/publish.py`
- Modify: `pipeline/tests/test_publish_bout_en_bout.py`

Use the generic `core.observations` publication path. Change `publish.py` only when a new declared unit is not already serialized. Test with DuckDB and `LocalStore` that every series ID appears in `data/<version>/indicateurs.json`, every country series appears in `data/<version>/territoires/pays/tous.json`, and dataset/source/method/quality flags survive.

Housing evidence uses distinct IDs or an editorial snapshot artifact per definition; it must never emerge as one joined annual curve.

- [ ] Run `cd pipeline && pytest tests/test_publish_bout_en_bout.py -q` plus all new normaliser tests.
- [ ] Commit with `feat: publish five analysis datasets`.

### Task 7A: Add a sourced-series and snapshot dossier contract

**Files:**
- Create: `site/src/analyse-contrat.ts`
- Create: `site/src/analyse-contrat.test.ts`
- Modify only for integration: `site/src/analyse-rendu.ts`

Do not modify `site/src/analyses.ts` to host this contract. It already renders territorial analysis tables.

```ts
type SourceAnalyse = {
  id: string;
  titre: string;
  url: string;
  consulteLe: string;
};

type SerieAnalyse = {
  id: string;
  libelle: string;
  unit: string;
  definition: string;
  sourceId: string;
  observations: { period: string; value: number; qualityFlags?: string[] }[];
};

type PreuveAnalyse = {
  id: string;
  libelle: string;
  value: number;
  unit: string;
  period: string;
  definition: string;
  sourceId: string;
  seriesId?: string;
  comparableGroup?: string;
};
```

Add chapô, stable sections/anchors, optional contents, visualisation descriptors and explicit limitations. Every source ID is dossier-local, unique and resolvable. Reject any fallback to `sources[0]`. When `seriesId` exists, verify value, period and unit against the linked observation. Keep older short dossiers backward compatible.

- [ ] RED: duplicate/missing sources, mixed units, broken series links and two-proof/two-source attribution.
- [ ] GREEN: contract parser and backwards compatibility.
- [ ] Run `cd site && node --experimental-strip-types --test src/analyse-contrat.test.ts src/analyse-rendu.test.ts`.
- [ ] Commit with `feat: add sourced analysis dossier contract`.

### Task 7B: Render long dossiers without unit or source ambiguity

**Files:**
- Modify: `site/src/analyse-rendu.ts`
- Modify: `site/src/analyse-rendu.test.ts`
- Modify: `site/src/echelle.ts`
- Modify: `site/src/echelle.test.ts`
- Modify: `site/src/styles/dossiers-verification.css`

Render: breadcrumb/meta, question H1, chapô, `Réponse en 30 secondes`, two or three key proofs, contents, primary visual, narrative sections, `Ce que les données ne permettent pas de conclure`, method, complete data and sources. Keep prose near 60 to 68 characters while visuals may use the full width.

Group series by unit or declare axes explicitly. Two units never share an implicit axis. A proof cites its own `sourceId`; `commandeCiter()` must not attribute every number to the first source.

- [ ] RED: two series/two units and two proofs/two sources render distinct units and citations.
- [ ] GREEN: accessible figures/tables, literal definitions, nearby sources and backwards compatibility.
- [ ] Run `cd site && node --experimental-strip-types --test src/analyse-rendu.test.ts src/echelle.test.ts`.
- [ ] Commit with `feat: render sourced series dossiers`.

### Task 8: Author and pre-render the five dossiers

**Files:**
- Create: `site/analyses/nucleaire-allemand-prix-energie.json`
- Create: `site/analyses/prix-fournitures-scolaires.json`
- Create: `site/analyses/evolution-prix-gaz-menages.json`
- Create: `site/analyses/age-achat-residence-principale.json`
- Create: `site/analyses/evolution-qualite-vie.json`
- Modify: `site/src/analyse-rendu.test.ts`
- Modify: `site/scripts/prerendre.test.ts`

Visual contract by dossier:

- nuclear: separate nuclear-share chart, household electricity-price chart and ENTSO-E wholesale-price chart; shutdown date annotation; no causal overlay;
- supplies: two annual base-2015 indices and a visible series-break reserve;
- gas: D2 TTC versus excluding-tax series, plus separate French CPI/CRE component visuals when available; never mix units on one implicit axis;
- home purchase: snapshot table only, with definition and comparability warning per row; no line chart or reconstructed average;
- quality: annual life-satisfaction line on 0 to 10, with 2020/2022 break markers and no composite.

Every number carries `unit`, `period`, `definition` and `sourceId`. Load values from the versioned publication artifact, not copied constants. Use `mise_a_jour` only when a dossier genuinely revises an earlier publication.

- [ ] RED: `analysesPubliees()` returns all five slugs, resolves every source and catches prohibited representations.
- [ ] GREEN: five canonical routes and sitemap entries usable without JavaScript.
- [ ] Run `cd site && node --experimental-strip-types --test src/analyse-rendu.test.ts scripts/prerendre.test.ts`.
- [ ] Commit with `feat: publish five requested analyses`.

### Task 9A: Reserve `/analyses/` for editorial pages

**Files:**
- Modify: `site/src/routes.ts`
- Modify: `site/src/routes.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/scripts/prerendre.test.ts`

The conflict is the legacy `ALIAS.analyses = "bilan"`. Separate path aliases from fragment aliases.

```ts
assert.equal(vueDepuisAdresse("/analyses/", ""), null);
assert.equal(vueDepuisAdresse("/analyses/un-slug/", ""), null);
assert.equal(vueDepuisAdresse("/", "#analyses"), "bilan");
```

Guard editorial routes before `donnees.initialiser()`. Verify `dist/analyses/index.html` is canonical `/analyses/`, carries `data-page="editorial"` and is never repainted as Bilan.

- [ ] Commit with `fix: reserve analysis editorial routes` after route/pre-render tests pass.

### Task 9B: Replace the France content wall with progressive discovery

**Files:**
- Modify: `site/src/insights-france.ts`
- Modify: `site/src/insights-rendu.ts`
- Modify: `site/src/insights-rendu.test.ts`
- Modify: `site/src/insights-france.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/src/styles/bilan-guide.css`
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/scripts/prerendre.test.ts`

`/bilan` initially renders exactly eight thematic entries, one per existing theme. `/analyses/` initially paints twelve catalogue results, then filters and loads local batches of twelve. All remaining subjects stay searchable without a server or model call. Add a typed `analyseId` or canonical `link`, theme, question and tokenized keywords to short cards.

Share local navigation across `/bilan`, `/analyses/` and `/questions/`: `Vue d'ensemble`, `Dossiers`, `Questions`. At 390 px use one column, a labelled full-width search and a select or accessible filter drawer. At 1440 px use at most two catalogue columns. Fix the `h3`/rendered-`h4` mismatch, remove unresolved `--focus`/`--espace-9` and use one breakpoint convention.

- [ ] RED: eight Bilan entries, twelve initial catalogue items, all items still locally findable, no hidden full-card duplication.
- [ ] GREEN: local search, filters, progressive batches, 44 px controls and no overflow.
- [ ] Run `cd site && node --experimental-strip-types --test src/insights-rendu.test.ts src/insights-france.test.ts scripts/prerendre.test.ts && npm run build`.
- [ ] Commit with `feat: add progressive analysis discovery`.

### Task 10: Run the full analysis publication gate

- [ ] Run:

```bash
cd pipeline && pytest tests/test_registry_analyses_v3.py \
  tests/test_prix_energie_menages.py \
  tests/test_prix_gaz_france.py \
  tests/test_nucleaire_europe.py \
  tests/test_entsoe_prix.py \
  tests/test_fournitures_scolaires.py \
  tests/test_acquisition_residence.py \
  tests/test_qualite_vie.py \
  tests/test_publish_bout_en_bout.py -q

cd site && npm test
env -u ENTSOE_API_TOKEN npm run build
```

- [ ] Verify no published or executable use of `nrg_bal_c`, `ilc_pw01`, a monthly school-supply CPI, a `36.*39` purchase-age curve, automatic HVP/ENL joins, ENTSO-E calls from `site/` or `prerendre.ts`, model calls or X data.
- [ ] At 390 x 844 and 1440 x 900, capture Bilan, catalogue and every dossier family. Verify no horizontal overflow, 44 px controls, 60 to 68 character prose, one nearby source per proof and canonical no-JavaScript routes.
- [ ] Run complete `cd pipeline && pytest -q`, then `cd site && npm test && npm run build`.
- [ ] Commit only gate fixes with `test: verify five sourced analyses`.
