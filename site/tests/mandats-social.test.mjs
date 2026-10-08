import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const KEY = "500signatures.mandats.v1";
const SEED = 0;

test("workers, pensioners, staff and households get distinct funded responses from real contested decisions", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "The four causal import journeys run once; other projects cover mobile mobilisation and delivery.",
  );
  const inputs = JSON.parse(
    await readFile(
      new URL("./fixtures/mandats-mobilisations-v12.json", import.meta.url),
      "utf8",
    ),
  );
  const expectations = {
    salaries: [
      "Financer les reconversions locales",
      "Partager le temps de travail",
      "workers",
    ],
    retraites: [
      "Rétablir l’indexation des pensions",
      "Relever les petites pensions",
      "pensioners",
    ],
    agents: [
      "Recruter dans les services concernés",
      "Réaffecter les équipes disponibles",
      "publicStaff",
    ],
    menages: [
      "Financer un tarif de première nécessité",
      "Cibler l’aide sur le logement",
      "vulnerable",
    ],
  };
  const labels = new Set();
  for (const [actor, input] of Object.entries(inputs)) {
    await open(page, input.seed);
    const file = info.outputPath(`${actor}-inputs.json`);
    await writeFile(file, JSON.stringify(input));
    await page.getByRole("button", { name: "Ma partie", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    const buttons = page.locator('[data-action="choose"]');
    const titles = await buttons.locator("strong").allTextContents();
    expect(titles.slice(0, 2)).toEqual(expectations[actor].slice(0, 2));
    expect(new Set(titles).size).toBe(3);
    titles.slice(0, 2).forEach((title) => labels.add(title));
    const before = await stored(page);
    expect(
      before.social.movements.find((item) => item.actor === actor).sourceChoice,
    ).toBe(input.choices.at(-1));
    await evidence(page, info, `${actor}-reponses`);
    const after = await choose(page, "financer");
    expect(after.history.at(-1).vote.passed).toBe(true);
    const movement = after.social.movements.find(
      (item) => item.actor === actor,
    );
    expect(movement.commitment.status).toBe("pending");
    expect(
      movement.commitment.deliveryEffect.society[expectations[actor][2]],
    ).toBeGreaterThan(0);
    if (actor !== "agents") {
      expect(
        movement.commitment.deliveryEffect.society.publicStaff,
      ).toBeUndefined();
      expect(movement.commitment.deliveryEffect.services ?? 0).toBe(0);
    }
    await evidence(page, info, `${actor}-financement`);
  }
  expect(labels.size).toBe(8);
});

async function stored(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  if (!raw)
    throw new Error("Le parcours doit avoir créé une sauvegarde réelle.");
  const module = new URL("../src/mandats/storage.ts", import.meta.url).href;
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `import {decode} from ${JSON.stringify(module)}; let input=''; for await (const chunk of process.stdin) input+=chunk; process.stdout.write(JSON.stringify(decode(input)));`,
      ],
      { input: raw, encoding: "utf8" },
    ),
  );
}

async function open(page, seed = SEED, version = 12) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    `/mandats/?mode=national&v=${version}&seed=${seed}&ambition=equilibre`,
  );
  await expect(
    page.locator(version >= 12 ? "[data-map-agenda]" : ".story-agenda"),
  ).toBeVisible();
}

async function front(page, id) {
  await page
    .locator(`[data-action="story-select"][data-story-id="${id}"]`)
    .first()
    .click();
  await expect(page.locator("[data-map-decision]")).toBeVisible();
}

async function choose(page, id) {
  const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page
    .locator(
      `[data-action="choose"][data-choice="${id}"]:not([disabled]),[data-action="choose"][data-choice$="-${id}"]:not([disabled])`,
    )
    .click();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), KEY))
    .not.toBe(before);
  const game = await stored(page);
  await expect(page.locator("#mandats")).toHaveAttribute(
    "data-turn",
    String(game.turn),
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-decision-verdict]")).toBeHidden();
  return game;
}

async function evidence(page, info, label) {
  const game = await stored(page);
  const screenshot = info.outputPath(`${label}.png`);
  await page.screenshot({
    path: screenshot,
    fullPage: true,
    animations: "disabled",
  });
  await info.attach(label, { path: screenshot, contentType: "image/png" });
  const path = info.outputPath(`${label}.json`);
  await writeFile(
    path,
    JSON.stringify(
      {
        seed: game.seed,
        version: game.version,
        choices: game.choices,
        viewport: info.project.use.viewport,
        browser: info.project.name,
        state: game.social,
        finance: game.finance,
        ledgers: game.history.map((turn) => turn.ledger),
        votes: game.politics.votes,
      },
      null,
      2,
    ),
  );
  await info.attach(`${label}-replay`, {
    path,
    contentType: "application/json",
  });
  return game;
}

test("an adopted school regrouping creates a visible student movement and survives reload and forged imports", async ({
  page,
}, info) => {
  await open(page);
  await front(page, "education-lycees");
  const game = await choose(page, "regrouper");
  expect(game.history.at(-1).vote.passed).toBe(true);
  const movement = game.social.movements.find(
    (item) => item.actor === "lyceens",
  );
  expect(movement).toMatchObject({
    causeTurn: 0,
    sourceChoice: game.choices[0],
    status: "active",
  });
  await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
    "data-movements",
    "1",
  );
  await front(page, movement.id);
  await page.getByRole("button", { name: "Voir le lieu", exact: true }).click();
  await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
    "data-inspection",
    "lyon",
  );
  await evidence(page, info, "lyceens-apres-regroupement");
  const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  expect((await stored(page)).social).toEqual(game.social);
  const forged = {
    ...JSON.parse(raw),
    social: { movements: [{ ...movement, status: "resolved", pressure: 0 }] },
    finance: { debt: 0 },
  };
  const file = info.outputPath("import-falsifie.json");
  await writeFile(file, JSON.stringify(forged));
  await page
    .getByRole("button", { name: "Ma partie", exact: true })
    .first()
    .click();
  await page.locator('input[type="file"]').setInputFiles(file);
  expect((await stored(page)).social).toEqual(game.social);
  expect((await stored(page)).finance).toEqual(game.finance);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});

