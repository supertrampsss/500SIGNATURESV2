# V3 Pre-rendered Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a chat-like French question interface whose public answers are entirely pre-rendered, source-linked and free of model calls at request time.

**Architecture:** Store a reviewed, versioned question corpus in the repository. Resolve exact aliases and weighted local matches in the browser, render one validated answer at a time, and refuse unsupported questions with three close suggestions. An optional editorial command may use the OpenAI Responses API with Structured Outputs to propose aliases, but its output goes to a candidate file and never directly to production.

**Tech Stack:** TypeScript, JSON, Node test runner, Vite pre-render, optional OpenAI JavaScript SDK used only by an editorial script

## Global Constraints

- Execute `2026-08-30-v3-cinq-analyses.md` first so all nine analysis slugs and source IDs exist.
- No browser or edge call to OpenAI or another model.
- No API key in bundled source, static assets or Cloudflare functions.
- Unsupported questions receive no generated answer.
- Every answer references validated analysis, indicator and source IDs.
- Model-assisted editorial output must use Structured Outputs, be reviewed and be committed before publication.
- The normal `npm run build` command must work without `OPENAI_API_KEY`.
- No X integration and no em dash in public copy.

---

## File Structure

- Create `site/src/questions/types.ts`: corpus and match contracts.
- Create `site/questions/corpus.json`: reviewed source corpus.
- Create `site/src/questions/corpus.ts`: load and validate corpus.
- Create `site/src/questions/corpus.test.ts`: referential and editorial gates.
- Create `site/src/questions/search.ts`: local normalisation and ranking.
- Create `site/src/questions/search.test.ts`: exact, paraphrase and refusal tests.
- Create `site/src/questions/render.ts`: chat-like answer HTML.
- Create `site/src/questions/render.test.ts`: one-answer and source-link tests.
- Create `site/src/questions/controller.ts`: form and suggestion interactions.
- Create `site/src/questions/controller.test.ts`: DOM-independent action tests.
- Create `site/scripts/suggest-question-variants.ts`: optional editorial OpenAI command.
- Create `site/scripts/suggest-question-variants.test.ts`: request isolation and candidate validation.
- Modify `site/package.json`: add editorial command and OpenAI as a development dependency.
- Modify `site/src/routes.ts`, `site/src/routes.test.ts`, `site/src/main.ts`: `/questions/` route.
- Modify `site/scripts/prerendre.ts`, `site/scripts/prerendre.test.ts`: canonical question page and sitemap.
- Create `site/src/styles/questions.css` and import it from the existing style entry point.

### Task 1: Define and validate the reviewed corpus

**Files:**
- Create: `site/src/questions/types.ts`
- Create: `site/src/questions/corpus.ts`
- Create: `site/src/questions/corpus.test.ts`
- Create: `site/questions/corpus.json`

**Interfaces:**
- Consumes: analysis JSON slugs and published indicator/source registries.
- Produces: `QuestionAnswer[]` through `loadQuestionCorpus()`.

- [ ] **Step 1: Write the failing corpus test**

```ts
test("le corpus initial couvre les neuf analyses longues", () => {
  const corpus = loadQuestionCorpus();
  assert.deepEqual(new Set(corpus.map(({ analysisId }) => analysisId)), new Set([
    "championne-du-monde-prelevements-2024",
    "defense-credits-votes-consommes-2025",
    "la-depense-publique-baisse-2024",
    "retraites-premier-poste-2024",
    "nucleaire-allemand-prix-energie",
    "prix-fournitures-scolaires",
    "evolution-prix-gaz-menages",
    "age-achat-residence-principale",
    "evolution-qualite-vie",
  ]));
  assert.ok(corpus.every(({ variants, sourceIds }) => variants.length >= 3 && sourceIds.length > 0));
});
```

- [ ] **Step 2: Define the schema**

```ts
export type QuestionAnswer = {
  id: string;
  canonicalQuestion: string;
  variants: string[];
  keywords: string[];
  shortAnswer: string;
  detailedAnswer: string;
  limits: string;
  analysisId: string;
  indicatorIds: string[];
  sourceIds: string[];
  dataVersion: string;
  reviewedAt: string;
};
```

- [ ] **Step 3: Create the initial nine-entry corpus**

Use these canonical questions, exactly:

