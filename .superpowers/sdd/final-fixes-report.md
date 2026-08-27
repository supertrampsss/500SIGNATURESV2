# V3 core final fixes report

## Outcome

All final-review findings were corrected in the V3 core engine. The domain now rejects hostile effect target/key pairs, persists only reachable campaign states, snapshots scheduled consequences, preserves effect duration in the causal ledger, caps every due consequence at decision 96, and reserves `hold-course` for the real hold-course path.

## TDD evidence

- RED targeted regression command:
  `node --experimental-strip-types --test --test-name-pattern='clé de groupe|DecisionRecord|conséquences dont|sélection incompatible|phase ou une échéance|décision 96|hostile indicateur|annual|matérialisées|matérialisation refuse|hold-course' src/simulateur-v3/validation.test.ts src/simulateur-v3/effects.test.ts src/simulateur-v3/crises.test.ts`
  Result: 11 expected failures out of 12 selected tests, covering the missing guards and semantics.

- GREEN rerun of the same targeted command: 12 passed, 0 failed.

- Additional phase-matrix RED:
  `node --experimental-strip-types --test --test-name-pattern='chaque phase à sa position' src/simulateur-v3/validation.test.ts`
  Result: 1 expected failure for the initial `chapter_intro` position.

- Phase-matrix GREEN rerun: 1 passed, 0 failed.

## Changes

- `types.ts` makes `EffectRule` a target-discriminated union, records `duration` in `CausalEntry`, and stores the confirmed source option on political promises.
- `validation.ts` validates hostile effects at runtime, enforces all decision-record, phase, source, lock, due-date, and causal-ledger invariants, and rejects effects/events/promises due after decision 96.
- `effects.ts` validates effects before application, documents and preserves one-shot annual-rate semantics, snapshots effect rules and timing during scheduling, and rejects unreachable due dates.
- `crises.ts` excludes concessions named `hold-course` and resolves that reserved ID before concession lookup.
- Fixtures and tests now model a semantically reachable post-confirmation state and cover each new regression.

## Verification

- V3 suite: 78 passed, 0 failed.
- `npm test`: 1433 passed, 0 failed.
- `npm run build`: passed, including TypeScript, Vite, and prerender.
- `git diff --check`: passed.
- V3 U+2014 scan: passed with no matches.

## Concerns

- Vite still reports the repository's existing large generated JavaScript chunk warning. The build succeeds and this change does not add a bundle dependency.
- A persisted V3 save from before these schema hardenings that lacks causal `duration` or promise `sourceOptionId` is intentionally rejected as invalid rather than trusted.

## Catalogue-reference hardening addendum

### TDD evidence

- RED targeted command:
  `node --experimental-strip-types --test src/simulateur-v3/validation.test.ts src/simulateur-v3/storage.test.ts`
  Result: 37 passed and 3 expected failures. The failing regressions covered unknown or duplicate locks, unknown or duplicate fulfilled promises, and duplicate materialized delayed-event identifiers.

- GREEN targeted rerun of the same command: 40 passed, 0 failed.

- V3 suite initially exposed one historical fixture that fulfilled an undeclared promise. The fixture was made realistic by materializing that declared promise on decision 1 before fulfilling it on decision 2. Final V3 result: 82 passed, 0 failed.

### Changes

- `types.ts` exports `materializedDelayedEventId`, the one stable identifier function for delayed effects converted to queued events.
- `validation.ts` verifies that `locks`, `unlocks`, and `fulfillsPromises` are string arrays; validates known decision and declared-promise references; rejects duplicate and overlapping lock lists; rejects repeated `EffectRule.id` values across a single option's direct, event, and promise-failure effects; and rejects materialized delayed-event IDs that collide with explicit queued events or another delayed effect.
- `effects.ts` uses the same materialized-event identifier function when scheduling consequences, preventing validation and runtime ID generation from diverging.
- `effects.test.ts` now models the promise lifecycle that the strengthened catalogue invariant requires.
- `storage.test.ts` adds a concrete catalogue to create, select, confirm, validate, save, restore, and validate again with locks, a promise, and a delayed effect.

### Final verification

- Targeted validation and storage tests: 40 passed, 0 failed.
- V3 suite: 82 passed, 0 failed.
- `npm test`: 1437 passed, 0 failed.
- `npm run build`: passed, including TypeScript, Vite, and prerender.
- `git diff --check`: passed.
- U+2014 scan of `site/src/simulateur-v3` and this report: no matches.

### Concerns

- Vite continues to emit its pre-existing large generated chunk warning. It does not fail the build and is outside this validation hardening scope.

## Event and promise field hardening addendum

### TDD evidence

- RED targeted command:
  `node --experimental-strip-types --test src/simulateur-v3/validation.test.ts src/simulateur-v3/effects.test.ts`
  Result: 46 passed and 11 expected failures. The failures covered each malformed or empty scheduled-event and promise field, plus rejection before confirmation.

- GREEN rerun of the same command: 57 passed, 0 failed.

### Changes

- `validation.ts` now requires trimmed non-empty strings for `ScheduledEventRule.id`, `title`, and `body`, and for `PromiseRule.id` and `label`.
- The declared-promise lookup uses the same non-empty identifier and label rule, so a malformed rule cannot satisfy `fulfillsPromises`.
- Existing positive-integer validation for `afterDecisions` and `dueAfterDecisions` remains in place and has explicit regression coverage.
- `validation.test.ts` has independent cases for wrong-type and empty values of all five required fields.
- `effects.test.ts` proves `confirmSelection` rejects an edited malformed catalogue before it schedules its consequence.

### Final verification

- Targeted validation suite: 39 passed, 0 failed.
- V3 suite: 94 passed, 0 failed.
- `npm test`: 1449 passed, 0 failed.
- `npm run build`: passed, including TypeScript, Vite, and prerender.
- `git diff --check`: passed.
- U+2014 scan of `site/src/simulateur-v3` and this report: no matches.

### Concerns

- Vite continues to emit its existing large generated chunk warning. It does not fail the build and is outside this validation hardening scope.
