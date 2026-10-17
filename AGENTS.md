# Working on 500signatures

Make decisions that improve UX, DX and AX together: a clear product, maintainable code,
and enough explicit context for the next developer or agent to change it safely.
When these conflict, protect the user journey and explain the trade-off in the PR.
Prefer the smallest coherent change with evidence; never claim zero regression risk.

## Product contract

- French, plain language, concise visible choices, mobile first.
- A measure card validates in one click and advances directly. Preserve reading position.
- France is the current game priority: v16 has thirty two-month clock periods over five years, with presidential orders and autonomous government initiatives independent of that clock. New national games use v16; explicit older links retain their rules. The owner waived old-save compatibility before public launch. Discuss municipal
  expansion separately. Existing municipal data and journeys still need compatibility.
- Show consequences after a decision; distinguish immediate and delayed effects.
- Keep finance, observed data and simulation assumptions separate. Never invent sources.
- France comparisons use France, Germany, Spain and Italy only when comparable data exist.
  Reuse `PAYS_VISIBLES`; do not restore an all-countries control or an outer Europe frame.
- Keep essential controls accessible without hover; respect reduced motion.
- Preserve new-game saves, deep links and offline use. Historical prelaunch saves are not a compatibility requirement. Do not clear storage to hide a bug.
- No advertising in gameplay. Do not activate social publishing or tracking as a side effect.

## Business decisions

[Current product and business decisions](docs/product-business-decisions.md) is the
current reference; earlier strategy documents are historical context. Advertising
is the owner's chosen business model; keep public reading and gameplay free.
Use `site/src/advertising-policy.ts`: one editorial placement initially, at most
two on long pages after validation, none in gameplay, results or essential sources.
Prefer manual in-flow placements and direct sponsorship replacing existing slots.
No sticky ads, interstitials, automatic refresh or targeting based on game decisions
or salary inputs. Do not infer SDK consent from a non-personalized ad label.
Label audience, rates, sales and costs as assumptions until measured. Include
eligibility, fill, reached inventory, direct sales effort and editorial costs;
never double-count inventory or deduct network fees twice. Commercial modules
must not change scores or observed data. Do not restore paid-workshop priorities.

## Find the right code

- `site/src/mandats/`: game engine, domain rules, session persistence and rendering.
- `site/src/mandats/living-board.css`: national board layout and responsive command zone.
- `site/src/mandats/decision-transition.ts`: decision lock and cancellable visual hand-off.
- `site/src/mandats/branch-replay.ts`: validated branches and original trajectory archive.
- `site/src/mandats/living-recaps.ts`: annual milestones and end-of-mandate replay.
- `site/src/mandats/national-command.ts`: concise national status and decision effects.
- `site/src/mandats/national-scene-state.ts`: game state to scene state.
- `site/src/mandats/winter/`: scene rendering; historical folder name, not product scope.
- `site/src/`: other product tabs and data presentation.
- `site/scripts/`: static rendering, social assets and offline bundle generation.
- `site/tests/`: Playwright journeys, including mobile, reduced motion and offline.
- `pipeline/`: Python data ingestion and validation. `infra/`: infrastructure.
- `docs/`: methodology, setup and historical plans. Older plans are context, not current scope.

## Work and verify

### Mandats: faithful miniature, spontaneous reforms and major crises (17 October 2026)

The owner explicitly replaces the old map with the attached October 17 ImageGen
reference in `docs/mandats-reference-v2/reference.png`. V16 uses `presidency-france-v2.webp`, a clean detailed miniature with
navy seas and ivory land. This supersedes earlier requirements to retain the old
v16 illustration. Keep actual HTML controls and state-driven effects above it;
never bake labels, alerts or values into the artwork. The sidebar is actual news,
not the reference's explanatory three-frame storyboard. Sector rules stay real.

