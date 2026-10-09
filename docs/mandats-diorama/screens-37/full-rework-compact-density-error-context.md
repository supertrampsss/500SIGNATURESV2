# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mandats-rework.test.mjs >> a high density display keeps the 3D map sharp through resize and saved resume
- Location: tests/mandats-rework.test.mjs:92:1

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
    - locator resolved to <section aria-busy="true" data-movements="0" data-mandate-map="" data-renderer="loading" class="mandate-map mandate-map--preview-ready" aria-label="Carte de France et sujets du mandat">…</section>
    4 × unexpected value "loading"
      - locator resolved to <section data-turn="1" aria-busy="true" data-projects="0" data-movements="1" data-mandate-map="" data-motion="reduced" data-renderer="loading" data-resolution="780x558" data-contact-shadows="false" data-edge-antialiasing="canvas" class="mandate-map mandate-map--preview-ready" aria-label="Carte de France et sujets du mandat">…</section>
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
  124 |       const path = info.outputPath(label + "-resolution.json");
  125 |       await writeFile(
  126 |         path,
  127 |         JSON.stringify(
  128 |           {
  129 |             url: page.url(),
  130 |             viewport: page.viewportSize(),
  131 |             raster: await raster(),
  132 |             inputs: raw
  133 |               ? JSON.parse(raw)
  134 |               : {
  135 |                   version: 12,
  136 |                   mode: "national",
  137 |                   seed: 0,
  138 |                   ambition: "equilibre",
  139 |                   choices: [],
  140 |                 },
  141 |             state: await game(page),
  142 |           },
  143 |           null,
  144 |           2,
  145 |         ),
  146 |       );
  147 |       await info.attach(label + "-resolution", {
  148 |         path,
  149 |         contentType: "application/json",
  150 |       });
  151 |     }
  152 |     async function expectReadableRaster() {
  153 |       await expect
  154 |         .poll(async () => {
  155 |           const size = await raster();
  156 |           return (
  157 |             size.width >= size.cssWidth - 1 &&
  158 |             size.height >= size.cssHeight - 1
  159 |           );
  160 |         })
  161 |         .toBe(true);
  162 |     }
  163 | 
  164 |     await open(page);
  165 |     await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
  166 |       "data-renderer",
  167 |       "babylon",
  168 |     );
  169 |     expect((await raster()).devicePixelRatio).toBe(2);
  170 |     const initial = await game(page);
  171 |     await canvas.evaluate((element) => {
  172 |       element.dataset.instance = "high-density-persistent";
  173 |     });
  174 |     await retain("carte-dpr-2");
  175 |     await expectReadableRaster();
  176 | 
  177 |     await page.locator('[data-map-marker="education-lycees"]').click();
  178 |     await expect(page.locator("[data-map-decision]")).toBeVisible();
  179 |     expect((await game(page)).turn).toBe(initial.turn);
  180 |     await page.locator('[data-action="map-close"]').click();
  181 |     const map = page.locator("[data-mandate-map]");
  182 |     let wheelRadius;
  183 |     if (!info.project.use.isMobile) {
  184 |       const overviewRadius = Number(await map.getAttribute("data-camera-radius"));
  185 |       const bounds = await canvas.boundingBox();
  186 |       await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .5);
  187 |       await page.mouse.wheel(0, -360);
  188 |       await expect.poll(async () => Number(await map.getAttribute("data-camera-radius")))
  189 |         .toBeLessThan(overviewRadius - .05);
  190 |       let previousRadius, stableChecks = 0;
  191 |       await expect.poll(async () => {
  192 |         const radius = await map.getAttribute("data-camera-radius");
  193 |         stableChecks = radius === previousRadius ? stableChecks + 1 : 0;
  194 |         previousRadius = radius;
  195 |         return stableChecks;
  196 |       }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
  197 |       wheelRadius = Number(await map.getAttribute("data-camera-radius"));
  198 |     }
  199 |     const previousResolution = await map.getAttribute("data-resolution");
  200 |     const resizedViewport = info.project.use.isMobile
  201 |       ? viewport.width <= 320
  202 |         ? { width: 390, height: 844 }
  203 |         : { width: 320, height: 740 }
  204 |       : { width: 1000, height: 800 };
  205 |     await page.setViewportSize(resizedViewport);
  206 |     await expect(map).not.toHaveAttribute("data-resolution", previousResolution);
  207 |     await expectReadableRaster();
  208 |     if (wheelRadius !== undefined)
  209 |       expect(Number(await map.getAttribute("data-camera-radius"))).toBeCloseTo(wheelRadius, 1);
  210 |     expect((await game(page)).turn).toBe(initial.turn);
  211 |     await expect(canvas).toHaveAttribute(
  212 |       "data-instance",
  213 |       "high-density-persistent",
  214 |     );
  215 |     await page.locator('[data-map-marker="education-lycees"]').click();
  216 |     await expect(page.locator("[data-map-decision]")).toBeVisible();
  217 |     expect((await game(page)).turn).toBe(initial.turn);
  218 |     await retain("carte-redimensionnee-dpr-2");
  219 | 
  220 |     const saved = await choose(page, "regrouper");
  221 |     expect(saved.turn).toBe(initial.turn + 1);
  222 |     await page.reload();
  223 |     await page.getByRole("button", { name: "Reprendre", exact: true }).click();
