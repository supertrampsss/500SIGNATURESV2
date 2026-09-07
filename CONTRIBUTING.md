# Contributing

Our decision rule: improve user experience (UX), developer experience (DX), and agent
experience (AX) together. A good change makes a task clearer for users, isolates its
implementation, and gives the next contributor reliable instructions and tests.

## Start locally

From `site/`, with Node 22 or newer:

```sh
npm ci
npm run dev
```

Fast local validation after dependency installation (no production-data download):

```sh
npm run check:local
```

This runs all unit tests, checks application/scripts/edge types and builds the client.
It is useful in a restricted environment and is not a substitute for the full build,
editorial prerender, offline asset generation or required browser checks.
Use `npm run check:types` for a type-only diagnosis and `npm run build:client` for
client compilation. No command activates advertising, analytics or payments.

Production build and unit validation:

```sh
npm run check
```

`check` runs type checks, every discovered unit test, and the production build including
static pages, social assets and offline assets. It does not run browser or Python tests.
List unit tests with `node scripts/test-unit.mjs --list`. New `*.test.ts` files anywhere
under `src/` or `scripts/` are included automatically, exactly once.

## Choose the relevant checks

| Change | Required evidence |
|---|---|
| Game rules, savings, events, scoring | `npm test`; meaningful regression cases including delayed effects and boundaries |
| UI, navigation, scene, saved games or offline | `npm run check`, then `npm run test:mandats`; inspect affected phone and desktop screens |
| Other product tabs | `npm run check`; relevant editorial browser tests and visual review |
| Data pipeline | From `pipeline/`: `pip install ruff pytest -e .`, `ruff check .`, `pytest -q` |
| Documentation only | Check referenced paths and commands; no need to rerun unrelated browser tests |

Before the first browser run: `npx playwright install --with-deps chromium webkit`.
Browser tests use the built site, so build first. The runner starts its own preview
server on port 4180. Reports are in `site/playwright-report-mandats/`; failure traces
and screenshots are in `site/test-results/`. CI runs the full configured gates.

## Review a change

Explain the user problem, the resulting behavior and the evidence in the PR.
Identify the affected route/module, save or data compatibility, and any remaining risk.
For visual changes include actual before/after screens, not a proposed mockup.
Keep runtime effects tied to game state and reduced-motion preferences.
Prefer reversible changes; describe rollback or migration when persistence changes.
Do not add screens, disclosures or extra confirmation clicks without a user need.
Do not rename or rewrite unrelated modules merely for uniformity.

## Navigation

[AGENTS.md](AGENTS.md) contains current product constraints and the code map.
[Setup](docs/SETUP.md) covers infrastructure and configuration.
Historical plans in `docs/` explain previous decisions; current user instructions take priority.

## Current product and business decisions

Use [the current decision record](docs/product-business-decisions.md) for the
product constraints and commercial hypotheses. `npm run business:case` recalculates
advertising economics; audience, RPMs, direct sales and costs are assumptions until
measured. Use `src/advertising-policy.ts` for actual eligible routes and density.
For a business change, state the placement and format, reached inventory, consent
and fill assumptions, net publisher RPM and operating/sales costs. Direct ads
replace programmatic inventory. Never monetize game decisions as page views.
The policy is not an SDK adapter: actual serving needs configured ad units, consent
handling and verification of network behavior, empty slots and layout stability.

Dates displayed from source timestamps use UTC; calendar dates and covered fiscal
years must not change with the server or reader's timezone. Verify date changes
with the existing rendering tests in UTC and America/Los_Angeles.