Reforms and institutional choices appear directly on the map through
`presidencyEvents`; the catalogue is optional. `presidencyCrises` combines local
and civil incidents. Prolonged neglected service crises can cause strike, blockade,
revolt, government resignation and revolution with visible response windows.
Each stage has distinct funded responses. A delivered agreement provides respite;
a neglected revolution can end the mandate early. Presidential resignation is a
voluntary saved choice. Censure still concerns the government. Seeded variation
must preserve replay, export, offline behavior and v1–15 numeric rules.

`presidency-reference.css` owns this composition. Compare the live page with the
approved reference and inspect phone, compact, desktop and WebKit before delivery.
Run the presidency and crises suites, the bounded model audit and escalation audit.
See `docs/mandats-reference-v2.md` and `docs/mandats-escalade-v16.md`.

### Mandats: persistent incidents and animated pressure (17 October 2026)

The owner approved the crisis refactor and emphasised animation, simultaneous
problems and fast pressure. Keep the approved illustrated map. The twelve authored
incidents in `presidency-crises.ts` replace the fixed generic shock calendar only
for the new v16 presidency. Preserve versions 1–15. Incident responses share actual
credits, preparation and execution with other programmes; only delivery contains
or resolves them. Temporary containment can expire, acquired backlog remains, and
successful recovery provides real quiet periods. Origins use incident IDs and a
separate journal index, never a guessed period-to-journal conversion.

`presidency-crisis-view.ts` derives live vector effects, alerts and incident briefs;
`presidency-crises.css` owns choreography. Do not bake controls or numbers into art,
let animations issue commands, replace state with animation completion, or hide
ministerial news entirely on mobile. Keep specific responses first and ordinary
sector development accessible below. Pause stops deadlines and ambient motion;
reduced motion retains the same information. Sounds are opt-in. The sound control
must not overlap an open phone command panel.

Run `playwright.crises.config.ts` alongside the presidency suite and bounded model
audit. `MANDATS_CRISES_PHASE` separates reports from concurrent review runs. Retain
before/after captures, legal inputs and a real gameplay clip. The compressed v15
fixture is a numeric snapshot of main at 4c21961, not a generated expectation from
the new implementation. See `docs/mandats-crises-vivantes.md` for assumptions,
failure modes, reviewed corrections and evidence.

### Mandats: living presidency, approved mockups 2 + 4 (16 October 2026)

The owner validated a full gameplay change: independent time, standing presidential
priorities and operational initiatives by the government. This supersedes the old
prohibition on time controls for v16. Use the approved propagation map and direct
map commands in `docs/mandats-presidency/reference-{2,4}.png`; the country remains
visible without a mandatory queue of questions. See
[the contract and prewritten failure modes](docs/mandats-presidency-contract.md).

`presidency-engine.ts` owns rules and resources, `presidency-runtime.ts` the browser
clock and interactions, and `presidency-view.ts` / `presidency.css` the new board.
Only `live-tick` advances `Game.turn`; `choices` and `history` contain every journal
entry, including orders. The current illustration is 1672 by 941 native pixels,
not a Full HD master. Never bake UI, routes, progress or minister decisions into art.

Persist a transition before showing it. Pause on storage failure, hidden tabs and
reading panels; no elapsed-time catchup. A shared preview stays read-only until
explicit adoption. Government spending uses the same finite reserve and execution
as player orders. A minister cannot create credits or pass a law. Source rules,
votes, charges, actual delivery and expiration must agree. Keep explicit versions
1–15 and municipal compatibility; do not feed v16 order journals into legacy
sequential dossier reconstruction.

Run the presidency browser suite and bounded model audit alongside the existing
gates. Retain legal inputs, source hashes, before/after failures and inspected
1672 × 941, 390 px, 320 px and WebKit captures. The owner has approved implementation
and systematic PR delivery; ask no additional direction confirmation.

### Mandats: reports and reform access (16 October 2026)

The owner requires visible consequences for repeated deferrals and direct access to
major national reforms. Keep the national reform button outside the emergency
console's scrolling and disclosures, including while a front is open. Show the
real current reform and identify upcoming authored reforms honestly; the existing
residency/benefits dossier is not a complete immigration law.

