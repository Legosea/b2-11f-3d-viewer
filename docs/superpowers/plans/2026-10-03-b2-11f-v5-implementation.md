# B2-11F v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild B2-11F as a source-faithful, editable Three.js residential viewer using the `interior-design-master` runtime and case contract, then publish the verified v5 build to the existing GitHub Pages URL.

**Architecture:** Vendor the reviewed `runtime-starter` from `akseolabs-seo/interior-design-master` into `viewer/`, keep the source PDF and all case truth under `case/`, and generate the fixed architecture exclusively from `case/plan.json`. Geometry extraction and source-to-metre calibration are recorded under `case/evidence/`; style and furniture remain replaceable case layers. GitHub Pages keeps its current `main/(root)` configuration: CI builds `viewer/` and copies only the generated `index.html`, `assets/`, and `case/` output to the repository root.

**Tech Stack:** Three.js 0.183, Vite 7, Node.js ESM, Playwright, Python 3 + PyMuPDF for PDF vector inspection, Interior Design Master case JSON contracts, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-03-b2-11f-v5-design.md`

## Global Constraints

- Source of architectural truth: `2024-07-14-Model(1).pdf` B2-11F plan; v1-v4 coordinates are not geometry evidence.
- Floor-to-floor height: **3300 mm**.
- W3 opening: **2680 mm wide × 1900 mm high**, sill **500 mm AFF**, head **2400 mm AFF**.
- PDF title block scale is **1/60**, but W3 is the calibration check; if the two disagree, the user-confirmed W3 measurement wins locally and the discrepancy is recorded.
- Fixed architecture is immutable when style or furniture changes.
- Unresolved geometry/product facts must remain `estimated`, `inferred`, `unknown`, or `unverified`.
- Style reference informs design language only; it cannot supply wall coordinates, dimensions, or product identity.
- Use exactly one render-quality control; mobile viewport under 800 px defaults to `medium`.
- Do not claim browser behavior from a build pass; desktop and mobile smoke/browser checks are mandatory.
- Publish to `https://legosea.github.io/b2-11f-3d-viewer/`.
- Keep the existing GitHub Pages source setting `main/(root)`; the build workflow publishes generated root files without requiring another settings change.

## Review Focus

1. **Project Pages subpath** — all module assets and case JSON must load under `/b2-11f-3d-viewer/`, not from site-root `/case`; Task 1 adds a test for the Vite base and case URL resolver.
2. **W3 regression / floating glazing** — W3 must belong to a real wall and the shell must split that wall around the opening; Task 3 asserts wall membership, exact width/sill/head, and no solid wall span through the opening.
3. **Stale v4 browser state** — old `idm-current` localStorage must not overwrite the v5 initial layout; Task 4 namespaces persistence by `caseId` and tests migration/fallback behavior.
4. **Mobile first frame / GPU load** — 390×844 mobile must render a non-blank first frame and default to `medium`; Task 7 runs the runtime smoke suite and records the mobile screenshot.
5. **Overexposed white-model look** — the hero screenshot must not reproduce the prior clipped-white output; Task 5 adds a luminance guard plus manual comparison against the supplied style reference.

---

### Task 1: Vendor Interior Design Master Runtime and Make It GitHub-Pages-Safe

**Files:**
- Create: `viewer/package.json`
- Create: `viewer/package-lock.json`
- Create: `viewer/vite.config.js`
- Create: `viewer/index.html`
- Create: `viewer/src/*.js`
- Create: `viewer/src/style.css`
- Create: `viewer/scripts/*.mjs`
- Create: `viewer/assets-manifest.json`
- Create: `viewer/THIRD_PARTY.md`
- Create: `viewer/tests/pages-base.test.mjs`
- Modify: `viewer/src/main.js`
- Modify: `viewer/vite.config.js`

**Interfaces:**
- Consumes: reviewed upstream `akseolabs-seo/interior-design-master` commit `68e3c690a4367cd2ee44e53bee0632c50b72f831`, specifically `runtime-starter/`.
- Produces: a Vite viewer whose public base is `/b2-11f-3d-viewer/` and whose case JSON URL is derived from `import.meta.env.BASE_URL`.

- [ ] **Step 1: Copy the reviewed upstream runtime into `viewer/` and record provenance**

