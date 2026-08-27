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
