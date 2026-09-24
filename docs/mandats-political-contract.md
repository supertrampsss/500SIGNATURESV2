# Mandats v10: political consequences implementation contract

Approved owner scope (24 September 2026): concrete costly dilemmas, real parliamentary votes, coalitions and broken promises, censure, dissolution/cohabitation, scandal/institutional legitimacy, destitution and rare national rupture/early termination. Preserve premium cinematic miniatures and touch-first decisions. Consequences must change finance/services/society, legal future options and actual continuation, never just prose or fake animation.

## Compatibility and architecture

- New games national v10. The owner explicitly waived preservation of old saves because the site is not public. Existing legacy code may remain when harmless; do not spend work on historical migration. Thirty decision slots / five years remain, but v10 can terminate earlier. Political crisis decisions consume actual slots and annual settling stays once per year. Pure deterministic seeded replay from choice IDs, no runtime AI dependency and no new network requirement.
- Game.version includes 10; Game.politics is optional for historical compatibility. Choice.political metadata and Turn.vote/political consequences may be optional. Political state computed during replay, never trust persisted arbitrary state.
- New pure modules politics-types.ts (shared types), politics.ts (state/votes/transitions), political-dilemmas.ts (conditional dossier content), politics-view.ts + politics.css (UI), political-motion.ts (actual tally animation). Engine owner establishes exports and shares with agents.
- Engine API isFinished(g): boolean; campaignDomain exposes dynamic political dilemma as current dossier when due, otherwise existing v9 agenda. campaignChoices must return [] after ending. decide rejects after ending.
- politics.ts exports initialPolitics(seed), resolvePoliticalChoice(before, choice) returning effective choice + political resolution, and applyPoliticalResolution(before, after, originalChoice, resolution). Resolve a legislative vote BEFORE finance application: rejection cannot grant intended spending, tax receipts, projects or delayed effects. Record voted result with deterministic group breakdown and explicit abstention.
- political-dilemmas.ts exports politicalDossier(g): Dossier|null. Concrete choices carry IDs and PoliticalChoice metadata, not matching prose. Ensure all routes are reachable through real gameplay. Do not require all players to suffer every catastrophe.

## Proposed state contract (engine owner may refine with immediate team communication)

PoliticalState: blocs[] {id,label,seats,loyalty,inGovernment}, legitimacy, unrest, cabinet ('stable'|'fallen'|'cohabitation'), commitments[] {id,label,dueTurn,status}, lastVote?, votes[], pendingCrisis? ('coalition'|'censure'|'cabinet'|'scandal'|'dissolution'|'destitution'|'rupture'), scandalExposure, misconduct, lastDissolutionTurn?, ending? {kind,title,reason,turn,causes:string[]}.
VoteRecord: id,kind ('law'|'censure'|'election'|'destitution'),title,chamber,total,for,against,abstain,threshold,passed,groups[] {id,label,for,against,abstain}, consequences:string[]. UI must consume record exactly; skip/reduced motion cannot change the outcome.
PoliticalChoice: action (concrete enum), stance/tags?, support deltas?, legitimacy?, unrest?, commitment?, breakCommitment?. Dilemma choices should include benefit and sacrifice explaining real computed effects.

## Core mechanics and dilemmas

1. Assembly contains exactly 577 seats allocated into fictional blocs. Each bloc responds to the proposal, constituency pain, coalition deals and past betrayals. Ordinary legislation: majority of expressed votes; censure: majority of members. Party discipline and defections are deterministic and bounded, totals reconcile.
2. Concrete pivotal-ally bargain: abandon wealth-tax receipts/hospital funds to retain parliamentary backing, or retain tax and lose ally support leading to actual censure vote. Fiscal effects only reverse actual enacted commitments, no free money or cancelling a tax never enacted. Establish the corresponding reform first if necessary.
3. Failed censure leaves costs/resentment; adopted censure falls cabinet and forces real next dossier: opposition-supported government (policy concessions/cohabitation) or dissolution when available. Censure alone does NOT end presidential mandate.
4. Dissolution redistributes exactly 577 seats based on seed, social conditions and legitimacy; may improve or worsen government support. Impose one-year cooldown (six decision slots). Election result affects all subsequent votes, no cosmetic reset.
5. Minister/account scandal: publish evidence + dismiss minister and lose coalition backing, or retain him to pass budget while assuming institutional exposure. Cover-up can resurface with accumulated misconduct. Destitution requires serious misconduct and a distinct constitutional path, never mere unpopularity. Model required parliamentary chambers/thresholds accurately if shown; no 289-vote 'presidential destitution'.
6. Sustained high unrest + legitimacy collapse + cabinet/political rupture can trigger national rupture: negotiate transition and depart, or emergency action with explicit rights/legitimacy costs, possible subsequent escalation. No operational violence, no magical stability recovery. Early endings are persisted/replayable and disable further choices.
7. Commitments have due slots and consequences of honoring/breaking them. They change subsequent support and outcomes. Financial/social delayed effects settle at documented times once.
8. Avoid one universally optimal policy: balance opposite trajectories and demonstrate reachable survival, failed law, censure, changed election, breach and early departure with tests.

## UI and delivery

- Real HTML controls, not screenshots as interface. Scenic illustrations around readable cards. Show concrete saved/lost stakes, bloc support, enacted/rejected decision status, previous causes, impending vote.
- Vote reveal animated from actual record, with accelerate/skip and reduced motion; persist decision before animation so reload never duplicates it.
- Use dynamic labels for early end and cohabitation. Preserve export/import, branch replay/reference restoration and offline art for new games. Old saved games are not a delivery requirement.
- Dedicated meaningful unit trajectories and browser v10 path, seed fixtures, phone/desktop captures. Full npm run check and required gates. Update obsolete expectations explicitly; prioritize default new-game v10 coverage and real reachable trajectories.
- Six Luna tasks share this worktree. Respect owned files and communicate API changes. Never remove node_modules symlink. Do not push/commit independently.