Copy `runtime-starter/` at commit `68e3c690a4367cd2ee44e53bee0632c50b72f831` without copying its example case as project truth. Add `viewer/THIRD_PARTY.md` with repository URL, reviewed commit, MIT license note, and the statement that B2 case data is authored separately.

- [ ] **Step 2: Write the failing GitHub Pages base-path test**

Create `viewer/tests/pages-base.test.mjs` with Node `node:test` assertions that:
- `vite.config.js` exports base `/b2-11f-3d-viewer/`;
- `src/main.js` derives the case base from `import.meta.env.BASE_URL`;
- no production case fetch literal starts with `'/case'`.

- [ ] **Step 3: Run the test and verify it fails before the base-path fix**

Run: `cd viewer && node --test tests/pages-base.test.mjs`  
Expected: FAIL because upstream `main.js` uses `const CASE_BASE = '/case'` and upstream Vite has no project base.

- [ ] **Step 4: Implement the Pages base-path fix**

Set `base: '/b2-11f-3d-viewer/'` in `viewer/vite.config.js`. Replace the hard-coded case base with an exported resolver:

```js
export const caseBaseUrl = base => `${String(base || '/').replace(/\/?$/, '/') }case`;
const CASE_BASE = caseBaseUrl(import.meta.env.BASE_URL);
```

Keep all other runtime behavior unchanged.

- [ ] **Step 5: Run the base-path test**

