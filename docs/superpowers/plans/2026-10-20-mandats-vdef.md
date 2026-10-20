# MANDATS vDef — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. User approval: “go dev. utilise bien tous les skills nécessaires.”, 20 October 2026.

**Goal:** Achever la boucle v17 approuvée : entrée exacte, carte actionnable et honnête, décisions lisibles, livraison compréhensible, maintien sans attente imposée et bilan rejouable.

**Architecture:** Garder moteur, numéros de version et journaux canoniques. Ajouter des modèles de lecture purs et une coordination de projection qui applique uniquement les vrais live-tick. Rendu HTML/SVG existant, presidency-strategy.css propriétaire des corrections v17. Publication uniquement après sauvegarde durable.

**Tech Stack:** TypeScript, Vite, CSS natif, SVG, Playwright Chromium/WebKit et scripts d’audit existants. Aucune dépendance nouvelle.

## Global Constraints
- French, plain language, concise visible choices, mobile first.
- A measure card validates in one click and advances directly. Preserve reading position.
- Keep the current approved illustrated map.
- New national games use v17; explicit older links and saves retain their rules.
- At x1 one v17 period lasts 30 seconds; v16 keeps 15 seconds.
- Only live-tick advances Game.turn; choices and history contain every journal entry, including orders.
- Preserve atomic saves, shared-preview adoption, pause, hidden tabs, offline use and journal-index replay.
- Show pressure as pressure, never as service quality. An intervention financed still awaits teams and actual delivery.
- No advertising in gameplay. No social publishing or tracking as a side effect.
- Maintain the existing stack; no new dependency. No rule or numerical rebalance disguised as presentation.
- Full-card activation, minimum44px essential controls; desktop1672×941, mobile390×844, compact320×568, landscape844×390, WebKit; reduced motion and safe-area.
- All sourced/observed data remain distinct from simulation assumptions; no invented causal attribution.
- Systematic delivery: push and merge PR after verification; keep gates and report blockers.
- Existing unrelated working-tree edits stay untouched. Worktree: C:/Users/a.lebrou/.codex/worktrees/mandats-audit-vdef/500 Signatures; branch codex/mandats-vdef-20261020.
- Reference assets: docs/mandats/audit-vdef-2026-10-20/maquettes/01-plateau-desktop.png, 02-arbitrage-mobile-v2.png, 03-bilan-causal.png. Read the audit’s integration caveats.

## Design contract
Marine#0a2637, papier ivoire, bordeaux for commands, amber for surveillance and red for actual danger; severity, trend and work are independent. Same approved map. Desktop right panel about440px. Mobile central panel with one scroll, persistent compact objectives and six sectors; vertical comparison even at320px. Readable real title, cost, annual charges, teams, delay and effect before activation, trade-off accessible. No hospital thumbnails that imply literal construction. Focus double outline works on marine and ivory. End screen: four real objectives, inherited/final comparison, two or three recorded causal chains and direct replay.

## Failure hypotheses written before code
1. Critical sector loses danger color after an engagement or slight improvement.
2. Six initial map cues look clickable but cannot open their sectors; clustering loses labels/urgency.
3. Mobile commands hide objectives or put bottom controls into the iPhone gesture zone.
4. V17 entry promises30 decisions or counts ticks as orders; v16 copy/rules change accidentally.
5. Rendering the causal replay uses a ministerial live-tick or period instead of sourceJournalIndex.
6. Annual charges become misleading total expenses; inherited macro trend is attributed entirely to player orders.
7. Controlled projection skips a delivery, escalation, annual close, expiry or ending, mutates its input, races clock/order or publishes after failed save.
8. Shared preview adoption happens implicitly; projection changes private storage before adoption.
9. News is ellipsized without a way to read it; opening/closing bulletin resumes time unexpectedly.
10. New layout makes last command unreachable at320×568 or loses keyboard focus after orders.
11. Historical replay and numeric fixtures change despite no rebalance.
12. Success calm periods are filled with invented crises instead of explicit observation control.

### Task1: Read models and pure controlled projection
**Files:** create site/src/mandats/presidency-read-model.ts, presidency-projection.ts; focused tests only where exact state equivalence/stop boundaries are not reliably exposed by E2E. Create failure-first tests before implementation. No view/runtime/CSS edits.