```json
[
  "La France est-elle championne du monde des prélèvements ?",
  "Pourquoi existe-t-il deux chiffres pour le budget de la Défense ?",
  "La dépense publique baisse-t-elle vraiment ?",
  "Les retraites sont-elles le premier poste de dépense ?",
  "La sortie du nucléaire a-t-elle fait monter les prix en Allemagne ?",
  "Les fournitures scolaires augmentent-elles plus vite que l'inflation ?",
  "Pourquoi le prix du gaz a-t-il augmenté ?",
  "Achète-t-on sa résidence principale plus tard qu'avant ?",
  "La qualité de vie s'améliore-t-elle en France ?"
]
```

Populate answers only from the corresponding analysis verdict, figures and hypotheses. Do not introduce a new number or explanation in the corpus. Each `sourceIds` value must resolve through the published source registry.

- [ ] **Step 4: Implement runtime validation**

```ts
export function validateQuestionAnswer(value: unknown): string[] {
  if (!isRecord(value)) return ["entry:not-object"];
  const errors: string[] = [];
  for (const key of ["id", "canonicalQuestion", "shortAnswer", "detailedAnswer", "limits", "analysisId", "dataVersion", "reviewedAt"]) {
    if (typeof value[key] !== "string" || !(value[key] as string).trim()) errors.push(`${key}:required`);
  }
  for (const key of ["variants", "keywords", "indicatorIds", "sourceIds"]) {
    if (!Array.isArray(value[key]) || !(value[key] as unknown[]).every((item) => typeof item === "string" && item.trim())) {
      errors.push(`${key}:string-array-required`);
    }
  }
  return errors;
}
```

`loadQuestionCorpus()` throws on duplicate IDs, duplicate normalised aliases, missing source IDs, missing analysis slugs or an em dash.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/questions/corpus.test.ts`

Expected: PASS.

```bash
git add site/src/questions/types.ts site/src/questions/corpus.ts site/src/questions/corpus.test.ts site/questions/corpus.json
git commit -m "feat: add reviewed question corpus"
```

### Task 2: Implement deterministic local matching

**Files:**
- Create: `site/src/questions/search.ts`
- Create: `site/src/questions/search.test.ts`

**Interfaces:**
- Consumes: `QuestionAnswer[]` and raw French query.
- Produces: `QuestionMatch` with `exact`, `matched` or `unsupported` status.

- [ ] **Step 1: Write exact, paraphrase and refusal tests**

```ts
test("une variante exacte retrouve la réponse canonique", () => {
  assert.equal(searchQuestions("Le gaz a augmenté pourquoi ?", CORPUS).status, "exact");
});

test("une paraphrase suffisamment proche retrouve le dossier", () => {
  const result = searchQuestions("est-ce le nucléaire qui explique l'électricité chère allemande", CORPUS);
  assert.equal(result.status, "matched");
  assert.equal(result.answer?.analysisId, "nucleaire-allemand-prix-energie");
});

test("une question sans preuve est refusée avec trois suggestions au plus", () => {
  const result = searchQuestions("Qui gagnera la prochaine élection ?", CORPUS);
  assert.equal(result.status, "unsupported");
  assert.ok(result.suggestions.length <= 3);
  assert.equal(result.answer, undefined);
});
```

- [ ] **Step 2: Implement French normalisation**

```ts
const STOPWORDS = new Set(["a", "au", "aux", "de", "des", "du", "et", "est", "la", "le", "les", "un", "une"]);

export function normalizeQuestion(value: string): string {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeQuestion(value).split(" ").filter((token) => token.length > 1 && !STOPWORDS.has(token)));
}
```

- [ ] **Step 3: Implement transparent scoring**

```ts
function overlap(query: Set<string>, candidate: Set<string>): number {
  const common = [...query].filter((token) => candidate.has(token)).length;
  return common / Math.max(1, Math.sqrt(query.size * candidate.size));
}

function score(query: string, answer: QuestionAnswer): number {
  const q = tokens(query);
  const questionScore = Math.max(...[answer.canonicalQuestion, ...answer.variants].map((text) => overlap(q, tokens(text))));
  const keywordScore = overlap(q, new Set(answer.keywords.map(normalizeQuestion)));
  return questionScore * 0.8 + keywordScore * 0.2;
}
```

Return `exact` for a normalised canonical question or variant. Return `matched` only when the best score is at least `0.55` and exceeds the second score by at least `0.08`. Otherwise return `unsupported` and the three highest non-zero candidates as suggestions.

- [ ] **Step 4: Add an ambiguity regression test**

Queries matching gas consumption and gas price equally must be unsupported until an explicit variant disambiguates them.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/questions/search.test.ts`

Expected: PASS.

```bash
git add site/src/questions/search.ts site/src/questions/search.test.ts
git commit -m "feat: add local question matching"
```

### Task 3: Render the chat-like page without pretending it is generative

