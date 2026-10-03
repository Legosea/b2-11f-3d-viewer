# v5 native execution ledger

Plan: docs/superpowers/plans/2026-10-03-b2-11f-v5-implementation.md

- Isolation: implementation is on branch `feature/b2-v5-native`; `main` remains the live v4 site until final publish.
- Ruling: container network access cannot resolve github.com, so local clone/worktree setup is blocked by the execution environment. Source mutation uses the connected GitHub repository and verification uses GitHub Actions on the isolated feature branch. Cost if wrong: final browser behavior still requires a live deployment smoke check before main is updated.
- Ruling: initial B2 case JSON was authored before the characterization tests because the geometry was first reconstructed from the user PDF and W3 measurement. The added tests are regression gates, not proof that the initial authoring followed strict RED→GREEN. Cost if wrong: a geometry misunderstanding could pass if the assertions encode the same misunderstanding; top-view overlay/manual inspection remains mandatory.

- Ruling: the plan proposed adding `pngjs` only to measure screenshot luminance. v5 uses the already-required Playwright Chromium to read the PNG into a canvas and keeps a dependency-free pure luminance helper for unit testing. This satisfies the overexposure guard without package-lock churn. Cost if wrong: the luminance CLI depends on Chromium being installed in the browser-QA job.

- Debugging finding: the first browser artifact proved the review overlay object existed but its linework was invisible. Root cause was twofold: the review plane sat at y=0.018 inside the 140 mm floor slab, and the SVG viewBox (11.75 × 6.85 m) was larger than the shell bounds (11.3513 × 5.9487 m), so even a visible overlay would have been scaled out of registration. Fix: expose the finished-floor surface elevation from shell.js, place the overlay 12 mm above it, and make the SVG viewBox exactly match the shell bounds. Cost if wrong: top-view source registration could still be visually mirrored; full browser QA must inspect the regenerated top-overlay screenshot before publish.
