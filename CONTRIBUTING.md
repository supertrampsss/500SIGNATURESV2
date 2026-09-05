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
