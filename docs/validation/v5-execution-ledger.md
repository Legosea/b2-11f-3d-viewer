# v5 native execution ledger

Plan: docs/superpowers/plans/2026-10-03-b2-11f-v5-implementation.md

- Isolation: implementation is on branch `feature/b2-v5-native`; `main` remains the live v4 site until final publish.
- Ruling: container network access cannot resolve github.com, so local clone/worktree setup is blocked by the execution environment. Source mutation uses the connected GitHub repository and verification uses GitHub Actions on the isolated feature branch. Cost if wrong: final browser behavior still requires a live deployment smoke check before main is updated.
- Ruling: initial B2 case JSON was authored before the characterization tests because the geometry was first reconstructed from the user PDF and W3 measurement. The added tests are regression gates, not proof that the initial authoring followed strict RED→GREEN. Cost if wrong: a geometry misunderstanding could pass if the assertions encode the same misunderstanding; top-view overlay/manual inspection remains mandatory.