**Interfaces produced:**
```ts
export type ProjectionStop = 'delivery'|'alert'|'decision'|'annual-close'|'ending';
export type ProjectionResult = { game: Game; periods: number; stop: ProjectionStop };
export function projectToNextStop(game: Game): ProjectionResult;
export function strategySectorReading(game: Game, sector: PressureSectorId): {
 severity:'stable'|'warning'|'critical'; trend:'improving'|'steady'|'worsening';
 working:boolean; phase:string; label:string; pressure:number;
};
export function strategyCausalReceipts(game: Game): Array<{
 id:string; sector:PressureSectorId; title:string; choice:string;
 sourceJournalIndex:number; engagedPeriod:number; deliveredPeriod?:number;
 status:'preparing'|'delivered'|'expired'; replayable:boolean;
 cost:number; annualOperating:number; effect:string;
}>;
export function strategyFinancialComparison(game: Game): {
 actual:number; reference:number|null; delta:number|null; periods:number;
 comparable:boolean; referenceEndedEarly:boolean;
};
```
- [ ] Define exact input/phase/ledger semantics in comments before tests. No circular view imports.
- [ ] Test using legal seed47/0 inputs and archived capacity/hybrid journals: critical+project keeps severity; minister receipt is never replayable; projection equals same ordinary ticks and input is unchanged; delivery including created-and-delivered same tick, worsening phase, annual P5→P6, P29→P30, delayed effect expiry, ended/unsupported versions.
- [ ] Run focused tests and record expected pre-implementation failures, then implement.
- [ ] Reference without presidential orders retains autonomous ministers; same version/seed/ambition and horizon. Stop honestly on earlier reference ending; compare only same period and ledger status; delta=actual−reference. Bound cache size, no recursion or UI work.
- [ ] Projection applies decide(next,'live-tick') to pure copies until first structured change; no string-based event detection, no rule changes, no saved test-only hooks.
- [ ] Validate focused tests + types; report interfaces, command and output in task1-report.md; commit only owned files.
- [ ] Independent task review (requirements + quality) before Task2.

### Task2: Actual interface and causal result
**Files owned:** site/src/mandats/presidency-view.ts, presidency-strategy.css, presidency-board.css, presidency-board-layout.ts, render.ts, site/mandats/index.html; new vDef Playwright scenarios/config and .gitignore artifact entry. No presidency-runtime.ts or main.ts edits.
**Consumes:** Task1 read models; existing engine, sector actions, strategyState and recorded receipt indices.
**Produces:** real v17 markup/hooks for runtime, preserving existing action semantics.
- [ ] Read approved images and record the extracted hierarchy in task2-report.md before editing.
- [ ] Write browser regressions FIRST: true v17 entry/resume period vs orders; six action-ready map sectors and real critical+work; cap remains reachable with mobile panel; named comparable choice and whole-card click applies once; accessible complete bulletin; valid causal receipt/replay command; annual cost units.
- [ ] Add playwright.vdef.config.ts extending existing strategy config, output site/vdef-artifacts; projects desktop1672×941,390×844,320×568,844×390 and WebKit. Keep old strategy test configuration independent.
- [ ] Run red browser cases against built baseline; failure must be expected behavior, not missing browser/server. Mark runtime-dependent cases pending Task3 rather than fake implementation.
- [ ] Entry: “Cinq ans pour transformer le pays.” and correct autonomous-time explanation,30 two-month periods/about15active minutes excluding pauses; branch saved versions honestly.
- [ ] Keep six compact action-ready HTML sector pins; encode independent data-severity/data-trend/data-working on pins and SVG. Severity uses danger as well as phase. Cluster accessibility preserves all member names and worst urgency.
- [ ] Use the actual action title, visible engagement/annual charge/teams/minimumdelay/primaryeffect, full card action and an obvious command affordance. Keep locked reasons/details without hiding essential terms. No new confirmation.
- [ ] Crisis panel names actual critical sectors, provides existing sector links and separates coalition compromise. Objective label is “objectifs actuellement atteints”, kept compact while a fan is open.
- [ ] News remains an actual status and adds a real open-bulletin control; markup hooks for Task3. End result uses receipts and financial comparison; remove meaningless annualLimit from primary Cabinet detail; record votes and groups honestly, without inventing political mechanics.
- [ ] Replay buttons use data-action=branch-replay/data-turn=sourceJournalIndex; only valid presidential receipts. Export/new mandate remain separate and accessible.
- [ ] CSS: edit existing v17 ownership rather than append a parallel design system. Distinct focus; lower safe-area reserved; one scroll; 44px targets; no horizontal overflow; vertical choices on compact. Keep picture composition, pause/reduced-motion and v16.
- [ ] Green relevant browser cases/types/build; report exact remaining runtime hooks. Commit owned files.
- [ ] Independent task review before Task3.