Run: `cd viewer && node --test tests/pages-base.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Install dependencies and run the upstream Skill script self-tests**

Run:
```bash
cd <interior-design-master-skill-root>
node scripts/test-scripts.mjs
cd <project>/viewer
npm ci
```
Expected: Skill self-tests pass; npm install completes.

- [ ] **Step 7: Commit**

```bash
git add viewer
git commit -m "feat: vendor interior design master runtime"
```

---

### Task 2: Intake the B2 PDF and Build Traceable Source-Coordinate Evidence

**Files:**
- Create: `case/inputs/plan/2024-07-14-Model(1).pdf`
- Create: `case/case.json`
- Create: `case/state.json`
- Create: `case/concept-renders.json`
- Create: `case/evidence/input-inventory.json`
- Create: `case/evidence/plan-vector.json`
- Create: `case/evidence/plan-transform.json`
- Create: `case/output/plan-overlay.svg`
- Create: `tools/extract-b2-plan.py`
- Create: `tests/test_extract_b2_plan.py`

**Interfaces:**
- Consumes: the user-provided one-page B2-11F PDF plus confirmed W3 and height measurements.
- Produces:
  - `extract_plan(pdf_path: Path, out_dir: Path) -> dict` in `tools/extract-b2-plan.py`;
  - `case/evidence/plan-transform.json` with `sourceUnits`, `scaleClaim`, `metresPerSourceUnit`, `originSource`, `w3Calibration`, and `status`;
  - `case/output/plan-overlay.svg` in the same source transform used for `plan.json`.

- [ ] **Step 1: Initialize the case using the Skill's initializer**

Run from the fetched Skill root:

`node scripts/init-case.mjs <project>/case --name "B2-11F"`

Then set:
- `caseId: "b2-11f"`;
- `displayName: "B2-11F"`;
- `locale: "zh-TW"`;
- `region: "TW"`;
- `productResearch.required: true`;
- `productResearch.currency: "TWD"`.

- [ ] **Step 2: Preserve and inventory the source PDF**

Copy the original PDF bytes to `case/inputs/plan/2024-07-14-Model(1).pdf`.

Run:
`node scripts/image-inventory.mjs <project>/case/inputs`

Store the result in `case/evidence/input-inventory.json`. Add the PDF SHA-256 and role `architectural-plan` to `case/state.json.inputs`.

- [ ] **Step 3: Write the failing extraction test**

Create `tests/test_extract_b2_plan.py` asserting:
- exactly one PDF page is reported;
- the extracted record contains line/path primitives rather than raster-only evidence;
- the title block text includes `B2-11F` and `1/60` when extractable;
- the transform record includes a W3 calibration entry with target width `2.68` m;
- output overlay SVG exists and is non-empty.

- [ ] **Step 4: Run the extraction test and verify it fails**

Run: `python3 -m unittest tests/test_extract_b2_plan.py -v`  
Expected: FAIL because `tools/extract-b2-plan.py` does not yet exist.

- [ ] **Step 5: Implement `extract_plan()`**

Use PyMuPDF to:
- read page geometry and vector drawings;
- preserve original source coordinates;
- record vector segments/rectangles by primitive type;
- extract available text separately;
- detect the plan drawing region without treating title-block geometry as apartment walls;
- record the PDF's 1/60 claim;
- define a source-to-metre transform;
- verify that transform against the W3 span; when the measured span conflicts with 2.68 m, record both values and calibrate W3 locally to the confirmed user dimension instead of silently changing the whole sheet;
- render `plan-overlay.svg` from the exact vector evidence used for the case.

Do not read v1-v4 wall coordinates.

- [ ] **Step 6: Run the extraction test and inventory again**

Run:
```bash
python3 -m unittest tests/test_extract_b2_plan.py -v
node <skill-root>/scripts/image-inventory.mjs case/inputs
```
Expected: PASS and a stable SHA-256 for the plan input.

- [ ] **Step 7: Commit**

```bash
git add case tools tests
git commit -m "feat: capture B2 plan source evidence"
```

---

### Task 3: Author the Source-Faithful White Model and Lock W3 Into Its Wall

**Files:**
- Create: `case/plan.json`
- Create: `viewer/tests/b2-plan.test.mjs`
- Create: `viewer/tests/w3-opening.test.mjs`
- Modify: `case/state.json`

**Interfaces:**
- Consumes: `case/evidence/plan-vector.json`, `case/evidence/plan-transform.json`, and `plan-overlay.svg`.
- Produces: schema-valid `case/plan.json` with stable IDs for rooms, walls, openings, fixed elements, routes, and assumptions.

- [ ] **Step 1: Write the failing topology test**

Create `viewer/tests/b2-plan.test.mjs` asserting that `case/plan.json` contains:
- room IDs for `rm-left-bath`, `rm-left-bedroom`, `rm-open-living`, `rm-right-bedroom`, `rm-right-bath`, and `rm-balcony`;
- no room IDs representing the invented v1-v4 three-bedroom corridor/study layout;
- level ceiling/floor height value `3.3` m;
- connectivity matching the PDF plan: both bedrooms and bathrooms connect through the central/open circulation as shown, and balcony connects to the main open space;
- fixed wet elements in both bathrooms;
- columns/shafts visible in the PDF recorded as fixed elements.

- [ ] **Step 2: Write the failing W3 regression test**

Create `viewer/tests/w3-opening.test.mjs` that:
- finds opening `op-w3-living`;
- asserts `type` is `window` or `sliding` according to the source plan interpretation;
- asserts distance(`a`, `b`) is `2.68 ± 0.005` m;
- asserts `sill === 0.5`;
- asserts `head === 2.4`;
- asserts its referenced wall ID exists;
- projects W3 onto that wall and asserts its full span is inside the wall segment;
- asserts no second full-height wall occupies the same W3 span.

- [ ] **Step 3: Run the tests and verify they fail**

Run:
`cd viewer && node --test tests/b2-plan.test.mjs tests/w3-opening.test.mjs`  
Expected: FAIL because the B2 case has not been authored.

- [ ] **Step 4: Author `case/plan.json` from source evidence**

Use the source transform to create:
- room polygons;
- exterior and partition wall centrelines with measured/derived thickness;
- all plan-shown door/window openings and swing directions;
- W3 on the correct lower-center exterior wall;
- both bathroom fixed fixtures;
- plan-shown cabinetry/utility/shaft/column elements;
- routes only where circulation is visible and defensible.

Set every object's evidence status from the source hierarchy. For opening records, use `inferred: false` when the source directly shows the opening; record uncertainty in `assumptions[]` because the opening schema has no per-opening status field.

- [ ] **Step 5: Run case and W3 tests**

Run:
`cd viewer && node --test tests/b2-plan.test.mjs tests/w3-opening.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Run strict case validation at white-model stage**

Keep `case.json.productResearch.required=false` only for this temporary white-model validation checkpoint. Set `state.stage="white-model"`, then run:

`node <skill-root>/scripts/validate-case.mjs case --strict`

Expected: valid schema with no geometry-structure errors. Restore `productResearch.required=true` before Task 6.

- [ ] **Step 7: Commit**

```bash
git add case/plan.json case/state.json viewer/tests
git commit -m "feat: build B2 white model plan"
```

---

### Task 4: Add Plan-Overlay Review Mode and Case-Scoped Initial State