V15 adds a temporary recovery programme in disrupted/crisis sectors, dimensioned
to the actual backlog with funding, preparation, shared implementation and finite
delivery. Do not reset stocks or add a generic penalty per click. Preserve explicit
v13/v14 numerical rules. Quantified waiting receipts are presentation fixes from
v14 onward, including actual backlog changes beyond pressure 100 and funded waiting.
Run `playwright.reports.config.ts` alongside command, pressure and existing gates.
See [failure hypotheses and evidence](docs/mandats-reports-reformes.md).

### Mandats: interface rework (16 October 2026)

The owner explicitly rejected the Mobbin map-exploration / bottom-sheet direction
and requires Plague Inc as the interface reference. The approved illustrated map
remains the visual source. V14 uses a strategic board: persistent situation news,
six simultaneous sector readings, actual execution resources and coalition support,
and a separate initiative menu. Keep header, HUD and navigation within the viewport.
The phone initiative menu occupies the central play area; Pays / Fermer returns to
the board. Keep every front actionable or linked to Bilan without spending time.
Do not hide all six stocks behind a disclosure or invent a global crisis score,
DNA, real-time deterioration, speed controls, or new policy dependencies.

`map-interface.css` owns the composition, `map-situation-view.ts` and
`map-situation.css` the state-derived HUD, `map-strategy.css` the initiative menu,
`map-pressure-view.ts` and `map-pressure.css` the detailed Bilan, and
`map-panels.ts` / `map-panels.css` Government and Projects. Render real seats,
saved vote outcomes, delivery capacity, costs and deadlines; never add display-only
game rules. Preserve full-card decisions, scrolling to the last choice, keyboard,
inline save errors, camera controls and the site link. Run
`npx playwright test --config playwright.command.config.ts` and the interface,
rework, social and pressure checks. Retain before/after captures and inspect the approved
1672 × 941 format plus desktop, 390 px, 320 px and WebKit. See
[the interface evidence](docs/mandats-interface-rework.md). The existing raster
illustration is not a new Full HD master.

### Mandats: persistent pressure (15 October 2026)

The owner requests iterative multi-agent scenario modelling and a pressure loop
inspired by Plague Inc. New national games use v14 and preserve the illustrated
map. Follow [the pressure contract](docs/mandats-pressure-contract.md) and retain
the [scenario matrix](docs/mandats-pressure-scenarios.json), including identified
extensions not yet modelled. Never claim exhaustive exploration of every sequence.

V14 additionally retains active cyber/hospital and port incidents and their explicit sector disruptions, and reuses already funded social concessions. V13 and explicit older links keep their published rules.

Six sector stocks persist across authored dossiers. Reading and inspection never
advance time; each real decision advances all fronts by one two-month period.
Votes, implementation capacity, temporary relief, narrative/social delivery and
annual accounts must agree. Rejected laws cannot engage their proposed effects.
Temporary operating rates accrue only during their active periods, including
expenses already acquired before expiration. Cross-sector links read a common
previous-period state. Recovery must create real breathing room.

`pressure-engine.ts` owns transitions and shared delivery allocation;
`pressure-content.ts` owns explicit mappings and hypothesis costs;
`pressure-agenda.ts` owns state-derived responses. Keep rules outside the views.
Run the bounded model audit and pressure browser configuration alongside the
existing rework/social suites. Retain seeds, strategies, inputs, invariant reports
and inspected desktop/390 px/320 px/WebKit screenshots before delivery.

### Shared mobile header

`site/src/navigation.ts` owns the compact menu and its grouped controls. Do not
create a second controller in a page module. Scope the compact grid to headers
with `.entete__actions`; static headers and explicit older Mandats links keep
their visible navigation. Mandats v12 uses its own header and exposes the site
through Ma partie, then Retour au site. Verify both paths with
`npx playwright test --config playwright.header.config.ts`
after building `site/`; retain the report, open/closed captures and replay inputs
under `site/header-artifacts/`.

### Mandats: direct decision flow (26 September 2026)

- A v11 decision saves immediately, renders its next agenda/year/ending, then overlays
  the recorded verdict for 1.8 seconds. No result page or mandatory Continue action.
