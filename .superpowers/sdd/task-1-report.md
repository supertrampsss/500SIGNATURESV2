# Task 1 report: campaign topology

## Implementation

Added `site/src/simulateur-v3/campaign-topology.ts` with the approved campaign topology:

- `CAMPAIGN_CHAPTER_SIZES`: `[8, 8, 8, 8, 7, 7, 7, 7]`.
- `CAMPAIGN_DECISION_IDS`: the approved 60 unique decision IDs, in campaign order.
- `campaignLength`: derived from the decision ID list (`60`).
- `campaignPosition(completed)`: validates a reachable zero-based position and maps it to chapter and in-chapter decision indexes.

Added `site/src/simulateur-v3/campaign-topology.test.ts` covering the 60-item count, uniqueness, chapter sizes, campaign length, and final position mapping.

## TDD evidence

### RED

Command:

```text
cd site && node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts
```

Observed result: FAIL, with `ERR_MODULE_NOT_FOUND` for `site/src/simulateur-v3/campaign-topology.ts` (1 test failed, 0 passed). This was the expected missing-module failure before implementation.

### GREEN

Command:

```text
cd site && node --experimental-strip-types --test src/simulateur-v3/campaign-topology.test.ts
```

Observed result: PASS — `la topologie déclare 60 sujets uniques`; 1 test passed, 0 failed.

## Final test results

Command:

```text
cd site && npm test
```

Result: 1551 tests passed, 0 failed, 0 cancelled. The command emitted the existing npm warning `Unknown env config "http-proxy"`; it did not affect execution.

## Self-review

- Confirmed the implementation uses the exact approved IDs and chapter sizes from the brief.
- Confirmed the ID list is unique and the declared length is derived rather than duplicated.
- Confirmed `campaignPosition(59)` resolves to `{ chapterIndex: 7, decisionIndex: 6 }`.
- Ran `git diff --check` successfully.
- No unrelated files were modified.

## Concerns

The full suite retains pre-existing tests describing the provisional 96-decision scenario; this task intentionally adds the separate 60-decision campaign topology contract without changing that catalogue or scenario.