### Task3: Atomic projection, full news and direct replay integration
**Files owned:** site/src/mandats/presidency-runtime.ts, main.ts, presidency-view.ts only required runtime hook adjustments; new tests site/tests/mandats-vdef.test.mjs. Task2 CSS may be adjusted only for runtime controls and review defects.
**Consumes:** ProjectionResult/projectToNextStop, Task2 markup, existing canonical save/commit machinery.
**Interfaces:**
```ts
// PresidencyOptions extension
project?: () => ProjectionResult | null;
openReplay?: (sourceJournalIndex?: number) => void;
```
- [ ] Write E2E failures first: paused explicit projection, clock running, preview rejected, quota failure preserves durable and visible state, double activation, export/import equality, first delivery and annual stop; bulletin opens in pause, keyboard close restores focus without hidden catch-up; replay selects valid source index and original archive survives.
- [ ] Main projection callback rejects shared/ephemeral/ended, computes pure candidate, performs ONE canonical save before publishing g/saved; errors keep country and original durable save, runtime remains paused. No per-tick partial saves.
- [ ] Runtime pauses before projection, locks competing transitions, resets visual progress only after success, remains paused, exposes actual periods advanced and stop reason. No implicit adoption, no hidden-tab catch-up.
- [ ] Show explicit “Avancer jusqu’au prochain changement” only for adopted ongoing v17, with clarification “simule les périodes, ne donne aucun ordre”; no timer or ad event. Existing ×1/×2/×4 untouched.
- [ ] Bulletin presents complete dated text and recent recorded deliveries; escape all content, accessible dialog/focus, restore prior explicit pause state safely.
- [ ] Wire causal replay through existing validated archive path; ministerial ticks cannot become replay CTAs. Restore scroll/disclosures where relevant.
- [ ] Run browser cases/strategy regression, exact projection equivalence, types and build. Report and commit.
- [ ] Independent task review before Task4.

### Task4: Whole-product verification, visual finish and delivery
**Files:** relevant covering regressions, docs/mandats-vdef.md, docs/mandats-vdef/ evidence, plan/progress updates. No unrelated refactor.
- [ ] Inspect and play first3active minutes using current build; correct observed defects.
- [ ] Run npm run check; bounded strategy model audit; existing strategy, presidency and mobile-boucles browser suites plus vDef scenarios. Existing CI gates remain.
- [ ] Play complete capacity and hybrid routes with legal inputs over several seeds, keep outcomes incl failures, and inspect end/replay. Use existing independent historical fixtures; no regenerated oracle.
- [ ] Inspect actual desktop/mobile/compact/landscape/WebKit, open choices, all6pins/cluster, objectives, news, critical+work, refused vote, quota, reduced motion, offline, export/import and final replay. Preserve screenshots/trace/video and source hashes.
- [ ] Final independent broad review with base/head diff package, plan and evidence; fix important findings and recheck affected scope.
- [ ] Document audit coverage A01–A18: delivered fixes, hypotheses consciously not rebalanced, measured limits. Human fun/retention and real installed iPhone remain unverified if no external device/player.
- [ ] Push feature branch, create and attach PR, wait checks, merge without extra confirmation; verify production separately if deployed. Do not claim deployment from build/merge alone.

## Execution and progress
Use subagents sequentially for implementations, independent review after each. Read-only experts may assist planning. Parent owns integration, actual browser inspection and final evidence. Progress ledger: docs/superpowers/plans/2026-10-20-mandats-vdef-progress.md.