> 224 |     await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
      |                                                      ^ Error: expect(locator).toHaveAttribute(expected) failed
  225 |       "data-renderer",
  226 |       "babylon",
  227 |     );
  228 |     await expectReadableRaster();
  229 |     expect((await game(page)).turn).toBe(saved.turn);
  230 |     expect((await game(page)).choices).toEqual(saved.choices);
  231 |     await page.locator("[data-map-marker]").first().click();
  232 |     await expect(page.locator("[data-map-decision]")).toBeVisible();
  233 |     expect((await game(page)).turn).toBe(saved.turn);
  234 |     await retain("carte-reprise-dpr-2");
  235 |     expect(errors).toEqual([]);
  236 |   } finally {
  237 |     await context.close();
  238 |   }
  239 | });
  240 | 
  241 | test("the real 3D map opens subjects without advancing the game and preserves its canvas", async ({
  242 |   page,
  243 | }, info) => {
  244 |   const errors = [];
  245 |   const models = [];
  246 |   page.on("pageerror", (error) => errors.push(error.message));
  247 |   page.on("response", response => {
  248 |     if (/\/mandats\/models\/[^?]+\.glb(?:\?|$)/.test(response.url()))
  249 |       models.push({ url: response.url(), status: response.status() });
  250 |   });
  251 |   await open(page);
  252 |   await expect(page.locator("[data-mandate-map]")).toHaveAttribute(
  253 |     "data-renderer",
  254 |     "babylon",
  255 |   );
  256 |   await expect(page.locator("[data-map-canvas]")).toBeVisible();
  257 |   expect(models.length).toBeGreaterThanOrEqual(2);
  258 |   expect(models.every(model => model.status === 200)).toBe(true);
  259 |   await info.attach("modeles-3d-charges", {
  260 |     body: JSON.stringify(models, null, 2), contentType: "application/json",
  261 |   });
  262 |   await page
  263 |     .locator("[data-map-canvas]")
  264 |     .evaluate((canvas) => (canvas.dataset.instance = "persistent"));
  265 |   await select(page, "education-lycees");
  266 |   expect((await game(page)).turn).toBe(0);
  267 |   await page.locator('[data-action="map-close"]').click();
  268 |   expect((await game(page)).turn).toBe(0);
  269 |   await select(page, "education-lycees");
  270 |   await expect(page.locator("[data-map-canvas]")).toHaveAttribute(
  271 |     "data-instance",
  272 |     "persistent",
  273 |   );
  274 |   expect(await page.locator("[data-map-decision] .choice").count()).toBe(3);
  275 |   await expect
  276 |     .poll(() =>
  277 |       page.locator("[data-map-marker]").evaluateAll((markers) => {
  278 |         const bounds = markers.map((marker) => marker.getBoundingClientRect());
  279 |         return bounds.reduce(
  280 |           (count, rectangle, index) =>
  281 |             count +
  282 |             bounds
  283 |               .slice(index + 1)
  284 |               .filter(
  285 |                 (other) =>
  286 |                   Math.min(rectangle.right, other.right) -
  287 |                     Math.max(rectangle.left, other.left) >
  288 |                     1 &&
  289 |                   Math.min(rectangle.bottom, other.bottom) -
  290 |                     Math.max(rectangle.top, other.top) >
  291 |                     1,
  292 |               ).length,
  293 |           0,
  294 |         );
  295 |       }),
  296 |     )
  297 |     .toBe(0);
  298 |   expect(
  299 |     await page.locator("[data-mandate-map]").evaluate((map) => {
  300 |       const bounds = map.getBoundingClientRect();
  301 |       return [...map.querySelectorAll("[data-map-marker]")].every((marker) => {
  302 |         const rectangle = marker.getBoundingClientRect();
  303 |         return (
  304 |           rectangle.left >= bounds.left - 1 &&
  305 |           rectangle.right <= bounds.right + 1 &&
  306 |           rectangle.top >= bounds.top - 1 &&
  307 |           rectangle.bottom <= bounds.bottom + 1
  308 |         );
  309 |       });
  310 |     }),
  311 |   ).toBe(true);
  312 |   expect(
  313 |     /[—–←→↗↘›‹]/u.test(await page.locator("[data-map-decision]").innerText()),
  314 |   ).toBe(false);
  315 |   await capture(page, info, "carte-et-sujet");
  316 |   expect(errors).toEqual([]);
  317 |   expect(
  318 |     await page.evaluate(
  319 |       () => document.documentElement.scrollWidth <= innerWidth + 1,
  320 |     ),
  321 |   ).toBe(true);
  322 |   await page.locator('[data-action="map-inspect"]').click();
  323 |   await expect(page.locator('[data-mandate-map]')).toHaveAttribute('data-inspection', 'lyon');
  324 |   if (info.project.use.isMobile) {
```