**Files:**
- Create: `site/src/questions/render.ts`
- Create: `site/src/questions/render.test.ts`
- Create: `site/src/styles/questions.css`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: corpus and `QuestionMatch`.
- Produces: page shell, answer card and unsupported state.

- [ ] **Step 1: Write the rendering tests**

```ts
test("la page annonce des réponses validées et pas une IA en direct", () => {
  const html = renderQuestionPage(CORPUS);
  assert.match(html, /Réponses validées et sourcées/);
  assert.doesNotMatch(html, /Demandez-moi n'importe quoi|intelligence artificielle en direct/);
});

test("une réponse rend ses limites et ses sources", () => {
  const html = renderQuestionResult(matchFor(CORPUS[0]!));
  assert.match(html, /question-answer__limits/);
  assert.match(html, /href="\/analyses\//);
  assert.match(html, /href="\/sources\//);
});
```

- [ ] **Step 2: Implement semantic markup**

The form contains a visible label, search input, submit button and five initial suggestions. The result uses `aria-live="polite"`. Render exactly one answer at a time. The unsupported copy is exactly:

```html
<p>Nous n'avons pas encore de réponse validée à cette question.</p>
```

- [ ] **Step 3: Add responsive styles**

```css
.question-page { max-width: 54rem; margin: 0 auto; padding: clamp(1rem, 4vw, 3rem); }
.question-form { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; }
.question-answer { margin-top: 1rem; padding: clamp(1rem, 3vw, 1.5rem); border: 1px solid var(--couleur-filet); border-radius: 1rem; }
@media (max-width: 600px) { .question-form { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/questions/render.test.ts`

Expected: PASS.

```bash
git add site/src/questions/render.ts site/src/questions/render.test.ts site/src/styles/questions.css site/src/style.css
git commit -m "feat: render validated question answers"
```

### Task 4: Add the `/questions/` route and interactions

**Files:**
- Create: `site/src/questions/controller.ts`
- Create: `site/src/questions/controller.test.ts`
- Modify: `site/src/routes.ts`
- Modify: `site/src/routes.test.ts`
- Modify: `site/src/main.ts`

**Interfaces:**
- Consumes: query form, suggestion buttons and local matcher.
- Produces: client-side answer updates and shareable `?q=` state.

- [ ] **Step 1: Add route tests**

```ts
assert.equal(vueDepuisAdresse("/questions/", ""), "questions");
assert.equal(vueDepuisAdresse("/questions", ""), "questions");
```

- [ ] **Step 2: Add controller reducer tests**

```ts
assert.deepEqual(questionAction({ type: "submit", value: "prix gaz" }, CORPUS), {
  query: "prix gaz",
  match: searchQuestions("prix gaz", CORPUS),
});
```

- [ ] **Step 3: Wire the page**

On submit, call `history.replaceState()` with `/questions/?q=<encoded query>`, update only the result region and focus its heading. On page load, resolve `q` if present. Suggestion buttons submit their exact canonical question. Do not call `fetch()`.

- [ ] **Step 4: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/routes.test.ts src/questions/controller.test.ts src/questions/render.test.ts`

Expected: PASS.

```bash
git add site/src/questions/controller.ts site/src/questions/controller.test.ts site/src/routes.ts site/src/routes.test.ts site/src/main.ts
git commit -m "feat: add local questions route"
```

### Task 5: Pre-render canonical questions and add them to the sitemap

**Files:**
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/scripts/prerendre.test.ts`

**Interfaces:**
- Consumes: reviewed corpus.
- Produces: `/questions/index.html` plus one crawlable canonical answer fragment per corpus entry.

- [ ] **Step 1: Write pre-render assertions**

```ts
assert.ok(ecrites.some(({ chemin }) => chemin === "questions/index.html"));
assert.match(planDuSite(analyses, corpus), /<loc>https:\/\/500signatures\.fr\/questions\/<\/loc>/);
for (const answer of corpus) assert.match(htmlQuestions, new RegExp(echapper(answer.canonicalQuestion)));
```

- [ ] **Step 2: Add static fallback content**

The pre-rendered page includes the search form and a collapsed list of canonical questions with complete answers. JavaScript-enhanced use continues to show one answer at a time. This preserves useful content for crawlers and no-script users.

- [ ] **Step 3: Run and commit**

Run: `cd site && node --experimental-strip-types --test scripts/prerendre.test.ts && npm run build`

Expected: PASS and `dist/questions/index.html` exists.

```bash
git add site/scripts/prerendre.ts site/scripts/prerendre.test.ts
git commit -m "feat: prerender validated question corpus"
```

