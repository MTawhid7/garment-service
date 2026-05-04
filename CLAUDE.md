# CLAUDE.md — Garment Service

This file is read by Claude Code at the start of every session. It captures decisions, constraints, and operational knowledge that are not derivable from reading the code.

---

## What this project is

A standalone FastAPI service for parametric garment pattern generation and (planned) physics simulation. It is a clean extraction of the essential pipeline from the upstream [GarmentCode](https://github.com/maria-korosteleva/GarmentCode) research repository.

- **Phase 1** (complete): `POST /generate` → specification JSON, rendered in full 3D via a Next.js frontend app.
- **Phase 2** (stub): `POST /simulate` → async job → GLB 3D mesh + PNGs

---

## How to start the service

Always run from the project root. The conda env is `garmentcode`.

```bash
# Terminal 1: Backend
cd /Users/tawhid/Documents/garment-service
conda activate garmentcode
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"   # macOS only
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd /Users/tawhid/Documents/garment-service/frontend
npm run dev
```

Interactive API docs: `http://localhost:8000/docs`
Frontend app: `http://localhost:3000`

---

## Key files and what they own

| File | Responsibility |
|---|---|
| `app/main.py` | FastAPI app, all endpoints, Phase 2 job queue wiring |
| `app/models.py` | All Pydantic types for Phase 1 and Phase 2 |
| `app/config.py` | Pydantic Settings — paths configured via env vars |
| `app/pipeline/pattern.py` | Pattern generation: merge overrides → MetaGarment → SVG + spec |
| `app/pipeline/sim.py` | Simulation stub: raises NotImplementedError until Phase 2 |
| `frontend/` | Next.js 3D visualizer using React Three Fiber |
| `frontend/src/lib/` | Pure math: Edge tessellation & CGAL/Maya-equivalent 3D Euler transforms |
| `assets/garment_programs/meta_garment.py` | Entry point for garment assembly |
| `assets/design_params/default.yaml` | Full parameter schema and defaults |
| `pygarment/` | DSL core, mesh generation, simulation engine (copied from GarmentCode) |

---

## Constraints that are easy to break accidentally

**1. Python 3.9 compatibility — no `X | None` syntax**

The conda env runs Python 3.9. Use `Optional[X]` from `typing` instead of `X | None`.
Pydantic v2 in 3.9 cannot evaluate the union pipe syntax at annotation time, even with `from __future__ import annotations`.

```python
# Wrong (breaks on 3.9 with Pydantic v2)
completed_at: datetime | None = None

# Correct
from typing import Optional
completed_at: Optional[datetime] = None
```

**2. `assets/` import paths are absolute and cannot be reorganised**

All 14 files in `assets/garment_programs/` import each other using absolute paths anchored at the project root:

```python
from assets.garment_programs.meta_garment import MetaGarment  # correct
from assets.bodies.body_params import BodyParameters           # correct
```

Renaming or moving `assets/`, `assets/garment_programs/`, or `assets/bodies/` will break every import in the garment program files without a full find-replace across all of them.

**3. Service must be started from the project root**

Python's import system resolves `assets.*` and `pygarment.*` relative to CWD. If `uvicorn` is started from a subdirectory, all imports fail.

**4. `DYLD_LIBRARY_PATH` is required on macOS**

The native geometry libraries (CGAL, libigl) are installed in Homebrew. Without this export, `import pygarment` fails at runtime on macOS.

---

## Testing a change to pattern generation

```bash
# Smoke test: FittedShirt + PencilSkirt
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"design": {"meta": {"upper": {"v": "FittedShirt"}, "bottom": {"v": "PencilSkirt"}}}}' \
  | python3 -c "import json,sys; r=json.load(sys.stdin); print('panels:', r['panels'])"

# Expected: panels: 6

# Error case: both null → 422
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"design": {"meta": {"upper": {"v": null}, "bottom": {"v": null}}}}' \
  | python3 -m json.tool
```

---

## Activating Phase 2 (simulation)

Phase 2 requires the custom NVIDIA Warp fork. Standard `pip install warp-lang` will not work — it lacks `add_cloth_mesh_sewing_spring()` and `replace_mesh_points()`.

```bash
git clone https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode
pip install -e /path/to/NvidiaWarp-GarmentCode
python -c "from pygarment.meshgen.simulation import run_sim; print('warp ok')"
```

Once Warp is verified, implement `app/pipeline/sim.py` using the call sequence:

```
spec_path
  → BoxMesh(spec_path, resolution).load()
  → BoxMesh.serialize(paths)          # writes boxmesh.obj + orig_lens.pickle
  → run_sim(name, props, paths)       # XPBD draping, writes sim.obj
  → render_images(paths, ...)         # writes render_front.png, render_back.png
```

`PathCofig` (note the upstream typo) from `pygarment.meshgen.sim_config` manages all file path construction. Pass `add_timestamp=False` since job IDs already provide uniqueness.

---

## The `_DEFAULT_DESIGN` module-level singleton

`app/pipeline/pattern.py` loads the full design schema from `assets/design_params/default.yaml` once at module import time. This dict is read by `app/main.py`'s `/schema` and `/garment-types` endpoints.

If you add new garment types to `assets/garment_programs/`, you must also add them to `assets/design_params/default.yaml` → `design.meta.upper.range` / `design.meta.bottom.range` / `design.meta.wb.range`, then restart the service.

---

## Configuration via environment variables

All path settings have an `GARMENT_` prefix and can be set in `.env` or the shell environment. See `app/config.py` for the full list and `Settings.body_path` / `Settings.design_params_path` / `Settings.sim_props_dir` computed properties.
