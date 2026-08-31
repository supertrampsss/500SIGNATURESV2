import { expect, test } from "@playwright/test";

const phases = [
  { phase: "decision", content: "Faut-il unifier l'IR, la CSG", action: "select", count: 2 },
  { phase: "crisis", content: "Conseil de crise", action: "resolve-crisis", count: 2 },
  { phase: "verdict", content: "72 arbitrages rendus", action: "share-verdict", count: 1 },
];

for (const { phase, content, action: actionName, count } of phases) {
  test(`V10 ${phase} is the exact live phase at 390 by 844`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/simulateur?e2e-phase=${phase}`, { waitUntil: "domcontentloaded" });

    const simulator = page.locator("#simulateur-v3 .simulateur-v3");
    await expect(simulator).toBeVisible();
    await expect(simulator).not.toContainText("temporairement indisponible");
    await expect(simulator).toContainText(content);
    await expect(simulator.locator(`[data-v3-action="${actionName}"]`)).toHaveCount(count);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(simulator).not.toContainText("—");
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "hidden");

    const action = simulator.locator("button:not([disabled])").first();
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await expect(action).toBeFocused();
  });
}

test("V10 EPR2 remains a live two-option decision without political impact pills", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/simulateur?e2e-phase=decision&e2e-fixture=epr2", { waitUntil: "domcontentloaded" });

  const simulator = page.locator("#simulateur-v3 .simulateur-v3");
  await expect(simulator).toContainText("Quel avenir pour le nucléaire ?");
  await expect(simulator.locator('[data-v3-action="select"]')).toHaveCount(2);
  await expect(simulator).toContainText("Engager six EPR2");
  await expect(simulator).toContainText("Ne pas engager de nouvel EPR2");
  await expect(simulator.locator(".simulateur-v3__option-impact-pill")).toHaveCount(0);
});
