# runtime-starter

A reusable Three.js / Vite viewer for an **interior-design-master** case directory. It reads
`plan.json`, `style.json`, `furniture-products.json` and `state.json` and renders an editable
residential 3D model: fixed architecture, replaceable design layers, real-time lighting, five
camera modes, a first-person walkthrough with collision, free furniture placement and a product
panel that carries the full evidence chain.

Nothing in `src/` is specific to any particular home. All geometry comes from the case data.

## Run it

```bash
npm install
npm run dev            # http://127.0.0.1:5179
```

`public/case/` ships pre-linked to `../examples/minimal-case`, so `npm run dev` works with zero
configuration.

Optional, and worth doing once — download the CC0 Poly Haven HDRI and PBR textures:

```bash
npm run fetch-assets   # writes public/hdri and public/textures, verifies sha256, prints a receipt
```

The app renders correctly **without** them: it falls back to `RoomEnvironment` for reflections and
to procedural canvas textures for wood, weave and pile. The scanned maps upgrade the same material
instances in place once they exist.

## Point it at your own case

```bash
node scripts/link-case.mjs ../../path/to/my-case
npm run dev
```

`link-case.mjs` copies `case.json`, `plan.json`, `style.json`, `furniture-products.json`,
`state.json` and `concept-renders.json` into `public/case/` and fails loudly if a required file is
missing or is not valid JSON. Validate the case itself with the skill's own script first:

```bash
node ../scripts/validate-case.mjs ../../path/to/my-case --strict
node ../scripts/check-product-links.mjs ../../path/to/my-case
```

## Verify it

```bash
npm run build
npm run smoke          # spawns vite preview on 5181, drives Chromium via Playwright
```

`scripts/smoke.mjs` builds `dist/` (`vite build`) before it starts `vite preview`, so it is
self-sufficient even if you skip the `npm run build` above; pass `--no-build` to reuse an
existing `dist/` instead. It then waits for the first composited frame, asserts there are no
console errors, takes desktop (1440x900) and mobile (390x844) screenshots into `output/smoke/`,
switches view presets, places a product proxy, walks with collision, round-trips the share hash
and checks that `productId` survives every step. It writes `output/smoke/receipt.json`.

## Quality tiers

One control, three tiers, stored in `localStorage` under `idm-render-quality`. Default is **high**
on desktop and **medium** under 800 px.

| | high | medium | low |
|---|---|---|---|
| HDRI reflections | yes | yes | yes |
| GTAO | yes | yes | off |
| Bloom | yes | yes | off |
| SMAA | yes | yes | off |
| Glass transmission | yes | off | off |
| Sun shadow map | 4096 (2048 on narrow screens) | 2048 | 1024 |
| Device pixel ratio | up to 2 | up to 1.5 | 1 |

The loop is render-on-demand: a frame is drawn only when something calls `invalidate()`, and
`shadowMap.autoUpdate` is off so a 4K shadow pass is not repeated for a static room.

## Controls

**Camera** — 立體 (orbit), 俯視 (top / 2D), 軸測 (axonometric), 室內 (inside), 行走 (walk).
Presets are fitted to the plan's bounding box, so a studio and a house both frame correctly.
Switching design layers never moves the camera.

**Placing furniture** — desktop: drag a product card onto the canvas, or press 放入場景; drag a
placed item to move it. Mobile: tap the card, then tap the floor. Grid is 5 cm, rotation 15°.
Selected item: `R` rotate, `Shift+R` reverse, `Delete` remove, `Ctrl/Cmd+D` duplicate, `Escape`
deselect — plus a small gizmo toolbar next to the selection. Overlaps, walls, fixed elements and
wet rooms (only decoration / plants / rugs / lamps) are rejected with a red outline.

**Walkthrough** — WASD or arrows, `Q`/`E` turn, `Shift` run, `C` crouch, `Escape` exit. Drag or
click to lock the pointer and look around. Mobile gets a left analogue stick plus drag-to-look.
Collision uses every currently visible mesh plus the plan's room polygons, so the walker cannot
leave the flat.

**Tools** — 牆高 full/cutaway walls, 標籤 room labels, 攝影 2× PNG capture with the UI hidden,
測距 two-click floor distance in cm, 全螢幕 (with an iOS fallback).

**Sharing** — 複製分享連結 packs style, quality, view, light settings and every placed item
(with its `productId`) into the URL hash. Opening a link with a hash overrides browser storage.
Up to 6 states can be saved locally.

## Data contract

| file | what the viewer reads |
|---|---|
| `plan.json` | rooms (polygon boundaries), walls (`a`,`b`,`thickness`,`height`,`kind`), openings (`type`,`a`,`b`,`sill`,`head`,`swing`), `fixedElements`, `routes`, `source.northDeg`, `assumptions` |
| `style.json` | one entry per design layer: `palette` (roles `wall`/`wood`/`fabric`/`floor`/`accent`), `rules`, `furnitureRoles` |
| `furniture-products.json` | `role`, `dimensionsMm` + per-axis status, `dimensionSourceUrl`, `evidence`, `purchaseUrl`, `price`, `geometry`, `fit` |
| `state.json` | `stage`, `assumptions`, `unknowns` — shown in the 方案 tab |
| `concept-renders.json` | optional; an empty `renders` array is fine |

Coordinates are metres, `x` right, `z` down (as printed on a plan), `y` up. Floor finish level is
`y = 0`.

Openings are not cut with CSG. Each wall is split into solid segments around its openings, with
separate head and sill infill, so every piece stays a clean box for shadows and collision.

## Runtime API

`createViewer(container, caseData)` returns the object `src/main.js` drives; it is also on
`window.idm.viewer` for tests and hosts.

```js
setProducts(products)     setLayout(items)        getLayout()
placeProduct(id, x, z)    pickProduct(id)         selectItem(indexOrProductId)
focusItem(productId)      rotateSelected(deg)     duplicateSelected()
undo() / redo()           clearLayout()
setView('orbit'|'top'|'axon'|'inside'|'walk')     focusRoom(roomId | 'all')
setStyle(styleId)         setLight({...})         setQuality('high'|'medium'|'low')
setWallMode('full'|'cut') setLabelsVisible(bool)  setMeasure(bool)
capture(scale)            encodeShare()           applyShare(hash)
getState()                exportProducts()        exportText()
```

**Invariant:** a scene object never loses its `productId` — not when moved, duplicated, saved,
shared or exported. The smoke test asserts this across a full share round trip.

## What this is not

An interactive conceptual model. It is not a construction drawing, a BIM model, a measured survey,
a photoreal twin, a daylight or acoustic simulation, or a purchase guarantee. Sun position is
computed from the date, the local wall-clock hour and a bearing; when `plan.source.northDeg` is
`null` the orientation is labelled as illustrative and adjustable. Furniture shapes are
dimension-accurate proxies unless a product record supplies `geometry.assetPath`; only the
published width, depth and height come from the source.

## Assets and licensing

`assets-manifest.json` lists every downloadable asset with its URL, sha256 and licence. All of them
are CC0 from [Poly Haven](https://polyhaven.com/). The binaries are deliberately not committed, so
the skill stays small enough to copy around; `npm run fetch-assets` skips any file whose hash
already matches and refuses to write a file whose hash does not.

Runtime dependencies are `three`, `suncalc` and `vite`. `@playwright/test` is a dev dependency for
the smoke test only.
