import { expect, test } from "@playwright/test";

const phases = ["decision", "decision_result", "council", "crisis", "verdict"];

for (const phase of phases) {
  test(`V10 ${phase} remains usable at 390 by 844`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/simulateur?e2e-phase=${phase}`, { waitUntil: "domcontentloaded" });

    const simulator = page.locator("#simulateur-v3 .simulateur-v3");
    await expect(simulator).toBeVisible();
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
