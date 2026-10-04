# B2-11F v6 SketchUp-Calibrated Empty Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild B2-11F v6 as an empty-shell interactive Three.js apartment whose 3D topology comes from `1004.skp` and whose confirmed dimensions are calibrated against CAD/PDF evidence.

**Architecture:** Preserve the uploaded SketchUp model as source evidence, extract its architectural geometry into an intermediate manifest/GLB, classify and remove non-architectural contents, then apply explicit CAD/PDF calibration constraints before producing the viewer asset. The viewer loads the calibrated architecture as fixed geometry; it no longer synthesizes the apartment walls from hand-authored wall segments.

**Tech Stack:** SketchUp/OpenSKP conversion, GLB/glTF, Three.js/Vite, Node.js tests, GitHub Actions/Pages.

**Spec:** Approved in conversation on 2026-10-04: CAD/PDF dimensions take priority; SketchUp shapes/topology take priority; v6 remains an empty shell.

## Global Constraints

- Source model: `1004.skp`, SketchUp 2024, model unit meters.
- Geometry precedence: CAD/PDF confirmed dimensions > SketchUp numeric dimensions.
- Shape/topology precedence: SketchUp > inferred/manual v5 geometry.
- Confirmed W3: 2.680 m wide x 1.900 m high, sill +0.500 m, head +2.400 m; horizontal split 0.790 + 1.100 + 0.790 m; vertical split 0.800 + 1.100 m.
- Confirmed floor-to-floor height: 3.300 m.
- Empty-shell output excludes movable furniture, system cabinets/wardrobes, refrigerator, beds, sofas, tables/chairs and decoration.
- Preserve architectural walls, structural elements, openings/window frames, balcony, shafts and fixed bathroom fixtures.
- Do not publish the original SKP, CAD or PDF source files to public GitHub Pages.
- v5 remains available in git history; v6 is a new architecture asset path, not another manual wall patch.

## Review Focus

- SketchUp component/group transforms, including nested instances, must survive conversion without mirrored or displaced geometry.
- Model-unit conversion must remain meters end-to-end and be checked against W3 and 3.300 m height anchors.
- Furniture filtering must not accidentally remove structural millwork-like geometry or retain system cabinets/refrigerator.
- CAD/PDF calibration must be explicit and traceable; unconfirmed dimensions remain marked inferred rather than silently invented.
- Mobile/browser rendering must load the calibrated GLB without console errors and without reintroducing v5 wall synthesis.

---

### Task 1: Source Evidence and SKP Extraction Contract

**Files:**
- Create: `tools/v6/extract-skp.mjs`
- Create: `case-v6/evidence/source-inventory.json`
- Create: `case-v6/evidence/skp-manifest.json`
- Test: `viewer/tests/v6-source.test.mjs`

**Interfaces:**
- Consumes: local `1004.skp` source during build/preparation only.
- Produces: `extractSketchUp(inputPath, outputDir)` and a manifest containing units, bounds, groups/components, materials and transform hierarchy.

- [ ] Write failing tests requiring meters, non-empty geometry, finite bounds and preserved nested transforms.
- [ ] Run tests and verify failure because v6 extraction artifacts do not exist.
- [ ] Implement SKP extraction using a parser/converter that supports SketchUp 2024; never commit the original SKP.
- [ ] Run source tests and verify PASS.
- [ ] Commit extraction contract and evidence manifest.

### Task 2: Empty-Shell Classification

**Files:**
- Create: `tools/v6/classify-empty-shell.mjs`
- Create: `case-v6/evidence/classification.json`
- Test: `viewer/tests/v6-empty-shell.test.mjs`

**Interfaces:**
- Consumes: `skp-manifest.json`.
- Produces: `classifyNode(node) -> architecture | fixed-fixture | excluded | review` and an auditable node classification list.

- [ ] Write failing tests for required retained/excluded categories and no unresolved furniture-like nodes in final output.
- [ ] Run and verify RED.
- [ ] Implement classification using SketchUp names/layers/components plus geometry heuristics only where names are insufficient; ambiguous nodes go to `review`.
- [ ] Resolve review nodes against the model thumbnail/source evidence, recording rationale.
- [ ] Run tests and verify PASS.
- [ ] Commit classification evidence.

### Task 3: CAD/PDF Calibration Constraints