test("student mobilisation escalates when other fronts are decided and a funded concession resolves only after delivery", async ({
  page,
}, info) => {
  await open(page);
  await front(page, "education-lycees");
  let game = await choose(page, "regrouper");
  const cause = game.choices[0];
  const initialPressure = game.social.movements[0].pressure;
  for (let count = 0; count < 3; count++) {
    const policy = page.locator(
      '[data-action="story-select"][data-story-id^="policy:"]',
    );
    if (await policy.count()) {
      await policy.first().click();
      await page
        .locator('[data-action="choose"]:not([disabled])')
        .last()
        .click();
    } else {
      await page.locator('[data-action="story-select"]').first().click();
      await page
        .locator('[data-action="choose"]:not([disabled])')
        .first()
        .click();
    }
    await expect(page.locator("#mandats")).toHaveAttribute(
      "data-turn",
      String((await stored(page)).turn),
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-decision-verdict]")).toBeHidden();
    if (await page.locator('[data-action="next-year"]').count())
      await page.locator('[data-action="next-year"]').click();
    game = await stored(page);
  }
  const active = game.social.movements.find((item) => item.actor === "lyceens");
  expect(active.sourceChoice).toBe(cause);
  expect(active.pressure).toBeGreaterThan(initialPressure);
  expect(active.stage).toBe("strike");
  expect(game.history.at(-1).ledger.operating).toBeGreaterThan(
    game.finance.operating,
  );
  await evidence(page, info, "lyceens-blocages");
  await front(page, active.id);
  game = await choose(page, "financer");
  expect(game.history.at(-1).vote.passed).toBe(true);
  expect(
    game.social.movements.find((item) => item.id === active.id),
  ).toMatchObject({ status: "active", stage: "negotiating" });
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  for (let count = 0; count < 2; count++) {
    await page.locator('[data-action="story-select"]').first().click();
    const button = page
      .locator('[data-action="choose"]:not([disabled])')
      .first();
    game = await choose(page, await button.getAttribute("data-choice"));
    if (await page.locator('[data-action="next-year"]').count())
      await page.locator('[data-action="next-year"]').click();
  }
  expect(
    game.social.movements.find((item) => item.id === active.id).status,
  ).toBe("resolved");
  const funding = game.social.movements.find(
    (item) => item.id === active.id,
  ).commitment;
  expect(funding.status).toBe("kept");
  expect(game.choices.filter((id) => id.endsWith("-financer"))).toHaveLength(1);
  await evidence(page, info, "lyceens-engagement-tenu");
  await page.getByRole("button", { name: "État du pays", exact: true }).click();
  await page.getByText("Le journal de vos décisions", { exact: true }).click();
  await expect(page.locator("[data-social-history]")).toContainText("Classes");
  await expect(page.locator("[data-social-history]")).toContainText(
    "Décision 1",
  );
});

test("a pilot keeps its deadline while inspected and a rejected bill applies no regrouping", async ({
  page,
}, info) => {
  await open(page);
  await front(page, "education-lycees");
  let game = await choose(page, "regrouper");
  const id = game.social.movements[0].id;
  await front(page, id);
  game = await choose(page, "tester");
  const deadline = game.social.movements[0].commitment.dueTurn;
  const before = game.turn;
  await page
    .locator(`[data-action="map-track"][data-track-id="${id}"]`)
    .click();
  await expect(page.getByRole("dialog")).toContainText("préparation");
  expect((await stored(page)).turn).toBe(before);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  for (let count = 0; count < 2; count++) {
    await page.locator('[data-action="story-select"]').first().click();
    const choice = await page
      .locator('[data-action="choose"]:not([disabled])')
      .first()
      .getAttribute("data-choice");
    game = await choose(page, choice);
  }
  expect(game.social.movements[0].commitment.dueTurn).toBe(deadline);
  expect(game.social.movements[0].commitment.status).toBe("pending");
  await evidence(page, info, "experimentations-en-preparation");
  // The rejected ballot is genuinely calculated from this seeded scenario.
  await open(page, 1);
  await front(page, "education-lycees");
  const rejected = await choose(page, "regrouper");
  expect(rejected.history.at(-1).vote.passed).toBe(false);
  expect(rejected.social.movements).toHaveLength(0);
  const module = new URL("../src/mandats/engine.ts", import.meta.url).href;
  const baseline = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `import {start} from ${JSON.stringify(module)};process.stdout.write(JSON.stringify(start('national',1,'equilibre',12)));`,
      ],
      { encoding: "utf8" },
    ),
  );
  expect(rejected.finance.operating).toBe(baseline.finance.operating);
  // Routine infrastructure ageing is independent of whether this bill passes.
  expect(rejected.metrics.services).toBe(baseline.metrics.services - 1);
  expect(rejected.society.publicStaff).toBe(baseline.society.publicStaff);
  await evidence(page, info, "regroupement-rejete");
});
