import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const KEY = "500signatures.mandats.v1";
const storageModule = new URL("../src/mandats/storage.ts", import.meta.url)
  .href;
function reconstruct(raw) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `import {decode} from ${JSON.stringify(storageModule)};let input='';for await(const chunk of process.stdin)input+=chunk;process.stdout.write(JSON.stringify(decode(input)));`,
      ],
      { input: raw, encoding: "utf8" },
    ),
  );
}
async function game(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  return reconstruct(
    raw ??
      JSON.stringify({
        version: 12,
        mode: "national",
        seed: Number(new URL(page.url()).searchParams.get("seed")),
        ambition: "equilibre",
        choices: [],
      }),
  );
}
async function open(page, seed = 0) {
  await page.goto(
    `/mandats/?mode=national&v=12&seed=${seed}&ambition=equilibre`,
  );
  await expect(page.locator("[data-mandate-map]")).toBeVisible();
}
async function select(page, id) {
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
  const state = await game(page);
  await expect(page.locator("#mandats")).toHaveAttribute(
    "data-turn",
    String(state.turn),
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-decision-verdict]")).toBeHidden();
  return state;
}
async function capture(page, info, label) {
  const path = info.outputPath(label + ".png");
  await page.screenshot({ path, fullPage: true });
  await info.attach(label, { path, contentType: "image/png" });
  const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  if (raw) {
    const evidence = info.outputPath(label + ".json");
    await writeFile(
      evidence,
      JSON.stringify(
        {
          viewport: info.project.use.viewport,
          inputs: JSON.parse(raw),
          state: reconstruct(raw),
        },
        null,
        2,
      ),
    );
    await info.attach(label + "-replay", {
      path: evidence,
      contentType: "application/json",
    });
  }
}

