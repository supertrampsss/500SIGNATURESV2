import { expect, test } from "@playwright/test";

async function expectSceneActions(simulator, actionName, count) {
  const actions = simulator.locator(`[data-v3-action="${actionName}"]`);
  await expect(actions).toHaveCount(count);
  for (let index = 0; index < count; index += 1) {
    const action = actions.nth(index);
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await expect(action).toBeFocused();
  }
}

const phases = [
  { phase: "decision", title: "Faut-il unifier l'IR, la CSG", content: "Faut-il unifier l'IR, la CSG", action: "select", count: 2 },
  { phase: "crisis", title: "La réforme fiscale cristallise", content: "Conseil de crise", action: "resolve-crisis", count: 2 },
  { phase: "verdict", title: "Le déficit résiste", content: "72 arbitrages rendus", action: "share-verdict", count: 1 },
];

for (const { phase, title, content, action: actionName, count } of phases) {
  test(`V10 ${phase} is the exact live phase at 390 by 844`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/simulateur?e2e-phase=${phase}`, { waitUntil: "domcontentloaded" });

    const simulator = page.locator("#simulateur-v3 .simulateur-v3");
    await expect(simulator).toBeVisible();
    await expect(simulator).not.toContainText("temporairement indisponible");
    await expect(simulator).toContainText(content);
    const sceneTitle = simulator.locator("h1").first();
    await expect(sceneTitle).toContainText(title);
    await expect(sceneTitle).toBeInViewport();
    await expectSceneActions(simulator, actionName, count);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(simulator).not.toContainText("—");
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "hidden");

  });
}

test("V10 EPR2 remains a live two-option decision without political impact pills", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/simulateur?e2e-phase=decision&e2e-fixture=epr2", { waitUntil: "domcontentloaded" });

  const simulator = page.locator("#simulateur-v3 .simulateur-v3");
  const title = simulator.locator("h1").first();
  await expect(title).toContainText("Quel avenir pour le nucléaire ?");
  await expect(title).toBeInViewport();
  await expect(simulator).toContainText("Quel avenir pour le nucléaire ?");
  await expectSceneActions(simulator, "select", 2);
  await expect(simulator).toContainText("Engager six EPR2");
  await expect(simulator).toContainText("Ne pas engager de nouvel EPR2");
  await expect(simulator.locator(".simulateur-v3__option-impact-pill")).toHaveCount(0);
});

for (const viewport of [
  { width: 768, height: 1024, label: "tablet" },
  { width: 1280, height: 900, label: "desktop" },
]) {
  test(`V10 EPR2 keeps the compact layout on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/simulateur?e2e-phase=decision&e2e-fixture=epr2", { waitUntil: "domcontentloaded" });

    const simulator = page.locator("#simulateur-v3 .simulateur-v3");
    await expectSceneActions(simulator, "select", 2);
    await expect(simulator.locator("h1").first()).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test("the site header hands off to the mandate bar only after starting", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/simulateur?version=3", { waitUntil: "domcontentloaded" });

  const simulator = page.locator("#simulateur-v3 .simulateur-v3");
  const siteHeader = page.locator(".entete");
  await expect(simulator).toBeVisible();
  await expect(simulator).not.toContainText("temporairement indisponible");
  await expect(siteHeader).toBeVisible();
  await expect(simulator.locator(".simulateur-v3__command-bar")).toHaveCount(0);

  await simulator.locator('[data-v3-action="start"]').click();
  await expect(siteHeader).toBeHidden();
  await expect(simulator.locator(".simulateur-v3__command-bar")).toBeVisible();
});

test("a V10 decision click skips hidden transition screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/simulateur?e2e-phase=decision", { waitUntil: "domcontentloaded" });

  const simulator = page.locator("#simulateur-v3 .simulateur-v3");
  await simulator.locator('[data-v3-action="select"]').first().click();
  await expect.poll(async () => {
    const text = await simulator.textContent();
    const forbidden = /Décision enregistrée|Les effets annoncés|Le pays réagit|Dossier suivant|Assumer la suite|Continuer/;
    if (forbidden.test(text ?? "")) return false;
    return (await simulator.locator('[data-v3-action="select"], [data-v3-action="resolve-crisis"], [data-v3-action="share-verdict"], [data-v3-action="open-chapter"]').count()) > 0;
  }).toBe(true);
  await expect(simulator.locator("h1").first()).toBeFocused();
});