- `decision-verdict.ts` owns only transient presentation. Closing, cancelling or
  interrupting it never calls the engine. Keep Escape, reduced motion and double-click protection.
- Each introduction explains the concrete problem in plain French. Do not repeat
  the previous outcome or list all choices again. Keep projects, promises and detailed
  vote history in Bilan, away from the next decision.

### Mandats: consequential narrative campaign (26 September 2026)

Follow [the narrative contract](docs/mandats-next-contract.md). `narrative-content.ts`
owns authored situations; `narrative-engine.ts` owns their eligibility, agenda,
promises and projects; the views render calculated state. Opening a front never
spends a decision. Rejected laws cannot finance a project or apply an amendment.
Project delivery and missed promises must keep their originating decision so a
causal replay can actually return to it. Rebuild derived state from versioned
inputs, never from imported balances or display labels. Shared dilemmas preserve
the local save until the player adopts them by making a decision.

Use `npm run test:story` for the narrative journeys and `npm run test:board` for
the existing journeys. Retain `site/story-artifacts/` reports, screenshots and
replay inputs, and inspect the 320 px, 390 px and desktop compositions. Keep the
site navigation and game balance accessible. Secondary history must not push
the decision cards several screens below the mobile scene.

### Mandats: political consequences (24 September 2026)

The owner approved consequential Assembly votes, coalition bargains, government
censure, dissolution, misconduct proceedings and rare institutional rupture.
Follow [the political contract](docs/mandats-political-contract.md). A rejected
law grants none of its implementation effects; elections change subsequent votes;
political obligations and early endings survive export, reload and replay.
Censure concerns the government, not presidential removal. Keep all calculations
in the deterministic versioned engine. Use `politics.ts`, `political-dilemmas.ts`,
`politics-view.ts` and `political-motion.ts`; artwork adds parliament, council and
rupture scenes. Render votes from their saved results, with skip and reduced motion.
Do not replace concrete sacrifices with generic “maintain course” options.


### Mandats: approved illustrated map (15 October 2026)

The owner explicitly abandoned the 3D reconstruction and requested the approved
mockup itself as an illustrated map. This supersedes the 8 October requirement
for a Babylon.js scene. Use `docs/mandats-diorama/reference-ordinateur.png` as the
visual source, with the interactive HTML interface and real saved state.
Follow [the illustrated-map contract](docs/mandats-illustrated.md) and
[social consequences](docs/mandats-social-contract.md).

The source illustration retains the approved geography, buildings, mountains,
water and lighting. Static game pins and controls are restored locally so live
subjects, projects and mobilisations can be drawn from actual game state.
Do not reintroduce a 3D renderer or rebuild the map from geometric primitives.
The approved navy header, ivory panel, serif headings and red alerts remain the
visual target. The small card chevrons may follow this approved reference.

Opening, zooming, panning or inspecting never spends a turn. Preserve the image
and its view between choices. Keep keyboard, reduced motion, image-load failure,
save/reload and opt-in offline play usable. Finishing five years remains the
survival objective; unrest alone does not remove the president. The short v12
verdict stays nonmodal. Earlier explicit game versions retain their own rules.

`map-state.ts` derives state, `map-runtime.ts` owns the illustrated view and
interactions, `map-illustrated-layout.ts` owns image anchors, `map-view.ts` and
`map-game.css` own its interface. The old 3D sources and comparisons are historical.
Run a full build and the rework/social browser suites, now checking the real
illustration lifecycle and game consequences. Keep the input records, reports
and desktop/390 px/320 px/WebKit captures. Compare the whole live page directly
with the approved image before claiming visual completion.

### Mandats: approved ten-screen visual reference (24 September 2026)

The owner approved the ten image-generated mobile compositions as the visual
target, including their detailed architectural miniatures, paper materials,
navy/ivory/red palette and large editorial serif typography. Do not simplify
them back into administrative panels. Use the production art in
`site/public/mandats/art/{office,school,hospital,nation,chapter,legacy,energy}.webp`
with real HTML controls, state and text. The artwork follows dossier themes;
only the game engine supplies quantitative consequences. Never bake game text
or metrics into a screenshot used as the interface.

