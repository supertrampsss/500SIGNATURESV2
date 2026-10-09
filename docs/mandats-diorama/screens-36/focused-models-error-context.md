# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mandats-rework.test.mjs >> authored models load after a real decision and a failed kit preserves the saved mandate
- Location: tests/mandats-rework.test.mjs:496:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('[data-mandate-map]')
Expected: "babylon"
Received: "loading"
Timeout:  15000ms

Call log:
  - Expect "toHaveAttribute" with timeout 15000ms
  - waiting for locator('[data-mandate-map]')
    5 × locator resolved to <section data-turn="1" aria-busy="true" data-projects="0" data-movements="1" class="mandate-map" data-mandate-map="" data-motion="reduced" data-renderer="loading" data-resolution="1090x820" data-contact-shadows="true" data-edge-antialiasing="fxaa" aria-label="Carte de France et sujets du mandat">…</section>
      - unexpected value "loading"
    - locator resolved to <section data-turn="1" aria-busy="true" data-projects="0" data-movements="1" class="mandate-map" data-mandate-map="" data-motion="reduced" data-renderer="loading" data-landscape="diorama" data-static-batches="48" data-mountain-rocks="305" data-resolution="1090x820" data-authored-houses="781" data-rendered-projects="0" data-unplaced-projects="0" data-contact-shadows="true" data-edge-antialiasing="fxaa" data-static-instances="17867" aria-label="Carte de France et sujets du mandat">…</section>
    - unexpected value "loading"

```

```yaml
- region "Carte de France et sujets du mandat":
  - 'img "Carte de France : les sujets restent accessibles même sans rendu 3D"'
  - button "Faut-il réduire les pensions pour diminuer le déficit ? · portée nationale": France
  - button "Les lycéens se mobilisent · Lyon": Lyon
  - button "Le bus promis n’a pas de conducteur · Lille": Lille
  - button "Agrandir la carte": +
  - button "Réduire la carte": −
  - button "Vue France"
  - status: La carte se prépare.