test("a high density display keeps the 3D map sharp through resize and saved resume", async ({
  browser,
}, info) => {
  const viewport = info.project.use.viewport ?? { width: 1440, height: 960 };
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport,
    deviceScaleFactor: 2,
    isMobile: Boolean(info.project.use.isMobile),
    hasTouch: Boolean(info.project.use.hasTouch),
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const canvas = page.locator("[data-map-canvas]");
    async function raster() {
      return canvas.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          width: element.width,
          height: element.height,
          cssWidth: bounds.width,
          cssHeight: bounds.height,
          devicePixelRatio: window.devicePixelRatio,
        };
      });
    }
    async function retain(label) {
      await capture(page, info, label);
      const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
      const path = info.outputPath(label + "-resolution.json");
      await writeFile(
        path,
        JSON.stringify(
          {
            url: page.url(),
            viewport: page.viewportSize(),
            raster: await raster(),
            inputs: raw
              ? JSON.parse(raw)
              : {
                  version: 12,
                  mode: "national",
                  seed: 0,
                  ambition: "equilibre",
                  choices: [],
                },
            state: await game(page),
          },
          null,
          2,
        ),
      );
      await info.attach(label + "-resolution", {
        path,
        contentType: "application/json",
      });
    }
    async function expectReadableRaster() {
      await expect
        .poll(async () => {
          const size = await raster();
          return (
            size.width >= size.cssWidth - 1 &&
            size.height >= size.cssHeight - 1
          );
        })
        .toBe(true);
    }

    await open(page);
    await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
      "data-renderer",
      "babylon",
    );
    expect((await raster()).devicePixelRatio).toBe(2);
    const initial = await game(page);
    await canvas.evaluate((element) => {
      element.dataset.instance = "high-density-persistent";
    });
    await retain("carte-dpr-2");
    await expectReadableRaster();

    await page.locator('[data-map-marker="education-lycees"]').click();
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    expect((await game(page)).turn).toBe(initial.turn);
    await page.locator('[data-action="map-close"]').click();
    const map = page.locator("[data-mandate-map]");
    let wheelRadius;
    if (!info.project.use.isMobile) {
      const overviewRadius = Number(await map.getAttribute("data-camera-radius"));
      const bounds = await canvas.boundingBox();
      await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .5);
      await page.mouse.wheel(0, -360);
      await expect.poll(async () => Number(await map.getAttribute("data-camera-radius")))
        .toBeLessThan(overviewRadius - .05);
      let previousRadius, stableChecks = 0;
      await expect.poll(async () => {
        const radius = await map.getAttribute("data-camera-radius");
        stableChecks = radius === previousRadius ? stableChecks + 1 : 0;
        previousRadius = radius;
        return stableChecks;
      }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
      wheelRadius = Number(await map.getAttribute("data-camera-radius"));
    }
    const previousResolution = await map.getAttribute("data-resolution");
    const resizedViewport = info.project.use.isMobile
      ? viewport.width <= 320
        ? { width: 390, height: 844 }
        : { width: 320, height: 740 }
      : { width: 1000, height: 800 };
    await page.setViewportSize(resizedViewport);
    await expect(map).not.toHaveAttribute("data-resolution", previousResolution);
    await expectReadableRaster();
    if (wheelRadius !== undefined)
      expect(Number(await map.getAttribute("data-camera-radius"))).toBeCloseTo(wheelRadius, 1);
    expect((await game(page)).turn).toBe(initial.turn);
    await expect(canvas).toHaveAttribute(
      "data-instance",
      "high-density-persistent",
    );
    await page.locator('[data-map-marker="education-lycees"]').click();
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    expect((await game(page)).turn).toBe(initial.turn);
    await retain("carte-redimensionnee-dpr-2");

    const saved = await choose(page, "regrouper");
    expect(saved.turn).toBe(initial.turn + 1);
    await page.reload();
    await page.getByRole("button", { name: "Reprendre", exact: true }).click();
    await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
      "data-renderer",
      "babylon",
    );
    await expectReadableRaster();
    expect((await game(page)).turn).toBe(saved.turn);
    expect((await game(page)).choices).toEqual(saved.choices);
    await page.locator("[data-map-marker]").first().click();
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    expect((await game(page)).turn).toBe(saved.turn);
    await retain("carte-reprise-dpr-2");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the real 3D map opens subjects without advancing the game and preserves its canvas", async ({
  page,
}, info) => {
  const errors = [];
  const models = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", response => {
    if (/\/mandats\/models\/[^?]+\.glb(?:\?|$)/.test(response.url()))
      models.push({ url: response.url(), status: response.status() });
  });
  await open(page);
  await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
    "data-renderer",
    "babylon",
  );
  await expect(page.locator("[data-map-canvas]")).toBeVisible();
  expect(models.length).toBeGreaterThanOrEqual(2);
  expect(models.every(model => model.status === 200)).toBe(true);
  await info.attach("modeles-3d-charges", {
    body: JSON.stringify(models, null, 2), contentType: "application/json",
  });
  await page
    .locator("[data-map-canvas]")
    .evaluate((canvas) => (canvas.dataset.instance = "persistent"));
  await select(page, "education-lycees");
  expect((await game(page)).turn).toBe(0);
  await page.locator('[data-action="map-close"]').click();
  expect((await game(page)).turn).toBe(0);
  await select(page, "education-lycees");
  await expect(page.locator("[data-map-canvas]")).toHaveAttribute(
    "data-instance",
    "persistent",
  );
  expect(await page.locator("[data-map-decision] .choice").count()).toBe(3);
  await expect
    .poll(() =>
      page.locator("[data-map-marker]").evaluateAll((markers) => {
        const bounds = markers.map((marker) => marker.getBoundingClientRect());
        return bounds.reduce(
          (count, rectangle, index) =>
            count +
            bounds
              .slice(index + 1)
              .filter(
                (other) =>
                  Math.min(rectangle.right, other.right) -
                    Math.max(rectangle.left, other.left) >
                    1 &&
                  Math.min(rectangle.bottom, other.bottom) -
                    Math.max(rectangle.top, other.top) >
                    1,
              ).length,
          0,
        );
      }),
    )
    .toBe(0);
  expect(
    await page.locator("[data-mandate-map]").evaluate((map) => {
      const bounds = map.getBoundingClientRect();
      return [...map.querySelectorAll("[data-map-marker]")].every((marker) => {
        const rectangle = marker.getBoundingClientRect();
        return (
          rectangle.left >= bounds.left - 1 &&
          rectangle.right <= bounds.right + 1 &&
          rectangle.top >= bounds.top - 1 &&
          rectangle.bottom <= bounds.bottom + 1
        );
      });
    }),
  ).toBe(true);
  expect(
    /[—–←→↗↘›‹]/u.test(await page.locator("[data-map-decision]").innerText()),
  ).toBe(false);
  await capture(page, info, "carte-et-sujet");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator('[data-action="map-inspect"]').click();
  await expect(page.locator('[data-mandate-map]')).toHaveAttribute('data-inspection', 'lyon');
  if (info.project.use.isMobile) {
    const bounds = await page.locator('[data-map-canvas]').boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  }
  await page.locator('[data-action="map-close"]').click();
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active?.matches('[data-map-marker]:not([hidden]), [data-map-agenda] button, [data-map-agenda] h1') &&
      active.getBoundingClientRect().width > 0);
  })).toBe(true);
  expect((await game(page)).turn).toBe(0);
  await expect(page.locator('[data-map-canvas]')).toHaveAttribute('data-instance', 'persistent');
  const rawBeforeMenu = await page.evaluate(key => localStorage.getItem(key), KEY);
  const tools = page.locator('.map-game__header [data-action="tools"]');
  await tools.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Votre partie', exact: true })).toBeVisible();
  await capture(page, info, 'menu-ma-partie');
  await page.getByRole('dialog').locator('[data-action="light-mode"]').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(tools).toBeFocused();
  await expect(page.locator('[data-mandate-map]')).toHaveAttribute('data-motion', 'reduced');
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(rawBeforeMenu);
  await expect(page.locator('[data-map-canvas]')).toHaveAttribute('data-instance', 'persistent');
});

