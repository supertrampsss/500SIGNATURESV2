# V3 Pre-rendered Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a French question desk whose public answers are entirely pre-rendered, source-linked and free of model calls at request time.

**Architecture:** Store a reviewed, versioned question corpus in the repository. Resolve exact aliases and weighted local matches in the browser, distinguish ambiguity from absence, render one validated answer at a canonical route, and refuse unsupported questions with three close suggestions. An optional post-MVP editorial command may use the OpenAI Responses API with Structured Outputs to propose aliases, but its output goes to a candidate file and never directly to production.

**Tech Stack:** TypeScript, JSON, Node test runner, Vite pre-render, optional OpenAI JavaScript SDK used only by an editorial script

## Global Constraints

- Execute `2026-08-30-v3-cinq-analyses.md` first so all nine analysis slugs and source IDs exist.
- Treat `../specs/2026-08-30-v3-direction-design-addendum.md` as a required acceptance contract.
- No browser or edge call to OpenAI or another model.
- No API key in bundled source, static assets or Cloudflare functions.
- Unsupported questions receive no generated answer.
- Ambiguous questions receive no answer until the user selects a canonical question.
- Raw user questions are never stored in a URL.
- Every answer references validated analysis, indicator and source IDs. Shape validation runs in shared code; referential validation runs at build time against the published registries.
- Question IDs are unique canonical slugs matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; no raw ID may reach `path.join()` or history routing before validation.
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
- Create `site/src/questions/render.ts`: editorial question-desk HTML.
- Create `site/src/questions/render.test.ts`: one-answer and source-link tests.
- Create `site/src/questions/controller.ts`: form and suggestion interactions.
- Create `site/src/questions/controller.test.ts`: DOM-independent action tests.
- Create `site/scripts/suggest-question-variants.ts`: optional editorial OpenAI command.
- Create `site/scripts/suggest-question-variants.test.ts`: request isolation and candidate validation.
- Modify `site/package.json`: add editorial command and OpenAI as a development dependency.
- Modify `site/src/routes.ts`, `site/src/routes.test.ts`, `site/src/main.ts`: `/questions/` index and `/questions/<id>/` canonical routes.
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
  assert.deepEqual(new Set(corpus.flatMap(({ analyseIds }) => analyseIds)), new Set([
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
  analyseIds: string[];
  indicateurIds: string[];
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

Populate answers only from the corresponding analysis verdict, figures and hypotheses. Do not introduce a new number or explanation in the corpus. `analyseIds` and `indicateurIds` are the canonical field names from the product spec. Every referenced analysis, indicator and source must resolve through the publication registries, and every indicator must be attributable to at least one referenced analysis or source.

- [ ] **Step 4: Implement runtime validation**

```ts
export function validateQuestionAnswer(value: unknown): string[] {
  if (!isRecord(value)) return ["entry:not-object"];
  const errors: string[] = [];
  for (const key of ["id", "canonicalQuestion", "shortAnswer", "detailedAnswer", "limits", "dataVersion", "reviewedAt"]) {
    if (typeof value[key] !== "string" || !(value[key] as string).trim()) errors.push(`${key}:required`);
  }
  for (const key of ["variants", "keywords", "analyseIds", "indicateurIds", "sourceIds"]) {
    if (!Array.isArray(value[key]) || !(value[key] as unknown[]).every((item) => typeof item === "string" && item.trim())) {
      errors.push(`${key}:string-array-required`);
    }
  }
  return errors;
}
```

`loadQuestionCorpus()` performs deterministic shape validation only. It throws on an invalid slug, duplicate IDs, empty arrays, duplicate normalised canonical questions or aliases, collisions after accent/case normalisation, invalid ISO dates or an em dash. Add tests for blank and punctuation-only aliases.

Add `validateQuestionCorpusReferences(corpus, { analyses, indicators, sources, dataVersion })` to the pre-render build. It checks every `analyseIds`, `indicateurIds` and `sourceIds` value against the actual publication registries and rejects a `reviewedAt` or `dataVersion` inconsistent with the artifacts being published. Browser code consumes only the already validated corpus and never attempts to reconstruct server-side registries.

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
- Produces: `QuestionMatch` with `exact`, `matched`, `ambiguous` or `unsupported` status.

- [ ] **Step 1: Write exact, paraphrase and refusal tests**

```ts
test("une variante exacte retrouve la réponse canonique", () => {
  assert.equal(searchQuestions("Le gaz a augmenté pourquoi ?", CORPUS).status, "exact");
});

test("une paraphrase suffisamment proche retrouve le dossier", () => {
  const result = searchQuestions("est-ce le nucléaire qui explique l'électricité chère allemande", CORPUS);
  assert.equal(result.status, "matched");
  assert.ok(result.answer?.analyseIds.includes("nucleaire-allemand-prix-energie"));
});

test("une question sans preuve est refusée avec trois suggestions au plus", () => {
  const result = searchQuestions("Qui gagnera la prochaine élection ?", CORPUS);
  assert.equal(result.status, "unsupported");
  assert.ok(result.suggestions.length <= 3);
  assert.equal(result.answer, undefined);
});

test("une question ambiguë ne choisit jamais une réponse à la place du lecteur", () => {
  const result = searchQuestions("le gaz augmente ou on en consomme plus", CORPUS);
  assert.equal(result.status, "ambiguous");
  assert.equal(result.answer, undefined);
  assert.ok(result.suggestions.length >= 2 && result.suggestions.length <= 3);
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
  const keywordScore = overlap(q, new Set(answer.keywords.flatMap((keyword) => [...tokens(keyword)])));
  return questionScore * 0.8 + keywordScore * 0.2;
}
```

Apply this order exactly: return `exact` for a normalised canonical question or variant; build the eligible set from candidates scoring at least `0.55`; return `unsupported` when the eligible set is empty; return `ambiguous` when the two best eligible candidates are within `0.08`; otherwise return `matched`. Ambiguity never promotes two weak non-zero matches. Suggestions contain at most three canonical IDs and never an answer.

- [ ] **Step 4: Add an ambiguity regression test**

Queries matching gas consumption and gas price equally must be `ambiguous` until an explicit variant disambiguates them.

- [ ] **Step 5: Run and commit**

Run: `cd site && node --experimental-strip-types --test src/questions/search.test.ts`

Expected: PASS.

```bash
git add site/src/questions/search.ts site/src/questions/search.test.ts
git commit -m "feat: add local question matching"
```

### Task 3: Render an editorial answer desk without fake chat

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
  assert.doesNotMatch(html, /Demandez-moi n'importe quoi|intelligence artificielle en direct|avatar|typing|message-bubble/);
});

test("une réponse rend ses limites et ses sources", () => {
  const html = renderQuestionResult(matchFor(CORPUS[0]!));
  assert.match(html, /question-answer__limits/);
  assert.match(html, /href="\/analyses\//);
  assert.match(html, /href="\/sources\/#/);
});

test("le rendu échappe le corpus et ne compose jamais une ancre brute", () => {
  const html = renderQuestionResult(matchWithText(`<script>alert("x")</script> & preuve`));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href="\/sources\/#[^\"]*[ /#]/);
});

test("une ambiguïté propose des questions sans rendre de réponse", () => {
  const html = renderQuestionResult(ambiguousMatch());
  assert.match(html, /question-answer__suggestions/);
  assert.doesNotMatch(html, /question-answer__short/);
});
```

- [ ] **Step 2: Implement semantic markup**

The form contains a visible label, search input, submit button and five initial suggestions. The page states the computed scope, for example `9 réponses validées`, plus the explicit review date; never hard-code `aujourd'hui`. The result uses `aria-live="polite"`. Render exactly one answer at a time. A `matched` result names the canonical question it selected. Source anchors are generated through the shared `lienSource()` helper or equivalent `encodeURIComponent` encoding, never by string concatenation. Test text, attributes and URLs containing quotes, `<`, `>`, `&`, spaces, `#`, `/` and accented characters. The unsupported copy is exactly:

```html
<p>Nous n'avons pas encore de réponse validée à cette question.</p>
```

- [ ] **Step 3: Add responsive styles**

```css
.question-page { max-width: 54rem; margin: 0 auto; padding: clamp(1rem, 4vw, 3rem); }
.question-form { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; }
.question-answer { margin-top: 1rem; padding: clamp(1rem, 3vw, 1.5rem); border-block: 1px solid var(--couleur-filet); }
@media (max-width: 600px) { .question-form { grid-template-columns: 1fr; } }
```

Use the shared local navigation `Vue d'ensemble`, `Dossiers`, `Questions`. Do not render avatars, chat bubbles, a typing indicator, fake streaming or a conversation history. Keep one paper answer surface and progressive sections for details, limits and sources.

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
- Produces: client-side answer updates and canonical answer routes without raw query parameters.

- [ ] **Step 1: Add route tests**

```ts
assert.equal(vueDepuisAdresse("/questions/", ""), "questions");
assert.equal(vueDepuisAdresse("/questions", ""), "questions");
assert.equal(vueDepuisAdresse("/questions/prix-du-gaz/", ""), "questions");
```

- [ ] **Step 2: Add controller reducer tests**

```ts
assert.deepEqual(questionAction({ type: "submit", value: "prix gaz" }, CORPUS), {
  query: "prix gaz",
  match: searchQuestions("prix gaz", CORPUS),
});
```

- [ ] **Step 3: Wire the page**

On submit, keep the raw query only in memory. For `exact` or `matched`, call `history.replaceState()` with `/questions/<answer.id>/` only after the ID has passed canonical slug validation, update only the result region and focus its heading. For `ambiguous` or `unsupported`, keep `/questions/` and render suggestions. On page load, resolve the canonical path segment only; an unknown ID renders a not-found question state and must never fall through to the territory view. Suggestion buttons use the validated answer ID. Do not call `fetch()`.

Move the editorial-route guard in `main.ts` before `donnees.initialiser()`. Question pages initialise only their local controller, so enabling JavaScript does not add a manifest or data-network dependency to an otherwise static answer.

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
- Produces: `/questions/index.html` plus one complete `/questions/<id>/index.html` page per corpus entry.

- [ ] **Step 1: Write pre-render assertions**

```ts
assert.ok(ecrites.some(({ chemin }) => chemin === "questions/index.html"));
const adresses = adressesPrerendues(analyses, corpus);
assert.match(planDuSite("https://500signatures.fr", adresses), /<loc>https:\/\/500signatures\.fr\/questions\/<\/loc>/);
for (const answer of corpus) {
  assert.ok(ecrites.some(({ chemin }) => chemin === `questions/${answer.id}/index.html`));
  assert.match(planDuSite("https://500signatures.fr", adresses), new RegExp(`/questions/${answer.id}/`));
}
```

- [ ] **Step 2: Add static fallback content**

Before any `path.join()`, validate every ID with the canonical slug rule and reject duplicates. The pre-rendered index includes the search form and a list of canonical questions linked to their pages. It does not stack the nine complete answers. Each canonical page contains its full answer, limits, precise source anchors and analysis link without requiring JavaScript. Add hostile-corpus tests proving that `..`, `/`, `?`, control characters and HTML cannot escape `dist/questions`, enter the sitemap or appear unescaped.

- [ ] **Step 3: Run and commit**

Run: `cd site && node --experimental-strip-types --test scripts/prerendre.test.ts && npm run build`

Expected: PASS and `dist/questions/index.html` exists.

```bash
git add site/scripts/prerendre.ts site/scripts/prerendre.test.ts
git commit -m "feat: prerender validated question corpus"
```

### Task 6: Add optional OpenAI-assisted editorial suggestions after MVP

This task is excluded from the first implementation pass. Execute Task 7 and publish the manual nine-entry corpus first. Return here only when editorial volume justifies the development dependency and paid editorial call.

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

Each corpus entry gets at least two unseen paraphrases. Add ambiguous cases for electricity versus gas, price versus consumption, homeowner versus recent buyer, and subjective satisfaction versus objective living conditions. Add clearly unsupported political prediction questions, plus blank, whitespace-only and punctuation-only inputs.

- [ ] **Step 2: Enforce evaluation thresholds**

```ts
assert.ok(coveredCorrect / coveredTotal >= 0.9);
assert.equal(ambiguousRefused / ambiguousTotal, 1);
assert.equal(unsupportedRefused / unsupportedTotal, 1);
assert.equal(wrongAnswerCount, 0);
```

Tune only variants and transparent thresholds. Do not add a model fallback.

- [ ] **Step 3: Scan the production bundle source**

```ts
assert.doesNotMatch(MAIN_SOURCE, /api\.openai\.com|OPENAI_API_KEY|new OpenAI/);
assert.doesNotMatch(FUNCTION_SOURCES, /api\.openai\.com|OPENAI_API_KEY|new OpenAI/);
```

Add markup and interaction assertions for labelled controls, `aria-describedby`, `aria-live`, focus transfer after a result, Escape where a disclosure is modal, visible focus, 44 px targets and `prefers-reduced-motion`. The build may still fetch versioned public data artifacts; the enforced promise is zero model calls and zero tokens at request time, not an unrelated fully offline publication build.

- [ ] **Step 4: Run full gates and commit**

Run: `cd site && npm test && npm run build`

Expected: PASS and build completes without OpenAI environment variables.

Verify `/questions/` and one canonical answer at 390 x 844 and 1440 x 900: labelled field, 44 px controls, no horizontal overflow, one answer surface, no chat bubble or fake streaming, focus visible, ambiguous state announced, precise source links and complete no-JavaScript page.

```bash
git add site/questions/evaluation.json site/src/questions/evaluation.test.ts site/src/interface.test.ts
git commit -m "test: enforce safe pre-rendered question matching"
```