```

# Test source

```ts
  421 |       String(advanced.narrative.projects.length));
  422 |     await expect(map).toHaveAttribute("data-unplaced-projects", "0");
  423 |     if (advanced.politics.ending?.kind !== "term_complete" && advanced.politics.ending)
  424 |       break;
  425 |   }
  426 |   const state = await game(page);
  427 |   expect(state.turn).toBe(30);
  428 |   expect(state.politics.ending.kind).toBe("term_complete");
  429 |   await capture(page, info, "fin-du-mandat");
  430 |   await page.reload();
  431 |   await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  432 |   expect((await game(page)).choices).toEqual(state.choices);
  433 |   await page.locator('[data-action="open-replay-selection"]').click();
  434 |   if (info.project.name === 'desktop') {
  435 |     const rawBeforeNavigation = await page.evaluate(key => localStorage.getItem(key), KEY);
  436 |     await page.getByRole('button', { name: 'Bilan', exact: true }).click();
  437 |     await expect(page.locator('[data-map-review]')).toBeVisible();
  438 |     await page.getByRole('button', { name: 'Pays', exact: true }).click();
  439 |     await expect(page.locator('[data-map-result]')).toBeVisible();
  440 |     expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(rawBeforeNavigation);
  441 |     await page.locator('[data-action="open-replay-selection"]').click();
  442 |   }
  443 |   const replay = page.locator('[data-action="branch-replay"]').first(),
  444 |     index = Number(await replay.getAttribute("data-turn"));
  445 |   await replay.click();
  446 |   await expect(page.locator("[data-map-decision]")).toBeVisible();
  447 |   expect((await game(page)).choices).toEqual(state.choices.slice(0, index));
  448 |   const alternative = page
  449 |     .locator(
  450 |       `[data-action="choose"]:not([disabled]):not([data-choice="${state.choices[index]}"])`,
  451 |     )
  452 |     .last();
  453 |   await choose(page, await alternative.getAttribute("data-choice"));
  454 |   await capture(page, info, "autre-trajectoire");
  455 |   await page.getByRole("button", { name: "État du pays", exact: true }).click();
  456 |   await page
  457 |     .getByRole("button", {
  458 |       name: "Retrouver mon mandat d’origine",
  459 |       exact: true,
  460 |     })
  461 |     .click();
  462 |   expect((await game(page)).choices).toEqual(state.choices);
  463 | });
  464 | 
  465 | test("the fallback map and keyboard controls remain usable without WebGL", async ({
  466 |   page,
  467 | }, info) => {
  468 |   await page.addInitScript(() => {
  469 |     const original = HTMLCanvasElement.prototype.getContext;
  470 |     HTMLCanvasElement.prototype.getContext = function (type, ...args) {
  471 |       if (
  472 |         type === "webgl" ||
  473 |         type === "webgl2" ||
  474 |         type === "experimental-webgl"
  475 |       )
  476 |         return null;
  477 |       return original.call(this, type, ...args);
  478 |     };
  479 |   });
  480 |   await open(page);
  481 |   await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
  482 |     "data-renderer",
  483 |     "fallback",
  484 |   );
  485 |   await expect(page.locator("[data-map-fallback]")).toBeVisible();
  486 |   const subject = page
  487 |     .locator('[data-action="story-select"][data-story-id="education-lycees"]')
  488 |     .first();
  489 |   await subject.focus();
  490 |   await page.keyboard.press("Enter");
  491 |   await expect(page.locator("[data-map-decision]")).toBeVisible();
  492 |   await choose(page, "regrouper");
  493 |   await capture(page, info, "carte-sans-webgl");
  494 | });
  495 | 
  496 | test("authored models load after a real decision and a failed kit preserves the saved mandate", async ({ page }, info) => {
  497 |   test.skip(info.project.name !== "desktop", "One actual delayed and failed asset lifecycle.");
  498 |   await page.emulateMedia({ reducedMotion: "reduce" });
  499 |   const errors = [];
  500 |   page.on("pageerror", error => errors.push(error.message));
  501 |   let release;
  502 |   const held = new Promise(resolve => { release = resolve; });
  503 |   let intercepted = 0;
  504 |   const delay = async route => {
  505 |     intercepted++;
  506 |     await held;
  507 |     await route.continue();
  508 |   };
  509 |   await page.route("**/mandats/models/*.glb*", delay);
  510 |   try {
  511 |     await open(page);
  512 |     await expect.poll(() => intercepted).toBeGreaterThan(0);
  513 |     const map = page.locator("[data-mandate-map]");
  514 |     await expect(map).toHaveAttribute("data-renderer", "loading");
  515 |     await page.locator("[data-map-canvas]").evaluate(canvas => { canvas.dataset.instance = "loading-persistent"; });
  516 |     await select(page, "education-lycees");
  517 |     const before = await choose(page, "regrouper");
  518 |     expect(before.turn).toBe(1);
  519 |     expect(before.social.movements[0].status).toBe("active");
  520 |     release();
> 521 |     await expect(map).toHaveAttribute("data-renderer", "babylon");
      |                       ^ Error: expect(locator).toHaveAttribute(expected) failed
  522 |     await expect(map).toHaveAttribute("data-movements", "1");
  523 |     await expect(page.locator("[data-map-canvas]")).toHaveAttribute("data-instance", "loading-persistent");
  524 |     expect((await game(page)).choices).toEqual(before.choices);
  525 |     await capture(page, info, "modeles-apres-decision");
  526 |     await page.unroute("**/mandats/models/*.glb*", delay);
  527 |     const fail = route => route.fulfill({ status: 503, body: "Model unavailable" });
  528 |     await page.route("**/mandats/models/*.glb*", fail);
  529 |     await page.reload();
  530 |     await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  531 |     await expect(page.locator("[data-mandate-map]")).toHaveAttribute("data-renderer", "fallback");
  532 |     expect((await game(page)).choices).toEqual(before.choices);
  533 |     await select(page, before.social.movements[0].id);
  534 |     const after = await choose(page, "financer");
  535 |     expect(after.social.movements[0].commitment.status).toBe("pending");
  536 |     await capture(page, info, "modele-indisponible-repli");
  537 |     await page.unroute("**/mandats/models/*.glb*", fail);
  538 |     await page.reload();
  539 |     await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  540 |     await expect(page.locator("[data-mandate-map]")).toHaveAttribute("data-renderer", "babylon");
  541 |     expect((await game(page)).social).toEqual(after.social);
  542 |     expect((await game(page)).choices).toEqual(after.choices);
  543 |     await capture(page, info, "modeles-et-engagement-repris");
  544 |     expect(errors).toEqual([]);
  545 |   } finally {
  546 |     release();
  547 |   }
  548 | });
  549 | 
  550 | test("prepared 3D play reloads its shaders and continues a real movement offline", async ({
  551 |   page,
  552 |   context,
  553 | }, info) => {
  554 |   test.skip(
  555 |     info.project.name !== "mobile",
  556 |     "One real service-worker lifecycle; other widths cover the same game.",
  557 |   );
  558 |   await page.emulateMedia({ reducedMotion: "reduce" });
  559 |   await open(page);
  560 |   await select(page, "education-lycees");
  561 |   const before = await choose(page, "regrouper"),
  562 |     id = before.social.movements[0].id;
  563 |   await page.getByRole("button", { name: "Ma partie", exact: true }).click();
  564 |   await page
  565 |     .getByRole("button", {
  566 |       name: "Préparer le jeu hors connexion",
  567 |       exact: true,
  568 |     })
  569 |     .click();
  570 |   await expect(page.getByRole("dialog").getByRole("status")).toContainText(
  571 |     "prêt hors connexion",
  572 |     { timeout: 45000 },
  573 |   );
  574 |   const cachedModels = await page.evaluate(async () => {
  575 |     const keys = (await caches.keys()).filter(key => key.startsWith("mandats-offline-"));
  576 |     return Promise.all(keys.map(async key => (await (await caches.open(key)).keys())
  577 |       .map(request => new URL(request.url).pathname)
  578 |       .filter(path => /^\/mandats\/models\/.*\.glb(?:\?|$)/.test(path))));
  579 |   });
  580 |   expect(cachedModels.some(paths => paths.length >= 2)).toBe(true);
  581 |   await info.attach("modeles-3d-hors-connexion", {
  582 |     body: JSON.stringify(cachedModels, null, 2), contentType: "application/json",
  583 |   });
  584 |   await context.setOffline(true);
  585 |   await page.reload();
  586 |   await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  587 |   await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
  588 |     "data-renderer",
  589 |     "babylon",
  590 |   );
  591 |   expect((await game(page)).social).toEqual(before.social);
  592 |   await select(page, id);
  593 |   const after = await choose(page, "financer");
  594 |   expect(after.social.movements[0].commitment.status).toBe("pending");
  595 |   await capture(page, info, "hors-connexion-3d");
  596 |   await context.setOffline(false);
  597 | });
  598 | 
  599 | test("a lost graphics context keeps the map subjects and decisions usable", async ({
  600 |   page,
  601 | }, info) => {
  602 |   test.skip(
  603 |     info.project.name !== "desktop",
  604 |     "One actual context-loss lifecycle.",
  605 |   );
  606 |   const errors = [];
  607 |   page.on("pageerror", (error) => errors.push(error.message));
  608 |   await page.emulateMedia({ reducedMotion: "reduce" });
  609 |   await open(page, 1);
  610 |   const map = page.locator("[data-mandate-map]");
  611 |   const canvas = page.locator("[data-map-canvas]");
  612 |   await expect(map).toHaveAttribute(
  613 |     "data-renderer",
  614 |     "babylon",
  615 |   );
  616 |   const initial = await game(page);
  617 |   expect(initial.narrative.projects).toEqual([]);
  618 |   await canvas.evaluate((element) => {
  619 |     element.dataset.instance = "lost-context-persistent";
  620 |   });
  621 |   const lost = await canvas.evaluate((element) => {
```