The visual journey covers entry, choice, feedback, crisis, annual recap, next
chapter, exploration, final legacy, replay selection and trajectory comparison.
`cinema-board.css`, `cinema-shell.css`, `living-recaps.css` and `branch-replay.css`
own these compositions. Inspect actual desktop and phone renders before delivery.
Keep the entire measure card clickable and preserve new-game archives, export,
import and opt-in offline play. The site's ordinary navigation remains reachable.

### France: approved full-page visual reference (21 September 2026)

The owner's full desktop/mobile mockup `codex-clipboard-38fe691f-cbf0-4957-adf1-75a44ccb8736.png`
supersedes earlier France visual recommendations: navy/red on off-white, Assembly
photograph, compact chapter navigation and four KPIs, line charts, receipts table,
stacked spending bar, redistribution columns, paired social-security/debt panels,
European bar charts, seven illustrated topic cards and the complete footer.
Use `site/src/france-page.ts` and `site/src/styles/france-page.css` for this composition.
Keep all existing analyses accessible inside their topic and all numbers sourced.
Do not restore the old dot plots, giant headings or long ungrouped analysis layout.
France remains the national accounts page; Villes remains the territorial explorer.
Inspect the entire rendered page, including mobile and opened topics, before claiming
visual completion. A passing build is not evidence of visual fidelity.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for commands and checks by change type.
Inspect the working tree before edits and preserve other people's changes.
Keep domain rules outside UI code; use the existing stack before adding dependencies.

### Testing policy

- Highly prefer end-to-end (E2E) tests as the sole testing mechanism. Exercise complex
  features through real user journeys, including their consequential state changes.
- At the end of E2E runs, produce a verifiable, repeatable artifact: retain the test
  report and relevant screenshots, traces, exports, or captured outputs. Record the
  inputs needed to reproduce the journey, such as its seed, browser, and viewport.
- Never write unit tests after writing the code they test. If a system must be tested
  in isolation, first document the realistic ways it could fail, then write focused
  unit tests from that failure list before writing the implementation. Keep those tests
  only for failure modes the E2E suite cannot reliably expose; do not test constants,
  implementation details, or mirror the code path without a concrete defect scenario.
- All retained `*.test.ts` under `site/src` and `site/scripts` are discovered
  automatically; do not maintain import lists. For UI changes inspect the resulting
  screens as well as automated checks.
Report what changed, what was tested, and remaining limits. Never equate unit tests
with visual validation or a successful build with a successful production deployment.
Use a reviewable branch/PR. Respect existing merge gates and user authorization.
The owner requests systematic delivery: after validation, push the branch and merge
its PR without another confirmation. Keep required checks and branch protections;
report blockers instead of bypassing them. A later explicit hold takes precedence.

## Editorial voice (owner feedback, 19 September 2026)

- Speak as the project with French « nous » / « on », not a personal « je ».
- Lead social posts with a concrete, strong question or stake, including the
  presidential election horizon when relevant. Mention Dossiers alongside the tools.
- Explain methods and scope positively and precisely. Avoid wording that belittles
  the product, such as « le modèle est simplifié, ce n’est pas une fiche de paie ».
  Preserve necessary factual qualifications, dates, units and sources.
- Keep the Villes landing page neutral: no preselected city or suggested-city buttons.
- Apply Humanizer principles: natural French, no stock slogans or invented claims.

## Dossiers (owner-approved Journal layout, 19 September 2026)

- Visible navigation label: Dossiers. Preserve /analyses/ URLs.
- Introduce the subject, develop it with useful charts, finish with a conclusion.
- One reading column using the France palette and fonts. No author byline.
- Sources and publication/update dates belong at the bottom of each article.
- No verdict, proof-path, citation button, method panel, or collapsible article content.
- Cards are fully clickable, with a visible hover and keyboard focus.