### Task 6: Add optional OpenAI-assisted editorial suggestions

**Files:**
- Create: `site/scripts/suggest-question-variants.ts`
- Create: `site/scripts/suggest-question-variants.test.ts`
- Modify: `site/package.json`
- Modify: `site/package-lock.json`
- Create: `site/questions/candidates/.gitkeep`

**Interfaces:**
- Consumes: one committed analysis JSON, `OPENAI_API_KEY` and `OPENAI_EDITORIAL_MODEL`.
- Produces: an unapproved candidate JSON file containing variants and keywords only.

- [ ] **Step 1: Add the OpenAI SDK as a development dependency**

Run: `cd site && npm install --save-dev openai`

Expected: `openai` appears only under `devDependencies`.

- [ ] **Step 2: Write isolation tests**

```ts
test("le build ne lance jamais le générateur éditorial", () => {
  assert.doesNotMatch(PACKAGE.scripts.build, /suggest-question-variants/);
});

test("le candidat ne peut contenir ni réponse ni chiffre", () => {
  assert.deepEqual(Object.keys(validateCandidate({ variants: ["a", "b", "c"], keywords: ["gaz"] })).sort(), ["keywords", "variants"]);
});
```

- [ ] **Step 3: Implement the Structured Outputs call**

```ts
import OpenAI from "openai";

const model = process.env.OPENAI_EDITORIAL_MODEL;
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for the editorial command");
if (!model) throw new Error("OPENAI_EDITORIAL_MODEL is required for the editorial command");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.responses.create({
  model,
  input: `Propose des reformulations françaises de la question canonique. N'ajoute aucun chiffre, fait, réponse ou causalité.\n${JSON.stringify(editorialInput)}`,
  text: {
    format: {
      type: "json_schema",
      name: "question_variants",
      strict: true,
      schema: {
        type: "object",
        properties: {
          variants: { type: "array", items: { type: "string" } },
          keywords: { type: "array", items: { type: "string" } }
        },
        required: ["variants", "keywords"],
        additionalProperties: false
      }
    }
  }
});
```

Parse `response.output_text`, validate it, reject digits and em dashes, then write `site/questions/candidates/<slug>.json`. The command accepts exactly one `--slug` that must resolve to an existing analysis. It never edits `corpus.json`.

- [ ] **Step 4: Add the explicit script**

```json
{
  "questions:suggest": "node --experimental-strip-types scripts/suggest-question-variants.ts"
}
```

- [ ] **Step 5: Run and commit without making a paid call**

Run: `cd site && node --experimental-strip-types --test scripts/suggest-question-variants.test.ts && npm test && npm run build`

Expected: PASS with no API key and no network request because tests inject a fake client.

```bash
git add site/scripts/suggest-question-variants.ts site/scripts/suggest-question-variants.test.ts site/package.json site/package-lock.json site/questions/candidates/.gitkeep
git commit -m "feat: add offline question variant suggestions"
```

### Task 7: Add an evaluation set and enforce zero production calls

**Files:**
- Create: `site/questions/evaluation.json`
- Create: `site/src/questions/evaluation.test.ts`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: labelled covered, ambiguous and unsupported questions.
- Produces: precision and refusal regression gate.

- [ ] **Step 1: Create labelled evaluation cases**

Each corpus entry gets at least two unseen paraphrases. Add ambiguous cases for electricity versus gas, price versus consumption, homeowner versus recent buyer, and subjective satisfaction versus objective living conditions. Add clearly unsupported political prediction questions.

- [ ] **Step 2: Enforce evaluation thresholds**

```ts
assert.ok(coveredCorrect / coveredTotal >= 0.9);
assert.ok(unsupportedRefused / unsupportedTotal >= 0.95);
assert.equal(wrongAnswerCount, 0);
```

Tune only variants and transparent thresholds. Do not add a model fallback.

- [ ] **Step 3: Scan the production bundle source**

```ts
assert.doesNotMatch(MAIN_SOURCE, /api\.openai\.com|OPENAI_API_KEY|new OpenAI/);
assert.doesNotMatch(FUNCTION_SOURCES, /api\.openai\.com|OPENAI_API_KEY|new OpenAI/);
```

- [ ] **Step 4: Run full gates and commit**

Run: `cd site && npm test && npm run build`

Expected: PASS and build completes without OpenAI environment variables.

```bash
git add site/questions/evaluation.json site/src/questions/evaluation.test.ts site/src/interface.test.ts
git commit -m "test: enforce safe pre-rendered question matching"
```