**Files:**
- Create: `viewer/src/review-overlay.js`
- Create: `viewer/tests/state-case-scope.test.mjs`
- Modify: `viewer/src/app.js`
- Modify: `viewer/src/main.js`
- Modify: `viewer/src/state.js`
- Modify: `viewer/src/style.css`
- Modify: `viewer/src/i18n.js`
- Modify: `case/state.json`

**Interfaces:**
- Consumes: `case/output/plan-overlay.svg`, `case.state.layout`, and `caseId`.
- Produces:
  - `createReviewOverlay({scene, plan, overlayUrl, invalidate}) -> {setVisible, getVisible, dispose}`;
  - case-scoped persistence functions `loadCurrent(caseId)`, `saveCurrent(caseId, record)`, `loadSaved(caseId)`, `pushSaved(caseId, record)`;
  - initial layout fallback from `caseData.state.layout` when neither share hash nor current case-scoped storage exists.

- [ ] **Step 1: Write the failing persistence regression test**

Create `viewer/tests/state-case-scope.test.mjs` asserting:
- saving state for `b2-11f` does not load for another case ID;
- legacy `idm-current` is ignored for B2 v5;
- initial `caseData.state.layout` is returned when no share hash or case-scoped current state exists.

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd viewer && node --test tests/state-case-scope.test.mjs`  
Expected: FAIL because upstream storage keys are global and main.js has no initial-case-layout fallback.

- [ ] **Step 3: Implement case-scoped persistence**

Change storage keys to:
- `idm-current:<caseId>`;
- `idm-saved:<caseId>`.

Update all callers in `main.js`. Do not migrate the old global v4 key into v5.

In `restoreState()`, precedence must be:
1. share hash;
2. case-scoped localStorage;
3. `caseData.state.layout`;
4. empty layout.

- [ ] **Step 4: Add the review overlay**

Load `plan-overlay.svg` as a texture/plane aligned with the same x-z transform that authored `plan.json`. Put it in a review-only layer, slightly above the floor in top view, excluded from capture by default. Add a toolbar toggle labeled `平面疊圖`.

- [ ] **Step 5: Add a viewer API for the overlay**

Expose `setReviewOverlay(visible)` and `getReviewOverlay()` from `createViewer()`; the UI toggle calls the API without mutating architecture.

- [ ] **Step 6: Run state tests and build**

Run:
```bash
cd viewer
node --test tests/state-case-scope.test.mjs
npm run build
```
Expected: PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add viewer/src viewer/tests case/state.json
git commit -m "feat: add B2 plan review overlay and scoped state"
```

---

### Task 5: Implement the Approved Warm Dollhouse Style and Hero Camera

**Files:**
- Create: `case/inputs/style/reference-dollhouse.jpg`
- Create: `case/style.json`
- Create: `viewer/scripts/check-hero-luminance.mjs`
- Modify: `viewer/package.json`
- Modify: `viewer/package-lock.json`
- Modify: `viewer/src/materials.js`
- Modify: `viewer/src/render.js`
- Modify: `viewer/src/views.js`
- Modify: `viewer/src/lighting.js`
- Modify: `case/state.json`

**Interfaces:**
- Consumes: user-supplied style reference image and the fixed `plan.json`.
- Produces: style `st-warm-dollhouse`, default axonometric hero framing, and a measurable non-clipped render baseline.

- [ ] **Step 1: Preserve and inventory the style reference**

Save the supplied reference image to `case/inputs/style/reference-dollhouse.jpg`; record its SHA-256 and role `style-reference` in `state.json.inputs`.

Do not derive dimensions from it.

- [ ] **Step 2: Write the failing style-data test**

Add assertions to `viewer/tests/b2-plan.test.mjs` or a new `viewer/tests/b2-style.test.mjs` that:
- the first style ID is `st-warm-dollhouse`;
- wall palette is not pure white;
- floor/wood/fabric/frame roles all exist;
- every furniture role references a valid room ID;
- lighting status is `inferred` because north/sun evidence is absent.

- [ ] **Step 3: Run style test and verify it fails**

Run: `cd viewer && node --test tests/b2-style.test.mjs`  
Expected: FAIL because B2 style data is not yet authored.

- [ ] **Step 4: Author `style.json` from the reference**