test("school choices cause a movement which remains pending until its funded delivery", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await select(page, "education-lycees");
  let state = await choose(page, "regrouper");
  expect(state.history.at(-1).vote.passed).toBe(true);
  const id = state.social.movements[0].id;
  expect(state.social.movements[0].status).toBe("active");
  await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
    "data-movements",
    "1",
  );
  await capture(page, info, "mobilisation-active");
  await select(page, id);
  const before = state.metrics.services;
  state = await choose(page, "financer");
  expect(state.social.movements[0].commitment.status).toBe("pending");
  expect(state.metrics.services).toBe(before);
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  expect((await game(page)).social).toEqual(state.social);
  for (let count = 0; count < 2; count++) {
    if (await page.locator('[data-action="next-year"]').count())
      await page.locator('[data-action="next-year"]').click();
    await page.locator('[data-action="story-select"]').first().click();
    const button = page
      .locator('[data-action="choose"]:not([disabled])')
      .first();
    const suffix = (await button.getAttribute("data-choice")).split("-").at(-1);
    state = await choose(page, suffix);
  }
  const movement = state.social.movements.find((item) => item.id === id);
  expect(movement.commitment.status).toBe("kept");
  expect(movement.status).toBe("resolved");
  await capture(page, info, "mobilisation-et-livraison");
});

test("a complete mandate survives save reload and offers replay from its actual decisions", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 0);
  const map = page.locator("[data-mandate-map]");
  await expect(map).toHaveAttribute("data-renderer", "babylon");
  for (let turn = 0; turn < 30; turn++) {
    if (await page.locator('[data-action="next-year"]').count())
      await page.locator('[data-action="next-year"]').click();
    // Play a complete campaign from the visible agenda. This keeps phone
    // reading in the decision flow instead of scrolling back to the map
    // before every choice; map interactions have their own native journeys.
    await page.locator('[data-map-agenda] [data-action="story-select"]').first().click();
    const choice = page
      .locator('[data-action="choose"]:not([disabled])')
      .first();
    const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await choice.click();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), KEY))
      .not.toBe(before);
    await expect(page.locator("#mandats")).toHaveAttribute(
      "data-turn",
      String(turn + 1),
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-decision-verdict]")).toBeHidden();
    const advanced = await game(page);
    // Several projects may accumulate in the same city. Every saved project
    // still needs real geometry after funding, delivery and later decisions.
    await expect(map).toHaveAttribute("data-rendered-projects",
      String(advanced.narrative.projects.length));
    await expect(map).toHaveAttribute("data-unplaced-projects", "0");
    if (advanced.politics.ending?.kind !== "term_complete" && advanced.politics.ending)
      break;
  }
  const state = await game(page);
  expect(state.turn).toBe(30);
  expect(state.politics.ending.kind).toBe("term_complete");
  await capture(page, info, "fin-du-mandat");
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  expect((await game(page)).choices).toEqual(state.choices);
  await page.locator('[data-action="open-replay-selection"]').click();
  if (info.project.name === 'desktop') {
    const rawBeforeNavigation = await page.evaluate(key => localStorage.getItem(key), KEY);
    await page.getByRole('button', { name: 'Bilan', exact: true }).click();
    await expect(page.locator('[data-map-review]')).toBeVisible();
    await page.getByRole('button', { name: 'Pays', exact: true }).click();
    await expect(page.locator('[data-map-result]')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(rawBeforeNavigation);
    await page.locator('[data-action="open-replay-selection"]').click();
  }
  const replay = page.locator('[data-action="branch-replay"]').first(),
    index = Number(await replay.getAttribute("data-turn"));
  await replay.click();
  await expect(page.locator("[data-map-decision]")).toBeVisible();
  expect((await game(page)).choices).toEqual(state.choices.slice(0, index));
  const alternative = page
    .locator(
      `[data-action="choose"]:not([disabled]):not([data-choice="${state.choices[index]}"])`,
    )
    .last();
  await choose(page, await alternative.getAttribute("data-choice"));
  await capture(page, info, "autre-trajectoire");
  await page.getByRole("button", { name: "État du pays", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Retrouver mon mandat d’origine",
      exact: true,
    })
    .click();
  expect((await game(page)).choices).toEqual(state.choices);
});

