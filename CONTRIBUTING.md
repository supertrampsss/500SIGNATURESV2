# Contributing

From `site/`, with Node 22 or newer:

```sh
npm ci
npm run dev        # local server
npm test           # unit tests (every *.test.ts under src/ and scripts/)
npm run build      # types, build, prerender with the published data, offline game file
npx playwright install --with-deps chromium webkit   # once
npx playwright test                                  # browser journeys, five formats
npm run test:edge  # routes in the local Cloudflare runtime, after a build
```

Browser tests serve the built site on port 4180. Reports: `site/playwright-report/`,
failures: `site/test-results/`. Set `PW_CHROMIUM_EXECUTABLE` / `PW_WEBKIT_EXECUTABLE`
to use local browsers.

Data pipeline, from `pipeline/`: `pip install ruff pytest -e .`, `ruff check .`, `pytest -q`.

Explain the user problem, the behaviour and the evidence in the PR, with real
before/after screenshots for visual changes. [AGENTS.md](AGENTS.md) holds the product
constraints; [docs/SETUP.md](docs/SETUP.md) the infrastructure.
