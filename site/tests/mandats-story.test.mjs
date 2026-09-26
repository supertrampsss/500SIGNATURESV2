import { test, expect } from '@playwright/test';
import { readFile, copyFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import fixture from './fixtures/mandats-v11.json' with { type: 'json' };
import equilibriumFixture from './fixtures/mandats-equilibre.json' with { type: 'json' };
import { politicalVoteOutcome } from '../src/mandats/political-motion.ts';

const HOME = '/mandats/';
const SAVE_KEY = fixture.evidence.storageKey;
const agenda = (page) => page.locator('.story-agenda');
const frontChoices = (page) => page.locator('[data-action="choose"][data-choice]:not([disabled])');
const safeState = (game) => ({
  version: game.version,
  mode: game.mode,
  seed: game.seed,
  ambition: game.ambition,
  turn: game.turn,
  choices: game.choices,
  finance: game.finance,
  metrics: game.metrics,
  votes: game.politics?.votes ?? [],
  ending: game.politics?.ending ?? null,
  narrative: game.narrative ?? null,
});

async function rawSave(page) {
  return page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
}

async function interceptClipboard(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__mandatsCopiedText', { configurable: true, writable: true, value: '' });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value) => { window.__mandatsCopiedText = value; },
      readText: async () => window.__mandatsCopiedText,
    } });
  });
}

function localizeSharedUrl(value, currentPageUrl) {
  const shared = new URL(value);
  const preview = new URL(currentPageUrl);
  shared.protocol = preview.protocol;
  shared.host = preview.host;
  return shared.href;
}

function decodeExport(raw) {
  const storageModule = new URL('../src/mandats/storage.ts', import.meta.url).href;
  const script = `import { decode } from ${JSON.stringify(storageModule)}; let raw = ''; for await (const chunk of process.stdin) raw += chunk; process.stdout.write(JSON.stringify(decode(raw)));`;
  return JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { input: raw, encoding: 'utf8' }));
}

async function stored(page) {
  const raw = await rawSave(page);
  if (raw) return decodeExport(raw);
  const url = new URL(page.url());
  const version = Number(url.searchParams.get('v'));
  const mode = url.searchParams.get('mode');
  const seed = Number(url.searchParams.get('seed'));
  if (version === 11 && mode === 'national' && Number.isInteger(seed)) {
    return decodeExport(JSON.stringify({ version, mode, seed, ambition: url.searchParams.get('ambition') ?? 'equilibre', choices: [] }));
  }
  throw new Error('Aucune sauvegarde à décoder dans le parcours de navigateur.');
}

async function capture(page, info, label) {
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(label, { path, contentType: 'image/png' });
}

async function persistEvidence(page, info, label, extra = {}) {
  const save = await stored(page);
  const evidence = {
    fixture: fixture.schema,
    version: save.version,
    seed: save.seed,
    viewport: info.project.use.viewport,
    browser: info.project.name,
    browserVersion: page.context().browser()?.version() ?? 'unknown',
    input: { mode: save.mode, ambition: save.ambition, choices: save.choices },
    savedState: safeState(save),
    ...extra,
  };
  const path = info.outputPath(`${label}.json`);
  await writeFile(path, JSON.stringify(evidence, null, 2));
  await info.attach(`${label}-inputs-and-state`, { path, contentType: 'application/json' });
  return evidence;
}