test("the fallback map and keyboard controls remain usable without WebGL", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return original.call(this, type, ...args);
    };
  });
  await open(page);
  await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect(page.locator("[data-map-fallback]")).toBeVisible();
  const subject = page
    .locator('[data-action="story-select"][data-story-id="education-lycees"]')
    .first();
  await subject.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-map-decision]")).toBeVisible();
  await choose(page, "regrouper");
  await capture(page, info, "carte-sans-webgl");
});

test("authored models load after a real decision and a failed kit preserves the saved mandate", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "One actual delayed and failed asset lifecycle.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let intercepted = 0;
  const delay = async route => {
    intercepted++;
    await held;
    await route.continue();
  };
  await page.route("**/mandats/models/*.glb*", delay);
  try {
    await open(page);
    await expect.poll(() => intercepted).toBeGreaterThan(0);
    const map = page.locator("[data-mandate-map]");
    await expect(map).toHaveAttribute("data-renderer", "loading");
    await page.locator("[data-map-canvas]").evaluate(canvas => { canvas.dataset.instance = "loading-persistent"; });
    await select(page, "education-lycees");
    const before = await choose(page, "regrouper");
    expect(before.turn).toBe(1);
    expect(before.social.movements[0].status).toBe("active");
    release();
    await expect(map).toHaveAttribute("data-renderer", "babylon");
    await expect(map).toHaveAttribute("data-movements", "1");
    await expect(page.locator("[data-map-canvas]")).toHaveAttribute("data-instance", "loading-persistent");
    expect((await game(page)).choices).toEqual(before.choices);
    await capture(page, info, "modeles-apres-decision");
    await page.unroute("**/mandats/models/*.glb*", delay);
    const fail = route => route.fulfill({ status: 503, body: "Model unavailable" });
    await page.route("**/mandats/models/*.glb*", fail);
    await page.reload();
    await page.getByRole("button", { name: "Reprendre", exact: true }).click();
    await expect(page.locator("[data-mandate-map]")).toHaveAttribute("data-renderer", "fallback");
    expect((await game(page)).choices).toEqual(before.choices);
    await select(page, before.social.movements[0].id);
    const after = await choose(page, "financer");
    expect(after.social.movements[0].commitment.status).toBe("pending");
    await capture(page, info, "modele-indisponible-repli");
    await page.unroute("**/mandats/models/*.glb*", fail);
    await page.reload();
    await page.getByRole("button", { name: "Reprendre", exact: true }).click();
    await expect(page.locator("[data-mandate-map]")).toHaveAttribute("data-renderer", "babylon");
    expect((await game(page)).social).toEqual(after.social);
    expect((await game(page)).choices).toEqual(after.choices);
    await capture(page, info, "modeles-et-engagement-repris");
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test("prepared 3D play reloads its shaders and continues a real movement offline", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "mobile",
    "One real service-worker lifecycle; other widths cover the same game.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await select(page, "education-lycees");
  const before = await choose(page, "regrouper"),
    id = before.social.movements[0].id;
  await page.getByRole("button", { name: "Ma partie", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Préparer le jeu hors connexion",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "prêt hors connexion",
    { timeout: 45000 },
  );
  const cachedModels = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith("mandats-offline-"));
    return Promise.all(keys.map(async key => (await (await caches.open(key)).keys())
      .map(request => new URL(request.url).pathname)
      .filter(path => /^\/mandats\/models\/.*\.glb(?:\?|$)/.test(path))));
  });
  expect(cachedModels.some(paths => paths.length >= 2)).toBe(true);
  await info.attach("modeles-3d-hors-connexion", {
    body: JSON.stringify(cachedModels, null, 2), contentType: "application/json",
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
    "data-renderer",
    "babylon",
  );
  expect((await game(page)).social).toEqual(before.social);
  await select(page, id);
  const after = await choose(page, "financer");
  expect(after.social.movements[0].commitment.status).toBe("pending");
  await capture(page, info, "hors-connexion-3d");
  await context.setOffline(false);
});