Use:
- warm off-white wall token;
- light natural oak floor;
- muted gray-beige fabric;
- warm medium wood cabinetry;
- charcoal/dark-gray frame/metal;
- restrained green accent.

Rules must explicitly say:
- keep architecture fixed;
- maintain clear circulation;
- avoid glossy pure-white surfaces;
- use low-to-moderate object density;
- use a lower axonometric/dollhouse hero composition.

- [ ] **Step 5: Tune renderer/material/view defaults without changing geometry**

Keep ACES, GTAO, soft shadows, and the runtime quality tiers. Adjust only presentation defaults so the reference reads as the target:
- lower clipped highlights;
- off-white background distinct from wall paint;
- natural oak planks;
- low-saturation upholstery;
- dark W3/window frame material;
- axonometric hero camera tightly frames the whole unit;
- cutaway mode is a presentation transform only.

- [ ] **Step 6: Add automated overexposure guard**

Add dev dependency `pngjs`. Implement `viewer/scripts/check-hero-luminance.mjs <png>` to fail when:
- mean relative luminance exceeds `0.88`; or
- more than `45%` of pixels exceed `0.95` luminance.

This is a regression guard against the prior nearly-all-white render, not a proof of visual quality.

- [ ] **Step 7: Run style test and build**

Run:
```bash
cd viewer
node --test tests/b2-style.test.mjs
npm run build
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add case/inputs/style case/style.json case/state.json viewer
git commit -m "feat: add warm dollhouse visual system"
```

---

### Task 6: Research Taiwan Product Evidence and Seed the Furniture Layout

**Files:**
- Create: `case/furniture-products.json`
- Modify: `case/style.json`
- Modify: `case/state.json`
- Create: `case/evidence/product-research.md`
- Create: `viewer/tests/b2-layout.test.mjs`

**Interfaces:**
- Consumes: style furniture roles, room polygons, live Taiwan-market product pages.
- Produces: evidence-backed product records plus `case/state.json.layout` entries in the runtime placement format `{productId, x, z, ry, y}`.

- [ ] **Step 1: Write the failing layout/evidence test**

Create `viewer/tests/b2-layout.test.mjs` asserting:
- every `state.layout[].productId` exists in `furniture-products.json`;
- every placed product has positive W/D/H;
- `dimensionSourceUrl` is one of the product's evidence URLs;
- every placed product geometry source is one of the Skill contract values;
- the initial layout has no furniture in bathroom/wet polygons;
- the W3 opening and door swing zones are not occupied by seeded furniture.

- [ ] **Step 2: Run test and verify it fails**

Run: `cd viewer && node --test tests/b2-layout.test.mjs`  
Expected: FAIL because product records/layout are empty.

- [ ] **Step 3: Research each product role before placement**

Target market: Taiwan, currency TWD.

For every role that enters the initial scene — sofa, coffee table, lounge chair, dining table, dining chair, bed, bedside table, desk/chair, wardrobe/storage, TV console, kitchen tall/base unit where movable, bathroom vanity only if treated as product rather than fixed architecture, and plant — record:
- live query;
- selected candidate;
- rejected candidates where relevant;
- current direct product/spec URL;
- exact variant;
- W/D/H;
- retrieval timestamp;
- geometry strategy;
- fit status and unresolved delivery/clearance issues.

Prefer official manufacturer pages, then authorized retailers. If a role cannot be sourced reliably, either omit it from the initial scene or use a source-backed product with a procedural proxy; do not invent a fake purchase URL.

- [ ] **Step 4: Seed a reference-like but plan-safe layout**

Write `state.json.layout` using the researched outer dimensions. Keep the central/open space legible in the axonometric view, place beds in the two source bedrooms, dining and living group in the central open area, and do not change walls to make furniture fit.

- [ ] **Step 5: Run strict case and link validation**

Restore `case.json.productResearch.required=true`; set `state.stage="products"`.

Run:
```bash
node <skill-root>/scripts/validate-case.mjs case --strict
node <skill-root>/scripts/check-product-links.mjs case
cd viewer
node --test tests/b2-layout.test.mjs
```

Expected:
- strict validator passes;
- no `failed` product links;
- blocked links remain explicitly `unverified` in the receipt;
- layout test passes.

- [ ] **Step 6: Commit**

```bash
git add case viewer/tests
git commit -m "feat: add evidence-backed B2 furniture layout"
```

---

