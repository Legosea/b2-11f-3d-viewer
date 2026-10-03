# Source inputs

The authoritative B2-11F plan and the user-supplied visual reference are retained in the user's source files and identified here by SHA-256 in `case/evidence/input-inventory.json`.

The connected GitHub mutation interface used for this build writes UTF-8 repository files but does not accept local binary bytes. Therefore the original PDF/JPEG are not duplicated into this repository. The compact PDF-vector registration evidence needed by the viewer is preserved under `case/evidence/`, and `tools/extract-b2-plan.py` regenerates the full vector extract when the original PDF is materialized at:

`case/inputs/plan/2024-07-14-Model(1).pdf`