**Files:**
- Create: `case-v6/calibration.json`
- Create: `tools/v6/calibrate-architecture.mjs`
- Test: `viewer/tests/v6-calibration.test.mjs`

**Interfaces:**
- Consumes: classified SketchUp architecture and known CAD/PDF anchors.
- Produces: `calibrateArchitecture(scene, constraints) -> calibratedScene` with per-constraint provenance/status.

- [ ] Write failing tests pinning floor height 3.300 m and W3 dimensions/sill/head/grid exactly.
- [ ] Run and verify RED.
- [ ] Encode only evidence-backed CAD/PDF constraints; mark other measurements `skp` or `inferred`.
- [ ] Implement calibration without globally distorting unrelated rooms.
- [ ] Run calibration tests and verify PASS.
- [ ] Commit calibration data and logic.

### Task 4: Build the v6 Architectural GLB

**Files:**
- Create: `tools/v6/build-v6-glb.mjs`
- Create: `viewer/public/v6/b2-11f-empty-shell.glb`
- Create: `case-v6/model.json`
- Test: `viewer/tests/v6-glb.test.mjs`

**Interfaces:**
- Consumes: calibrated architecture and classification.
- Produces: optimized `b2-11f-empty-shell.glb` plus metadata linking GLB nodes back to evidence IDs.

- [ ] Write failing tests requiring valid GLB, expected architectural categories, W3 anchor node and absence of excluded furniture categories.
- [ ] Run and verify RED.
- [ ] Export calibrated architecture to GLB with stable node IDs/material roles.
- [ ] Validate bounds, triangle counts and evidence mapping.
- [ ] Run tests and verify PASS.
- [ ] Commit generated v6 runtime asset and metadata, excluding private source files.

### Task 5: Switch Viewer Architecture to v6 GLB

**Files:**
- Create: `viewer/src/v6-architecture.js`
- Modify: `viewer/src/app.js`
- Modify: `viewer/src/views.js`
- Test: `viewer/tests/v6-viewer.test.mjs`

**Interfaces:**
- Consumes: `/v6/b2-11f-empty-shell.glb`.
- Produces: `loadV6Architecture(scene) -> {root,bounds,colliders,rooms,evidence}`.

- [ ] Write failing tests proving v6 does not call the v5 manual wall-shell generator for apartment geometry.
- [ ] Run and verify RED.
- [ ] Add GLTFLoader-based fixed architecture loader and derive camera bounds/colliders from v6 geometry.
- [ ] Keep Orbit/Top/Axonometric/Inside/Walk, measure and photo features operating on the new architecture.
- [ ] Run tests and verify PASS.
- [ ] Commit viewer integration.

### Task 6: White-Model Geometry Gate

**Files:**
- Create: `viewer/scripts/v6-smoke.mjs`
- Create: `docs/validation/v6-white-model-ledger.md`
- Modify: `.github/workflows/v5-ci.yml` or create focused `.github/workflows/v6-ci.yml`

**Interfaces:**
- Consumes: v6 viewer build.
- Produces: desktop/mobile screenshots and geometry QA receipt.

- [ ] Add browser checks for first frame, all camera modes, no console errors, full-height walls, W3 location/opening, balcony and bathroom visibility.
- [ ] Add screenshots for axonometric, top and inside views.
- [ ] Run browser QA and inspect images against SketchUp topology and CAD/PDF anchors.
- [ ] Record confirmed/inferred/unverified findings; do not call the model construction/BIM accurate.
- [ ] Commit the white-model QA receipt.

### Task 7: v6 Presentation and Safe Publication

**Files:**
- Modify: `case-v6/style.json` or equivalent v6 material mapping.
- Modify: GitHub Pages publication workflow as needed.
- Test: browser smoke + publication safety tests.

**Interfaces:**
- Consumes: approved white-model geometry.
- Produces: warm neutral empty-shell v6 site on GitHub Pages.

- [ ] Write tests that source SKP/PDF/CAD files are absent from publish output.
- [ ] Run and verify RED if publication path is not yet v6-safe.
- [ ] Apply restrained warm-white/light-oak/tile/glass material roles without changing calibrated geometry.
- [ ] Build and run full desktop/mobile smoke suite.
- [ ] Publish only after all v6 QA is green and verify the live Pages URL.
- [ ] Commit release output and validation receipt.
