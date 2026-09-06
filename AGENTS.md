# Working on 500signatures

Make decisions that improve UX, DX and AX together: a clear product, maintainable code,
and enough explicit context for the next developer or agent to change it safely.
When these conflict, protect the user journey and explain the trade-off in the PR.
Prefer the smallest coherent change with evidence; never claim zero regression risk.

## Product contract

- French, plain language, concise visible choices, mobile first.
- A measure card validates in one click and advances directly. Preserve reading position.
- France is the current game priority: 45 decisions over five years. Discuss municipal
  expansion separately. Existing municipal data and journeys still need compatibility.
- Show consequences after a decision; distinguish immediate and delayed effects.
- Keep finance, observed data and simulation assumptions separate. Never invent sources.
- Keep essential controls accessible without hover; respect reduced motion.
- Preserve saved games, deep links and offline use. Do not clear storage to hide a bug.
- No advertising in gameplay. Do not activate social publishing or tracking as a side effect.

## Find the right code

- `site/src/mandats/`: game engine, domain rules, session persistence and rendering.
- `site/src/mandats/national-command.ts`: concise national status and decision effects.
- `site/src/mandats/national-scene-state.ts`: game state to scene state.
- `site/src/mandats/winter/`: scene rendering; historical folder name, not product scope.
- `site/src/`: other product tabs and data presentation.
- `site/scripts/`: static rendering, social assets and offline bundle generation.
- `site/tests/`: Playwright journeys, including mobile, reduced motion and offline.
- `pipeline/`: Python data ingestion and validation. `infra/`: infrastructure.
- `docs/`: methodology, setup and historical plans. Older plans are context, not current scope.

## Work and verify

Read [CONTRIBUTING.md](CONTRIBUTING.md) for commands and checks by change type.
Inspect the working tree before edits and preserve other people's changes.
Keep domain rules outside UI code; use the existing stack before adding dependencies.
Write meaningful regression tests for behavior changes. All `*.test.ts` under
`site/src` and `site/scripts` are discovered automatically; do not maintain import lists.
For UI changes inspect the resulting screens as well as automated checks.
Report what changed, what was tested, and remaining limits. Never equate unit tests
with visual validation or a successful build with a successful production deployment.
Use a reviewable branch/PR. Respect existing merge gates and user authorization.
The owner requests systematic delivery: after validation, push the branch and merge
its PR without another confirmation. Keep required checks and branch protections;
report blockers instead of bypassing them. A later explicit hold takes precedence.