test("a lost graphics context keeps the map subjects and decisions usable", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "One actual context-loss lifecycle.",
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 1);
  const map = page.locator("[data-mandate-map]");
  const canvas = page.locator("[data-map-canvas]");
  await expect(map).toHaveAttribute(
    "data-renderer",
    "babylon",
  );
  const initial = await game(page);
  expect(initial.narrative.projects).toEqual([]);
  await canvas.evaluate((element) => {
    element.dataset.instance = "lost-context-persistent";
  });
  const lost = await canvas.evaluate((element) => {
    const gl = element.getContext("webgl2") ?? element.getContext("webgl"),
      extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(lost).toBe(true);
  await expect(map).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const gl = element.getContext("webgl2") ?? element.getContext("webgl");
        return gl?.isContextLost();
      }),
    )
    .toBe(true);

  try {
    await select(page, "soins-garde-nuit");
    expect((await game(page)).turn).toBe(initial.turn);
    const funded = await choose(page, "renover-service");
    expect(funded.turn).toBe(initial.turn + 1);
    expect(funded.choices).toEqual([
      "n11-0-soins-garde-nuit-renover-service",
    ]);
    expect(funded.politics.lastVote.passed).toBe(true);
    expect(funded.narrative.projects).toEqual([
      expect.objectContaining({
        id: "service-rives",
        status: "funded",
        sourceChoice: funded.choices[0],
        causeTurn: initial.turn,
      }),
    ]);
    await expect(map).toHaveAttribute("data-renderer", "fallback");
    await expect(canvas).toHaveAttribute(
      "data-instance",
      "lost-context-persistent",
    );
    await capture(page, info, "contexte-perdu-projet-finance");
    expect(errors).toEqual([]);

    await page.locator('[data-map-marker="education-lycees"]').click();
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    const saved = await game(page);
    expect(saved.turn).toBe(funded.turn);
    expect(saved.choices).toEqual(funded.choices);
    expect(saved.narrative.projects).toEqual(funded.narrative.projects);
    await page.reload();
    await page.getByRole("button", { name: "Reprendre", exact: true }).click();
    await expect(map).toHaveAttribute("data-renderer", "babylon");
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    const resumed = await game(page);
    expect(resumed.turn).toBe(saved.turn);
    expect(resumed.choices).toEqual(saved.choices);
    expect(resumed.narrative.projects).toEqual(saved.narrative.projects);
    expect(resumed.politics.lastVote).toEqual(saved.politics.lastVote);
    expect(resumed.narrative.focus).toBe(saved.narrative.focus);
    await capture(page, info, "reprise-apres-contexte-perdu");
    expect(errors).toEqual([]);

    // Consulting the new desktop navigation must preserve the actual saved
    // vote/project, the open subject and the mounted 3D canvas.
    const rawBeforePanels = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await canvas.evaluate((element) => { element.dataset.instance = "panels-persistent"; });
    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: "Gouvernement", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Gouvernement", exact: true })).toBeVisible();
    for (const bloc of resumed.politics.blocs) {
      const row = dialog.getByRole("listitem").filter({ hasText: bloc.label });
      await expect(row).toHaveCount(1);
      await expect(row).toBeVisible();
      await expect(row.locator("strong")).toHaveText(new RegExp(`^${bloc.seats}\\s*sièges$`));
      await expect(row.getByText(bloc.inGovernment ? "Soutien au gouvernement" : "Opposition", { exact: true })).toBeVisible();
    }
    await expect(dialog.getByText(resumed.politics.lastVote.title, { exact: true })).toBeVisible();
    await capture(page, info, "gouvernement-apres-vote-reel");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Projets", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Projets", exact: true })).toBeVisible();
    await expect(dialog.getByText(resumed.narrative.projects[0].label, { exact: true })).toBeVisible();
    await expect(dialog.getByText("En préparation", { exact: true })).toBeVisible();
    await capture(page, info, "projet-reel-dans-navigation");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Bilan", exact: true }).click();
    await expect(page.locator("[data-map-review]")).toBeVisible();
    await page.getByRole("button", { name: "Pays", exact: true }).click();
    await expect(page.locator("[data-map-decision]")).toBeVisible();
    await expect(canvas).toHaveAttribute("data-instance", "panels-persistent");
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(rawBeforePanels);
    expect(await game(page)).toEqual(resumed);
    expect(errors).toEqual([]);
  } finally {
    const path = info.outputPath("contexte-perdu-pageerrors.json");
    await writeFile(path, JSON.stringify(errors, null, 2));
    await info.attach("contexte-perdu-pageerrors", {
      path,
      contentType: "application/json",
    });
  }
});