### Task 7: Complete Browser QA, Publish Root Build, and Verify GitHub Pages

**Files:**
- Create: `.github/workflows/publish-pages-root.yml`
- Create: `docs/validation/v5-receipt.md`
- Create: `case/output/desktop-axon.png`
- Create: `case/output/desktop-top.png`
- Create: `case/output/desktop-inside.png`
- Create: `case/output/mobile-orbit.png`
- Modify: `case/state.json`
- Generated at repository root: `index.html`
- Generated at repository root: `assets/*`
- Generated at repository root: `case/*`
- Preserve: `.nojekyll`, `docs/`, `viewer/`

**Interfaces:**
- Consumes: verified `viewer/` and `case/`.
- Produces: the publicly served v5 site at the existing GitHub Pages URL plus validation receipt/screenshots.

- [ ] **Step 1: Extend the upstream smoke test for B2-specific checks**

Add assertions to `viewer/scripts/smoke.mjs` or a B2 wrapper that:
- first frame is visible;
- top, axon, inside, and walk views render;
- review overlay toggles and produces a screenshot;
- W3 opening group exists in the Three.js scene;
- furniture selection/move/rotate/undo works;
- a bathroom placement is rejected;
- walkthrough colliders are non-zero and movement occurs;
- share hash round-trips the seeded layout;
- mobile quality is not `high`;
- no desktop/mobile console errors occur.

- [ ] **Step 2: Run the complete validation sequence**

Run in the exact order required by the Skill:

```bash
cd <skill-root>
node scripts/test-scripts.mjs
node scripts/validate-case.mjs <project>/case --strict
node scripts/check-product-links.mjs <project>/case

cd <project>/viewer
npm ci
npm run build
node scripts/smoke.mjs
```

Expected: all mandatory checks pass; blocked product links are reported as unverified, not passed.

- [ ] **Step 3: Run the hero luminance guard**

Run:
`node scripts/check-hero-luminance.mjs smoke-output/desktop-axon.png`

Expected: PASS with mean luminance `<= 0.88` and highlight ratio `<= 45%`.

- [ ] **Step 4: Perform manual white-model and style inspection**

Inspect:
- desktop axonometric;
- desktop top/overlay;
- one interior view;
- mobile orbit.

Confirm:
- top view matches the source PDF topology;
- W3 is embedded in the wall rather than floating;
- no invented v1-v4 partitions remain;
- warm dollhouse style reads closer to the approved reference;
- room labels/furniture do not obscure the plan in review mode.

Copy representative screenshots into `case/output/`.

- [ ] **Step 5: Write the validation receipt**

Create `docs/validation/v5-receipt.md` with:
- timestamps;
- exact commands and results;
- input SHA-256;
- plan/style/product/state versions;
- upstream Skill commit;
- desktop/mobile browser context;
- screenshot paths;
- product link results;
- verified / inferred / unverified / blocked distinctions;
- remaining geometry/product unknowns.

Set `state.stage="verified"` and `state.lastReceipt="docs/validation/v5-receipt.md"`.

- [ ] **Step 6: Add the root-publish workflow without changing Pages settings**

Create `.github/workflows/publish-pages-root.yml`:

- trigger only on changes to `viewer/**`, `case/**`, or the workflow itself;
- checkout;
- `cd viewer && npm ci && npm run build`;
- copy `viewer/dist/index.html` to root `index.html`;
- replace only root `assets/` and root `case/` with `viewer/dist/assets/` and `viewer/dist/case/`;
- preserve `.nojekyll`, `docs/`, and `viewer/`;
- commit generated root files with `github-actions[bot]` using `contents: write`;
- the generated commit must not retrigger the workflow because root output paths are outside the trigger filter.

- [ ] **Step 7: Verify the live Pages deployment**

After the generated root commit is published, open:

`https://legosea.github.io/b2-11f-3d-viewer/?v5=<commit>`

Verify in the live site:
- desktop loads case JSON from the project subpath;
- mobile first frame renders;
- W3 is embedded;
- axonometric/top/interior/walk views function;
- no console error is introduced by GitHub Pages paths.

Record the live URL and commit in the receipt.

- [ ] **Step 8: Commit final source/receipt/workflow**

```bash
git add .github docs/validation case viewer
git commit -m "feat: verify and publish B2-11F v5"
```

Do not hand-edit generated root build files after the workflow publishes them.