async function openSeed(page, seed, { reducedMotion = false } = {}) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${HOME}?mode=national&v=11&seed=${seed}&ambition=equilibre`);
  await expect(agenda(page)).toBeVisible();
  const save = await stored(page);
  expect(save).toMatchObject({ version: 11, mode: 'national', seed, ambition: 'equilibre', choices: [] });
  return save;
}

test('fresh national play starts on the current v11 ruleset', async ({ page }) => {
  await page.goto(HOME);
  await page.getByRole('button', { name: /Gouverner la France/ }).click();
  const save = await stored(page);
  expect(save).toMatchObject({ version: 11, mode: 'national', choices: [] });
  await expect(page.locator('.story-agenda')).toBeVisible();
  const selectedId = await page.locator('.story-agenda [data-action="story-select"]').first().getAttribute('data-story-id');
  await page.locator('.story-agenda [data-action="story-select"]').first().click();
  const focusedRaw = await rawSave(page);
  expect(decodeExport(focusedRaw).narrative.focus).toBe(selectedId);
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(page.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  expect(decodeExport(await rawSave(page)).narrative.focus).toBe(selectedId);
});

async function pickFront(page, index = 0) {
  const before = await stored(page);
  const cards = page.locator('.story-agenda [data-action="story-select"][data-story-id]');
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(1);
  expect(await cards.count()).toBeLessThanOrEqual(3);
  const ids = await cards.evaluateAll((items) => items.map((item) => item.dataset.storyId));
  const button = cards.nth(index % ids.length);
  const chosen = await button.getAttribute('data-story-id');
  await button.click();
  await expect(page.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  const title = await page.locator('.dossier h1').innerText();
  const after = await stored(page);
  expect(after.choices).toEqual(before.choices);
  expect(after.turn).toBe(before.turn);
  expect(after.finance).toEqual(before.finance);
  expect(after.metrics).toEqual(before.metrics);
  expect(await page.locator('.story-agenda').count()).toBe(0);
  return { ids, chosen, title };
}

async function pickFrontId(page, id) {
  const before = await stored(page);
  const button = page.locator(`.story-agenda [data-action="story-select"][data-story-id="${id}"]`);
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  const after = await stored(page);
  expect(after.turn).toBe(before.turn);
  expect(after.choices).toEqual(before.choices);
  expect(after.finance).toEqual(before.finance);
}

async function chooseByTitle(page, title) {
  const button = frontChoices(page).filter({ hasText: title }).first();
  await expect(button).toBeVisible();
  await button.click();
}

async function chooseById(page, id) {
  const button = page.locator(`[data-action="choose"][data-choice="${id}"]:not([disabled])`);
  await expect(button).toBeVisible();
  await button.click();
}

async function waitForDecisionSurface(page) {
  await expect(page.locator('[data-decision-verdict]')).toBeVisible();
}

async function decide(page, choiceIndex = 0, { doubleClick = false, dismiss = true } = {}) {
  const before = await stored(page);
  const choices = frontChoices(page);
  await expect(choices.first()).toBeVisible();
  const choiceId = await choices.nth(choiceIndex % await choices.count()).getAttribute('data-choice');
  if (doubleClick) await choices.nth(choiceIndex % await choices.count()).dblclick();
  else await choices.nth(choiceIndex % await choices.count()).click();
  // Observe the transient receipt before the potentially expensive save replay.
  await waitForDecisionSurface(page);
  const verdict = page.locator('[data-decision-verdict]');
  // Pause the transient receipt through the real keyboard interaction while inspecting it.
  // The dedicated auto-close journey below verifies the unpaused timer independently.
  await page.keyboard.press('Tab');
  const verdictText = await verdict.innerText();
  if (dismiss) {
    await page.locator('[data-action="dismiss-verdict"]').click();
    await expect(verdict).toBeHidden();
  }
  const after = await stored(page);
  expect(after.version).toBe(11);
  expect(after.choices).toHaveLength(before.choices.length + 1);
  expect(after.choices.at(-1)).toBe(choiceId);
  expect(after.turn).toBe(before.turn + 1);
  const vote = after.history.at(-1).vote;
  if (vote) {
    if (vote.kind === 'election') {
      const stages = vote.stages?.length ? vote.stages : [vote];
      for (const stage of stages) expect(stage.groups.reduce((sum, group) => sum + (group.seats ?? 0), 0)).toBe(stage.total);
      expect(verdictText).toContain('Nouvelle répartition des sièges');
    } else {
      const stages = vote.stages?.length ? vote.stages : [vote];
      for (const stage of stages) expect(stage.for + stage.against + stage.abstain).toBe(stage.total);
      const expected = vote.kind === 'law' ? (vote.passed ? 'Texte adopté' : 'Texte rejeté') : politicalVoteOutcome(vote).label;
      expect(verdictText).toContain(expected);
    }
  }
  if (after.turn === 30 || after.politics?.ending) await expect(page.locator('.living-result')).toBeVisible();
  else if (after.turn % 6 === 0) await expect(page.locator('.year-recap')).toBeVisible();
  else await expect(agenda(page)).toBeVisible();
  return { before, after, choiceId };
}

async function continueStory(page) {
  const save = await stored(page);
  if (save.turn % 6 === 0) {
    await expect(page.locator('.year-recap')).toBeVisible();
    await page.locator('.year-recap [data-action="next-year"]').click();
  } else {
    await expect(page.locator('.story-result')).toHaveCount(0);
  }
  await expect(agenda(page)).toBeVisible();
}

async function openDecisionJournal(page) {
  await page.locator('[data-action="view"][data-view="finance"]').first().click();
  const journal = page.locator('.cinema-review__summary details').filter({ hasText: 'Le journal de vos décisions' });
  await expect(journal).toBeVisible();
  await journal.locator(':scope > summary').click();
}

test('v11 contexts are deterministic and agenda selection changes focus without spending a turn', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'The three seeded contexts are verified once; responsive journeys cover other browser projects.');
  for (const { seed, context } of fixture.contexts) {
    // Each direct URL is an incoming challenge. Keep each seed in its own
    // browser storage so a previous adopted challenge cannot shadow the next.
    const browserContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4181', viewport: info.project.use.viewport });
    const journey = await browserContext.newPage();
    await openSeed(journey, seed);
    await expect(journey.locator('.story-scene')).toContainText({ coalition: 'Coalition fragile', hospital: 'Hôpital prioritaire', redress: 'Redressement' }[context]);
    const starting = await stored(journey);
    const first = await pickFront(journey, 0);
    expect(first.ids.length).toBeGreaterThanOrEqual(1);
    expect(first.ids.length).toBeLessThanOrEqual(3);
    const opened = await stored(journey);
    expect(opened.choices).toEqual(starting.choices);
    await capture(journey, info, `seed-${seed}-decision`);
    // This URL is a shared challenge: focus is ephemeral and cannot overwrite a
    // previously saved mandate before the first consequential choice.
    expect(await rawSave(journey)).toBeNull();
    const { after } = await decide(journey, 0);
    expect(after.choices).toHaveLength(1);
    await continueStory(journey);
    const nextAgenda = await journey.locator('.story-agenda [data-story-id]').evaluateAll((items) => items.map((item) => item.dataset.storyId));
    expect(nextAgenda.length).toBeGreaterThanOrEqual(1);
    expect(nextAgenda.length).toBeLessThanOrEqual(3);
    expect(nextAgenda).not.toEqual(first.ids);
    await expect(agenda(journey)).toBeVisible();
    const reordered = await pickFront(journey, 1);
    expect(reordered.ids).toEqual(nextAgenda);
    await persistEvidence(journey, info, `seed-${seed}-inputs`, { expectedContext: context, agenda: reordered.ids });
    await browserContext.close();
  }
});

test('a reproducible 30-decision v11 policy route can reach and report a real annual surplus', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'The deterministic fiscal route runs once on desktop.');
  test.setTimeout(240_000);
  const seed = equilibriumFixture.seed;
  await openSeed(page, seed);
  const initial = await stored(page);
  expect(initial.finance.debt).toBeGreaterThan(0);
  for (let turn = 0; turn < equilibriumFixture.choices.length; turn += 1) {
    const choiceId = equilibriumFixture.choices[turn];
    const frontId = turn === 0 && choiceId.startsWith('pol-') ? 'institutional:0' : `policy:${turn}`;
    const policyFront = page.locator(`.story-agenda [data-action="story-select"][data-story-id="${frontId}"]`);
    await expect(policyFront).toBeVisible();
    await policyFront.click();
    await expect(page.locator('.story-scene[data-stage="decision"]')).toBeVisible();
    const choiceIndex = await frontChoices(page).evaluateAll((items, id) => items.findIndex((item) => item.dataset.choice === id), choiceId);
    expect(choiceIndex, `La mesure ${choiceId} doit rester disponible au tour ${turn + 1}.`).toBeGreaterThanOrEqual(0);
    const { after } = await decide(page, choiceIndex);
    expect(after.choices.at(-1)).toBe(choiceId);
    if (after.turn < equilibriumFixture.choices.length) await continueStory(page);
  }
  const final = await stored(page);
  expect(final.version).toBe(11);
  expect(final.seed).toBe(seed);
  expect(final.choices).toEqual(equilibriumFixture.choices);
  expect(final.turn).toBe(30);
  expect(final.history.at(-1).ledger.deficit).toBeLessThan(0);
  await expect(page.locator('.narrative-outcome')).toContainText(/excédent/i);
  await capture(page, info, 'v11-surplus-final');
  await persistEvidence(page, info, 'v11-surplus-inputs', { expectedFinalDeficit: final.history.at(-1).ledger.deficit });
});

test('an adopted amendment changes the ledger once, while a rejected amendment has no budget or narrative effect', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'Targeted vote evidence uses one deterministic browser journey.');
  const seed = 0;
  await openSeed(page, seed);
  await pickFrontId(page, 'soins-garde-nuit');
  const beforeAdopted = await stored(page);
  await chooseByTitle(page, 'Réorganiser les gardes existantes');
  const adopted = await stored(page);
  expect(adopted.politics.votes.at(-1)).toMatchObject({ kind: 'law', passed: true });
  expect(adopted.finance.operating - beforeAdopted.finance.operating).toBeCloseTo(0.35, 8);
  expect(adopted.history.at(-1).messages.join(' ')).toContain('Compromis adopté');
  await capture(page, info, 'v11-amendment-adopted');

  const rejectContext = await browser.newContext({ viewport: info.project.use.viewport, baseURL: new URL(page.url()).origin });
  const rejectPage = await rejectContext.newPage();
  await openSeed(rejectPage, 1);
  await pickFrontId(rejectPage, 'soins-garde-nuit');
  const beforeRejected = await stored(rejectPage);
  await chooseByTitle(rejectPage, 'Réorganiser les gardes existantes');
  const rejected = await stored(rejectPage);
  expect(rejected.politics.votes.at(-1)).toMatchObject({ kind: 'law', passed: false });
  expect(rejected.finance.operating).toBe(beforeRejected.finance.operating);
  expect(rejected.narrative.projects).toEqual([]);
  expect(rejected.narrative.lastConsequences.join(' ')).toMatch(/Le texte est rejeté.*aucun crédit ni projet/i);
  expect(rejected.history.at(-1).messages.join(' ')).toMatch(/aucune recette, dépense, mesure sociale ni livraison prévue n’est appliquée/i);
  await capture(rejectPage, info, 'v11-amendment-rejected');
  await persistEvidence(rejectPage, info, 'v11-rejected-project-no-effect', { expectedVote: 'rejected', expectedProjectCount: 0 });
  await rejectContext.close();
});

test('a funded hospital project is delivered once and fulfils its linked promise', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'Project lifecycle evidence uses one deterministic seed.');
  await openSeed(page, 1);
  await pickFrontId(page, 'soins-garde-nuit');
  await chooseByTitle(page, 'Engager la rénovation du service');
  let game = await stored(page);
  expect(game.politics.votes.at(-1)).toMatchObject({ kind: 'law', passed: true });
  expect(game.narrative.projects).toMatchObject([{ id: 'service-rives', status: 'funded', dueTurn: 2 }]);
  await continueStory(page);

  await pickFrontId(page, 'policy:1');
  await chooseByTitle(page, 'Préserver les pensions et financer l’aide à domicile');
  game = await stored(page);
  expect(game.turn).toBe(2);
  await continueStory(page);

  await pickFrontId(page, 'policy:2');
  // The stable choice id is part of the versioned replay contract; its display
  // copy may be edited without making this lifecycle scenario brittle.
  await chooseById(page, 'r02a');
  game = await stored(page);
  expect(game.turn).toBe(3);
  expect(game.narrative.projects.find((project) => project.id === 'service-rives')).toMatchObject({ status: 'delivered', deliveredTurn: 2 });
  expect(game.narrative.promises.find((promise) => promise.id === 'service-rives')).toMatchObject({ status: 'kept', causeTurn: 0, dueTurn: 2, resolvedTurn: 2 });
  expect(game.narrative.events.some((event) => event.kind === 'project' && event.title === 'Une réalisation ouvre ses portes' && event.causeTurn === 0)).toBe(true);
  expect(game.history.at(-1).messages.join(' ')).toContain('Mise en service : Rénovation du service de soins.');
  await capture(page, info, 'v11-project-delivered');
  await persistEvidence(page, info, 'v11-project-delivered-inputs');
});

test('a blocked project can be repaired through its real follow-up, while a rejected abandonment changes no project finances', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'The deterministic blocked-project branch is exercised once on desktop.');
  test.setTimeout(180_000);
  const route = fixture.journeys.projectRecovery;
  const input = { version: 11, mode: 'national', seed: route.seed, ambition: 'equilibre', choices: route.blockedChoices };
  await page.addInitScript((value) => localStorage.setItem('500signatures.mandats.v1', JSON.stringify(value)), input);
  await page.goto(HOME);
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();

  const blocked = await stored(page);
  const project = blocked.narrative.projects.find((item) => item.id === route.projectId);
  expect(blocked.version).toBe(11);
  expect(blocked.seed).toBe(route.seed);
  expect(blocked.choices).toEqual(route.blockedChoices);
  expect(blocked.turn).toBe(route.blockedAfterDecision);
  expect(project).toMatchObject({ status: 'blocked', startedTurn: 16, dueTurn: 18, failureTurn: 18 });
  expect(blocked.metrics.services).toBeLessThan(40);
  expect(blocked.finance.cash).toBe(0);
  await expect(agenda(page)).toBeVisible();
  const followUp = page.locator('.story-agenda [data-action="story-select"]').filter({ hasText: /Raccordement ouvert du bassin/ });
  await expect(followUp).toBeVisible();
  const followUpId = await followUp.getAttribute('data-story-id');
  expect(followUpId).toMatch(/^suivi-/);
  await pickFrontId(page, followUpId);
  const repairId = await frontChoices(page).evaluateAll((items) => items.map((item) => item.dataset.choice).find((id) => /reprendre/.test(id)));
  expect(repairId).toMatch(new RegExp(`^${route.repairChoicePrefix}`));
  await chooseById(page, repairId);
  const repaired = await stored(page);
  expect(repaired.turn).toBe(20);
  expect(repaired.narrative.projects.find((item) => item.id === route.projectId)).toMatchObject({ status: 'funded', dueTurn: 21 });
  expect(repaired.metrics.services).toBeGreaterThanOrEqual(40);
  expect(repaired.finance.cash).toBe(0);
  await capture(page, info, 'v11-project-reopened');

  await continueStory(page);
  await pickFrontId(page, 'policy:20');
  await chooseById(page, 'r15a');
  const beforeDelivery = await stored(page);
  expect(beforeDelivery.turn).toBe(21);
  expect(beforeDelivery.narrative.projects.find((item) => item.id === route.projectId).status).toBe('funded');
  await continueStory(page);
  await pickFrontId(page, 'policy:21');
  await chooseById(page, 'r16a');
  const delivered = await stored(page);
  const completedProject = delivered.narrative.projects.find((item) => item.id === route.projectId);
  expect(delivered.turn).toBe(route.deliveryAfterDecision);
  expect(completedProject).toMatchObject({ status: 'delivered', deliveredTurn: 21, startedTurn: 16 });
  expect(delivered.narrative.events.some((event) => event.kind === 'project' && event.causeTurn === 16 && event.turn === 21)).toBe(true);
  expect(delivered.history.at(-1).messages.join(' ')).toMatch(/Mise en service|livraison|réalisation/i);
  await capture(page, info, 'v11-project-recovered-delivery');
  await persistEvidence(page, info, 'v11-project-recovery-inputs', { blockedProject: project, repairedProject: completedProject });

  const abandonContext = await browser.newContext({ viewport: info.project.use.viewport, baseURL: new URL(page.url()).origin });
  const abandonPage = await abandonContext.newPage();
  await abandonPage.addInitScript((value) => localStorage.setItem('500signatures.mandats.v1', JSON.stringify(value)), input);
  await abandonPage.goto(HOME);
  await abandonPage.getByRole('button', { name: 'Reprendre', exact: true }).click();
  const abandonBefore = await stored(abandonPage);
  const abandonment = abandonPage.locator('.story-agenda [data-action="story-select"]').filter({ hasText: /Raccordement ouvert du bassin/ });
  await expect(abandonment).toBeVisible();
  await pickFrontId(abandonPage, await abandonment.getAttribute('data-story-id'));
  const abandonChoice = await frontChoices(abandonPage).evaluateAll((items) => items.map((item) => item.dataset.choice).find((id) => /abandonner/.test(id)));
  expect(abandonChoice).toBeTruthy();
  await chooseById(abandonPage, abandonChoice);
  await waitForDecisionSurface(abandonPage);
  const abandonAfter = await stored(abandonPage);
  expect(abandonAfter.turn).toBe(abandonBefore.turn + 1);
  expect(abandonAfter.politics.votes.at(-1)).toMatchObject({ kind: 'law', passed: false });
  expect(abandonAfter.narrative.projects.find((item) => item.id === route.projectId)).toMatchObject({ status: 'blocked', startedTurn: 16 });
  expect(abandonAfter.finance.cash).toBe(abandonBefore.finance.cash);
  expect(abandonAfter.finance.operating).toBe(abandonBefore.finance.operating);
  expect(abandonAfter.narrative.events.some((event) => event.kind === 'project' && event.causeTurn === 16 && /livr|réalisation/i.test(event.title))).toBe(false);
  await capture(abandonPage, info, 'v11-project-abandonment-rejected');
  await persistEvidence(abandonPage, info, 'v11-project-abandonment-inputs', { expectedStatus: 'blocked', expectedNoRefundOrDelivery: true });

  // A rejected exit leaves the project in the agenda. The same motion is voted
  // again on the next decision; this seed passes it, producing a real withdrawn
  // status without refunding the already-spent investment.
  await continueStory(abandonPage);
  const retryFront = abandonPage.locator('.story-agenda [data-action="story-select"]').filter({ hasText: /Raccordement ouvert du bassin/ });
  await expect(retryFront).toBeVisible();
  await pickFrontId(abandonPage, await retryFront.getAttribute('data-story-id'));
  const retryId = await frontChoices(abandonPage).evaluateAll((items) => items.map((item) => item.dataset.choice).find((id) => /n11-20-.*abandonner/.test(id)));
  expect(retryId).toBeTruthy();
  const retryIndex = await frontChoices(abandonPage).evaluateAll((items, id) => items.findIndex((item) => item.dataset.choice === id), retryId);
  const withdrawnResult = await decide(abandonPage, retryIndex);
  const withdrawn = withdrawnResult.after;
  const withdrawnProject = withdrawn.narrative.projects.find((item) => item.id === route.projectId);
  expect(withdrawn.turn).toBe(21);
  expect(withdrawn.politics.votes.at(-1)).toMatchObject({ kind: 'law', passed: true });
  expect(withdrawnProject).toMatchObject({ status: 'withdrawn', startedTurn: 16 });
  expect(withdrawnProject.note).toMatch(/crédits déjà dépensés ne sont pas récupérés/i);
  expect(withdrawn.finance.cash).toBe(0);
  expect(withdrawn.finance.investment).toBe(abandonAfter.finance.investment);
  expect(withdrawn.metrics.assets).toBe(abandonAfter.metrics.assets);
  expect(withdrawn.metrics.services).toBe(abandonAfter.metrics.services);
  expect(withdrawn.narrative.events.some((event) => event.kind === 'project' && event.title === 'Le chantier est abandonné' && event.causeTurn === 20)).toBe(true);
  await capture(abandonPage, info, 'v11-project-abandoned-without-refund');
  await persistEvidence(abandonPage, info, 'v11-project-withdrawn-inputs', { expectedStatus: 'withdrawn', expectedRefund: 0, expectedDelivery: false });
  await abandonContext.close();
});

test('a censure and destitution crisis interrupts v11 with its votes and replay still available', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'The deterministic institutional ending is verified once on desktop.');
  const choices = [
    'pol-wealth-hospital-package', 'pol-coalition-compromise', 'r01c', 'r02c', 'r03c', 'r04c', 'u01c',
    'r05c', 'r06c', 'r07c', 'r08c', 'u00c', 'pol-scandal-cover-up', 'pol-scandal-cover-up',
    'pol-scandal-cover-up', 'pol-scandal-cover-up', 'pol-scandal-publish', 'pol-censure-vote', 'pol-destitution-vote',
  ];
  const replayInputs = { version: 11, mode: 'national', seed: 27, ambition: 'equilibre', choices };
  await page.addInitScript((value) => localStorage.setItem('500signatures.mandats.v1', JSON.stringify(value)), replayInputs);
  await page.goto(HOME);
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();

  const ended = await stored(page);
  expect(ended.version).toBe(11);
  expect(ended.seed).toBe(27);
  expect(ended.choices).toEqual(choices);
  expect(ended.turn).toBe(19);
  expect(ended.politics.ending).toMatchObject({ kind: 'destitution' });
  expect(ended.history.some((turn) => turn.vote?.kind === 'censure')).toBe(true);
  expect(ended.history.at(-1).vote).toMatchObject({ kind: 'destitution', passed: true });
  await expect(page.locator('.living-result')).toBeVisible();
  await expect(page.locator('.living-result')).toContainText(/Destitution|Haute Cour/);
  await expect(page.locator('.narrative-outcome__election')).toHaveCount(0);
  await expect(page.locator('[data-action="choose"][data-choice]')).toHaveCount(0);
  await expect(page.locator('.living-result [data-action="open-replay-selection"]')).toBeVisible();
  await capture(page, info, 'v11-destitution-ending');
  await persistEvidence(page, info, 'v11-destitution-inputs', { censureRecorded: true, epilogueExpected: false });
});

test('one complete v11 mandate retains causal outcomes, exports, replays and reaches its fictional epilogue', async ({ page }, info) => {
  test.skip(!['chromium-desktop', 'chromium-mobile-390'].includes(info.project.name), 'The complete replay/export route runs at desktop and mobile sizes.');
  test.setTimeout(240_000);
  const start = fixture.journeys.fullTerm;
  await interceptClipboard(page);
  await openSeed(page, start.seed);
  await capture(page, info, 'v11-entry');

  const firstFronts = await page.locator('.story-agenda [data-story-id]').evaluateAll((items) => items.map((item) => item.dataset.storyId));
  const firstFrontTitle = await page.locator('.story-agenda [data-story-id]').first().locator('strong').innerText();
  expect(firstFronts).toHaveLength(3);
  await pickFront(page, 0);
  const firstDecision = await decide(page, 0, { dismiss: false });
  await expect(page.locator('[data-decision-verdict]')).toContainText(/Texte rejeté|Texte adopté|Gouvernement|Procédure/);
  await capture(page, info, 'v11-first-outcome');
  await persistEvidence(page, info, 'v11-first-decision', { selectedFront: firstFronts[0], selectedChoice: firstDecision.choiceId });
  await page.locator('[data-action="dismiss-verdict"]').click();
  await expect(page.locator('[data-decision-verdict]')).toBeHidden();

  // Share an actual decision card, not a reconstructed URL. Its fragment must
  // restore the exact replay focus before the shared choice is adopted.
  await openDecisionJournal(page);
  await page.locator('[data-action="share-decision"]').first().click();
  const decisionDialog = page.getByRole('dialog');
  await expect(decisionDialog).toContainText('Partager votre mandat');
  await decisionDialog.getByRole('button', { name: 'Copier le lien', exact: true }).click();
  const copiedDilemma = await page.evaluate(() => window.__mandatsCopiedText);
  const dilemmaUrl = new URL(copiedDilemma);
  expect(dilemmaUrl.hash).toMatch(/^#dilemma=/);
  const localDilemmaUrl = localizeSharedUrl(copiedDilemma, page.url());
  const sharedDilemma = decodeExport(decodeURIComponent(dilemmaUrl.hash.slice('#dilemma='.length)));
  expect(sharedDilemma.version).toBe(11);
  expect(sharedDilemma.choices).toEqual([]);
  expect(sharedDilemma.narrative.focus).toBe(firstFronts[0]);
  const existingSave = await rawSave(page);
  await decisionDialog.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Décider', exact: true }).click();
  await expect(agenda(page)).toBeVisible();

  const dilemmaContext = await page.context().browser().newContext({ viewport: info.project.use.viewport, baseURL: new URL(page.url()).origin });
  await dilemmaContext.addInitScript(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, existingSave]);
  const dilemmaRecipient = await dilemmaContext.newPage();
  await dilemmaRecipient.goto(localDilemmaUrl);
  await expect(dilemmaRecipient.locator('.story-flow__challenge-note')).toBeVisible();
  await expect(dilemmaRecipient.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  await expect(dilemmaRecipient.locator('.dossier h1')).toContainText(firstFrontTitle);
  expect(await rawSave(dilemmaRecipient)).toBe(existingSave);
  expect((await stored(dilemmaRecipient)).choices).toHaveLength(1);
  const dilemmaChoices = await frontChoices(dilemmaRecipient).evaluateAll((items) => items.map((item) => item.dataset.choice));
  const dilemmaAlternative = dilemmaChoices.find((id) => id !== firstDecision.choiceId);
  expect(dilemmaAlternative).toBeTruthy();
  const dilemmaChoice = dilemmaRecipient.locator(`[data-action="choose"][data-choice="${dilemmaAlternative}"]:not([disabled])`);
  await dilemmaChoice.click();
  await waitForDecisionSurface(dilemmaRecipient);
  const adoptedDilemma = decodeExport(await rawSave(dilemmaRecipient));
  expect(adoptedDilemma.version).toBe(11);
  expect(adoptedDilemma.seed).toBe(start.seed);
  expect(adoptedDilemma.choices).toHaveLength(1);
  expect(adoptedDilemma.choices.at(-1)).toBe(dilemmaAlternative);
  expect(await rawSave(dilemmaRecipient)).not.toBe(existingSave);
  await capture(dilemmaRecipient, info, 'v11-shared-dilemma-adopted');
  await persistEvidence(dilemmaRecipient, info, 'v11-shared-dilemma-inputs', { sharedFocus: sharedDilemma.narrative.focus });
  await dilemmaContext.close();
  await continueStory(page);

  const visitedFronts = new Set(firstFronts);
  let voteCount = firstDecision.after.politics?.votes?.length ?? 0;
  let rejectedLaw = firstDecision.after.politics?.votes?.filter((vote) => vote.kind === 'law' && !vote.passed).length ?? 0;
  let adoptedLaw = firstDecision.after.politics?.votes?.filter((vote) => vote.kind === 'law' && vote.passed).length ?? 0;
  for (let count = 1; count < start.decisions; count += 1) {
    const before = await stored(page);
    const fronts = await page.locator('.story-agenda [data-story-id]').evaluateAll((items) => items.map((item) => item.dataset.storyId));
    expect(fronts.length).toBeGreaterThanOrEqual(1);
    expect(fronts.length).toBeLessThanOrEqual(3);
    fronts.forEach((front) => visitedFronts.add(front));
    await pickFront(page, count % fronts.length);
    const { after } = await decide(page, 0);
    voteCount = after.politics?.votes?.length ?? voteCount;
    rejectedLaw = after.politics?.votes?.filter((vote) => vote.kind === 'law' && !vote.passed).length ?? rejectedLaw;
    adoptedLaw = after.politics?.votes?.filter((vote) => vote.kind === 'law' && vote.passed).length ?? adoptedLaw;
    expect(after.choices.slice(0, before.choices.length)).toEqual(before.choices);
    if (after.turn < start.decisions) await continueStory(page);
  }

  const end = await stored(page);
  expect(end.choices).toHaveLength(start.decisions);
  expect(end.turn).toBe(start.decisions);
  expect(visitedFronts.size).toBeGreaterThan(3);
  expect(voteCount).toBeGreaterThan(0);
  expect(adoptedLaw + rejectedLaw).toBeGreaterThan(0);
  expect(end.narrative.promises.some((promise) => promise.status === 'kept')).toBe(true);
  expect(end.narrative.promises.some((promise) => promise.status === 'broken')).toBe(true);
  expect(end.narrative.projects.some((project) => project.status === 'delivered')).toBe(true);
  expect(end.narrative.relationships.some((person) => Number.isFinite(person.loyalty) && person.loyalty !== 50 && Number.isInteger(person.lastTurn))).toBe(true);
  expect(end.narrative.events.some((event) => event.causeTurn >= 0 && event.causeTurn < end.turn)).toBe(true);
  await expect(page.locator('.narrative-outcome')).toBeVisible();
  await expect(page.locator('.narrative-outcome')).toContainText('ÉPILOGUE ÉLECTORAL SIMULÉ');
  await expect(page.locator('.narrative-outcome')).toContainText(/fictif|fictive/i);
  await capture(page, info, 'v11-final-epilogue');
  await persistEvidence(page, info, 'v11-complete-inputs', { visitedFronts: [...visitedFronts], voteCount, adoptedLaw, rejectedLaw });

  // A shared challenge remains an entry point until the recipient commits a decision.
  const originalRaw = await rawSave(page);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Partager cet héritage', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Défi', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Copier le lien', exact: true }).click();
  let challengeUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(challengeUrl).toMatch(/\/mandats\//);
  challengeUrl = localizeSharedUrl(challengeUrl, page.url());
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

  const recipientContext = await page.context().browser().newContext({ viewport: info.project.use.viewport });
  await recipientContext.addInitScript(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, originalRaw]);
  const recipient = await recipientContext.newPage();
  await recipient.goto(challengeUrl);
  await expect(recipient.locator('.story-agenda')).toBeVisible();
  await expect(recipient.locator('.story-flow__challenge-note')).toBeVisible();
  expect(await rawSave(recipient)).toBe(originalRaw);
  await recipient.locator('.story-agenda [data-action="story-select"]').first().click();
  await expect(recipient.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  expect(await rawSave(recipient)).toBe(originalRaw);
  await recipient.locator('[data-action="choose"][data-choice]:not([disabled])').first().click();
  await waitForDecisionSurface(recipient);
  await expect(recipient.locator('[data-decision-verdict]')).toBeVisible();
  await recipient.keyboard.press('Escape');
  await expect(recipient.locator('[data-decision-verdict]')).toBeHidden();
  await expect(recipient.locator('.story-agenda, .year-recap, .living-result')).toBeVisible();
  const adoptedChallenge = decodeExport(await rawSave(recipient));
  expect(adoptedChallenge).toMatchObject({ version: 11, seed: start.seed, turn: 1 });
  await capture(recipient, info, 'v11-challenge-adopted');
  await recipientContext.close();

  // The exported file contains only replay inputs. A fresh browser must rebuild all
  // derived numbers, votes, promises, projects, relationships and causal events.
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
  const download = await exportEvent;
  const exportPath = await download.path();
  const rawExport = await readFile(exportPath, 'utf8');
  const replayInputs = JSON.parse(rawExport);
  expect(replayInputs).toMatchObject({ version: 11, mode: 'national', seed: start.seed, choices: end.choices });
  const decodedExport = decodeExport(rawExport);
  expect(decodedExport).toMatchObject({
    version: end.version, seed: end.seed, turn: end.turn, choices: end.choices,
    finance: end.finance, metrics: end.metrics, politics: end.politics, narrative: end.narrative,
  });
  await copyFile(exportPath, info.outputPath('mandats-v11-export.json'));
  await info.attach('mandats-v11-export', { path: info.outputPath('mandats-v11-export.json'), contentType: 'application/json' });

  const context = await page.context().browser().newContext({ viewport: info.project.use.viewport, baseURL: new URL(page.url()).origin });
  const fresh = await context.newPage();
  await fresh.goto(HOME);
  await fresh.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await fresh.locator('#save-file').setInputFiles({ name: 'mandats-v11-export.json', mimeType: 'application/json', buffer: Buffer.from(rawExport) });
  await expect(fresh.locator('.narrative-outcome')).toBeVisible();
  const imported = await stored(fresh);
  expect(imported.choices).toEqual(end.choices);
  expect(imported.finance).toEqual(end.finance);
  expect(imported.metrics).toEqual(end.metrics);
  expect(imported.politics.votes).toEqual(end.politics.votes);
  expect(imported.narrative.promises).toEqual(end.narrative.promises);
  expect(imported.narrative.projects).toEqual(end.narrative.projects);
  expect(imported.narrative.events).toEqual(end.narrative.events);
  await capture(fresh, info, 'v11-imported-outcome');

  const turningPoint = fresh.locator('.narrative-outcome [data-action="branch-replay"][data-turn]').first();
  await expect(turningPoint).toBeVisible();
  const index = Number(await turningPoint.getAttribute('data-turn'));
  await turningPoint.click();
  const branch = await stored(fresh);
  expect(branch.choices).toHaveLength(index);
  expect(branch.narrative.focus).toBeTruthy();
  await expect(fresh.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  const branchState = await persistEvidence(fresh, info, 'v11-replay-branch', { causalTurn: index });
  expect(branchState.savedState.choices).toEqual(end.choices.slice(0, index));
  await context.close();
});

test('a shared decision restores exact focus and protects the local save until adoption', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  await interceptClipboard(page);
  const seed = fixture.journeys.protectedChallenge.seed;
  await openSeed(page, seed);
  await pickFront(page, 0);
  await decide(page, 0);
  await continueStory(page);
  const selected = await pickFront(page, 0);
  const senderDecision = await decide(page, 0);
  const senderSave = await rawSave(page);
  const senderState = decodeExport(senderSave);
  expect(senderState.choices).toHaveLength(2);

  await openDecisionJournal(page);
  await page.locator('[data-action="share-decision"]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Le lien restitue les décisions antérieures');
  await dialog.getByRole('button', { name: 'Copier le lien', exact: true }).click();
  const copied = await page.evaluate(() => window.__mandatsCopiedText);
  const shareUrl = new URL(copied);
  expect(shareUrl.hash).toMatch(/^#dilemma=/);
  const localShareUrl = localizeSharedUrl(copied, page.url());
  const replayPrefix = decodeExport(decodeURIComponent(shareUrl.hash.slice('#dilemma='.length)));
  expect(replayPrefix.choices).toEqual(senderState.choices.slice(0, -1));
  expect(replayPrefix.narrative.focus).toBe(selected.chosen);
  await dialog.getByRole('button', { name: 'Fermer' }).click();

  const recipientContext = await browser.newContext({ viewport: info.project.use.viewport, baseURL: new URL(page.url()).origin });
  await recipientContext.addInitScript(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, senderSave]);
  const recipient = await recipientContext.newPage();
  await recipient.goto(localShareUrl);
  await expect(recipient.locator('.story-flow__challenge-note')).toBeVisible();
  await expect(recipient.locator('.story-scene[data-stage="decision"]')).toBeVisible();
  await expect(recipient.locator('.dossier h1')).toContainText(selected.title);
  expect((await stored(recipient)).choices).toEqual(senderState.choices);
  expect(await rawSave(recipient)).toBe(senderSave);
  const candidates = await frontChoices(recipient).evaluateAll((items) => items.map((item) => item.dataset.choice));
  const alternative = candidates.find((id) => id !== senderDecision.choiceId);
  expect(alternative).toBeTruthy();
  await recipient.locator(`[data-action="choose"][data-choice="${alternative}"]:not([disabled])`).click();
  await waitForDecisionSurface(recipient);
  const adopted = decodeExport(await rawSave(recipient));
  expect(adopted.version).toBe(11);
  expect(adopted.seed).toBe(seed);
  expect(adopted.choices).toEqual([...replayPrefix.choices, alternative]);
  expect(adopted.turn).toBe(replayPrefix.turn + 1);
  await expect(recipient.locator('.story-agenda, .year-recap, .living-result')).toBeVisible();
  await capture(recipient, info, `v11-shared-decision-${info.project.name}`);
  await persistEvidence(recipient, info, `v11-shared-decision-${info.project.name}`, { focus: replayPrefix.narrative.focus, adoptedChoice: alternative });
  await recipientContext.close();
});

test('reduced motion and a rapid double click commit one decision', async ({ page }, info) => {
  test.skip(!['chromium-compact-320', 'chromium-mobile-390', 'chromium-desktop', 'webkit-mobile'].includes(info.project.name), 'The reduced-motion interaction is checked in each configured browser.');
  test.setTimeout(120_000);
  const seed = fixture.journeys.interaction.seed;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSeed(page, seed, { reducedMotion: true });
  await pickFront(page, 0);
  // Agenda control itself cannot move the turn; a rapid repeated decision is still one act.
  const { after } = await decide(page, 0, { doubleClick: true, dismiss: false });
  expect(after.choices).toHaveLength(1);
  const verdict = page.locator('[data-decision-verdict]');
  const motion = await verdict.evaluate((node) => getComputedStyle(node).animationDuration);
  expect(motion.split(',').every((duration) => Number.parseFloat(duration) === 0)).toBe(true);
  await expect(page.locator('.story-agenda, .year-recap, .living-result')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(verdict).toBeHidden();
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1);
  await capture(page, info, `v11-reduced-motion-${info.project.name}`);
  await persistEvidence(page, info, `v11-reduced-motion-${info.project.name}`);
});

test('reduced-motion 320, 390 and desktop layouts keep all decision controls inside the viewport', async ({ page }, info) => {
  test.skip(!['chromium-compact-320', 'chromium-mobile-390', 'chromium-desktop', 'webkit-mobile'].includes(info.project.name), 'Layout evidence is captured in every configured browser and viewport.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const seed = fixture.journeys.interaction.seed;
  await openSeed(page, seed, { reducedMotion: true });
  const agendaCards = page.locator('.story-agenda [data-action="story-select"]');
  await expect.poll(() => agendaCards.count()).toBeGreaterThanOrEqual(1);
  expect(await agendaCards.count()).toBeLessThanOrEqual(3);
  for (const control of await agendaCards.all()) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(info.project.use.viewport.width + 1);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await pickFront(page, 0);
  const introTitle = page.locator('.dossier h1');
  const introduction = page.locator('.dossier > .story');
  await expect(introTitle).not.toBeEmpty();
  await expect(introduction).toBeVisible();
  expect((await introduction.innerText()).trim().length).toBeGreaterThan(30);
  await expect(page.locator('.dossier')).not.toContainText(/scénario politique fictif|aucun crédit ni projet.*engagé/i);
  await expect(page.locator('.story-scene__lead, .story-scene__details, .mobile-decision-feedback')).toHaveCount(0);
  await capture(page, info, `v11-clear-decision-${info.project.name}`);
  await expect(frontChoices(page)).toHaveCount(3);
  const keyboardChoice = frontChoices(page).first();
  await keyboardChoice.focus();
  await expect(keyboardChoice).toBeFocused();
  await page.keyboard.press('Enter');
  await waitForDecisionSurface(page);
  await expect(page.locator('.story-agenda, .year-recap, .living-result')).toBeVisible();
  await capture(page, info, `v11-verdict-${info.project.name}`);
  const afterKeyboard = await stored(page);
  expect(afterKeyboard.turn).toBe(1);
  const verdict = page.locator('[data-decision-verdict]');
  await page.keyboard.press('Escape');
  await expect(verdict).toBeHidden();
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1);
  await capture(page, info, `v11-layout-${info.project.name}`);
  await persistEvidence(page, info, `v11-layout-${info.project.name}`);
});

test('the decision verdict auto-closes, advances immediately and never leaves stale feedback', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'Timed verdict transitions are checked once on desktop.');
  await openSeed(page, fixture.journeys.interaction.seed);
  await pickFront(page, 0);
  const intro = page.locator('.dossier > .story');
  await expect(intro).toBeVisible();
  expect((await intro.innerText()).trim().length).toBeGreaterThan(30);
  await expect(page.locator('.dossier')).not.toContainText(/scénario politique fictif|aucun crédit ni projet.*engagé/i);

  const before = await stored(page);
  const firstChoice = frontChoices(page).first();
  const firstId = await firstChoice.getAttribute('data-choice');
  await firstChoice.click();
  const committed = await stored(page);
  expect(committed.choices).toEqual([...before.choices, firstId]);
  const verdict = page.locator('[data-decision-verdict]');
  await expect(verdict).toBeVisible();
  await expect(page.locator('.story-agenda, .year-recap, .living-result')).toBeVisible();
  await expect(verdict).toBeHidden({ timeout: 3000 });
  await expect(page.locator('.story-result')).toHaveCount(0);
  await expect(agenda(page)).toBeVisible();

  const secondBefore = await stored(page);
  await pickFront(page, 0);
  const secondChoice = frontChoices(page).first();
  const secondId = await secondChoice.getAttribute('data-choice');
  await secondChoice.click();
  const secondAfter = await stored(page);
  expect(secondAfter.choices).toEqual([...secondBefore.choices, secondId]);
  await expect(verdict).toBeVisible();
  await expect(page.locator('.story-agenda')).toBeVisible();
  await expect(page.locator('.story-agenda')).not.toContainText('Le mandat avance entre plusieurs fronts');
  await expect(verdict).toContainText(/Texte adopté|Texte rejeté|Gouvernement|Procédure|Nouvelle répartition/);
  await page.locator('[data-action="dismiss-verdict"]').click();
  await expect(verdict).toBeHidden();
});
