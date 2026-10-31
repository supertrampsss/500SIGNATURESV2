# Working on 500signatures

Make decisions that improve UX, DX and AX together: a clear product, maintainable code,
and enough explicit context for the next developer or agent to change it safely.
Prefer the smallest coherent change with evidence; never claim zero regression risk.

## The site (owner decision, 31 October 2026)

The site has three pages and nothing else. Old pages, their addresses and their code
were deleted (the site had not been shared); do not restore them or add redirects.

- `/` — **the story** (`site/src/recit/`). One page read by ordinary scrolling, from the
  bill of the State to the game: the bill, receipts, deficit, debt, where the money goes,
  Europe, your salary, your city, Mandats. It replaces the former Accueil, France, Ville and
  Dossiers. A sticky scene (map, banknotes, bars, treemap, coins, city charts, Assembly)
  follows the step crossing the middle of the screen; the text cards scroll over it.
  No wheel hijacking, no "Next" button. `rendu.ts` is pure (prerender and browser),
  `calculs.ts` reads published series and returns `undefined` when data is missing
  (a step without data disappears, never shows 0), `ville.ts` renders a chosen commune,
  `runtime.ts` animates. `/?ville=CODE` reopens the story on that commune.
- `/salaires/` — the salary page (`src/salaires.ts`, `src/salaires-page.ts`), same header.
- `/mandats/` — the game (`mandats/index.html`, `src/jeu/`). Turn-based: twenty quarters,
  two dossiers per quarter, an autumn budget (vote or 49.3), major reforms negotiated with
  political capital, a five-level street escalation. The defeat screen states the verdict,
  the threshold crossed and the decisions (including budgets and realised risks) behind it.
  Debt has market consequences above 165 Md€. All effects are game assumptions; only the
  published accounts are facts. Re-measure strategies with full-mandate bots after changing
  any economic rule. Dossiers stay cornelian and politically balanced; no real politician.
  Offline play is opt-in: the build writes `dist/mandats/sw.js` (`scripts/prerendre.ts`).
- `/confidentialite/` — privacy.

Menu: Récit, Salaires, Mandats.

## Identity

Night `#060b17`/`#0b1422` for telling, ivory `#fbfaf6` for reading sources. Gold `#d9b45f`
for money in and actions, clay `#e07a55` for deficit and pressure. Spectral Light for titles
and big numbers, IBM Plex Mono for amounts, years and sources, Public Sans for text; fonts
are self-hosted in `site/public/polices/`. Reduced motion keeps every state without animation.
Avoid CSS `filter` animations on many elements: they crashed WebKit.

## Data rules

Every number carries its source and year under it. When a breakdown exists only for another
year, label that year. France comparisons use France, Germany, Spain and Italy only.
Never invent sources. Keep observed data and game assumptions separate.

## Verify

From `site/`: `npm test` (unit), `npm run build` (types, build, prerender), then
`npx playwright test` (story, city, no-JS, reduced motion, salaries, consent, game; five
formats incl. 320 px and WebKit). Inspect real desktop and phone screenshots for UI changes.
`npm run test:edge` checks routes in the local Cloudflare runtime.
From `pipeline/`: `ruff check .` and `pytest -q`.

Report what changed, what was tested and what remains. The owner requests systematic
delivery: push the branch and merge the PR once CI is green, without asking again.

## Editorial voice

French, plain, « nous » / « on ». Natural sentences, no stock slogans or invented claims.
Explain methods positively and precisely, with dates, units and sources.
