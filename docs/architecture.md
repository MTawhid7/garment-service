# Architecture

This document describes the internal structure of `garment-service`, the data flow through each stage of the pipeline, and the design decisions behind the current layout.

---

## High-level overview

`garment-service` is a FastAPI application that wraps a two-stage garment pipeline:

```
Client
  │
  ▼
POST /generate  ──────────────────────────────────── synchronous, < 1 second
  │   app/pipeline/pattern.py
  │   MetaGarment.assembly() → VisPattern → SVG + spec JSON
  │
  ▼ (Frontend 3D Visualizer)
  │   frontend/src/lib/panelGeometry.ts
  │   JSON → curve tessellation → earcut triangulation → React Three Fiber
  │
  ▼ (Phase 2 - Simulation)
POST /simulate  ──────────────────────────────────── returns job_id immediately
  │   app/main.py  asyncio.Queue → background worker
  │   app/pipeline/sim.py
  │   BoxMesh + Warp XPBD → GLB + PNGs
  ▼
GET  /jobs/{id} ──────────────────────────────────── poll for status + results
GET  /outputs/{id}/{file}  ─────────────────────────── download GLB / PNG
```

---

## Directory structure

```
garment-service/
│
├── app/                          Service code (owned by this project)
│   ├── main.py                   FastAPI app, all endpoint handlers,
│   │                             Phase 2 job queue wiring
│   ├── models.py                 All Pydantic request/response types
│   │                             (Phase 1 and Phase 2 defined together)
│   ├── config.py                 Pydantic Settings — all paths are
│   │                             configurable via GARMENT_* env vars
│   └── pipeline/
│       ├── pattern.py            Phase 1 pipeline:
│       │                           design overrides → MetaGarment
│       │                           → SVG + specification JSON
│       └── sim.py                Phase 2 pipeline (stub):
│                                   spec JSON → BoxMesh → Warp → GLB
│
├── frontend/                     Next.js 3D Visualizer (React Three Fiber)
│   ├── src/app/                  Next.js App Router (page layout)
│   ├── src/components/           UI controls & GarmentViewer 3D scene
│   ├── src/hooks/                State machine for fetching/generating
│   ├── src/services/             API layer (calls FastAPI backend)
│   └── src/lib/                  Pure math geometry pipeline:
│       ├── edgeTessellator.ts    Curves → polyline vertices
│       └── panelGeometry.ts      earcut + Maya XYZ Euler → 3D mesh
│
├── pygarment/                    Core library (copied from GarmentCode)
│   ├── garmentcode/              Pattern DSL
│   │   ├── component.py          Base class for garment components
│   │   ├── panel.py              2D panel (polygon with curved edges)
│   │   ├── edge.py               Edge types: straight, curve, circle arc
│   │   ├── connector.py          StitchingRule: matches + subdivides edges
│   │   ├── interface.py          Named edge groups for connecting components
│   │   └── params.py             BodyParametrizationBase, DesignSampler
│   ├── pattern/
│   │   ├── core.py               BasicPattern: spec dict ↔ JSON file
│   │   └── wrappers.py           VisPattern: SVG/PNG/PDF export, get_svg()
│   └── meshgen/                  Mesh generation and simulation
│       ├── boxmeshgen.py         BoxMesh: CGAL Delaunay triangulation,
│       │                           stitch vertex collapsing, OBJ export
│       ├── garment.py            Cloth: NVIDIA Warp cloth model,
│       │                           XPBD integrator, frame stepping
│       ├── simulation.py         run_sim(): orchestrates BoxMesh → Cloth
│       │                           → equilibrium → render
│       ├── sim_config.py         PathCofig (path management),
│       │                           SimConfig (material parameters)
│       └── render/
│           └── pythonrender.py   render_images(): pyrender scene → PNGs
│
├── assets/                       Data and garment program library
│   ├── garment_programs/         14 Python files defining all garment types.
│   │   ├── meta_garment.py       Assembles upper + waistband + bottom.
│   │   ├── base_classes.py       Abstract bases: BaseBodicePanel, BaseBottoms
│   │   ├── bodice.py             Fitted and regular shirt bodies
│   │   ├── tee.py                T-shirt body
│   │   ├── sleeves.py            Sleeve variants
│   │   ├── collars.py            Collar variants
│   │   ├── bands.py              Waistband and cuff bands
│   │   ├── pants.py              Trousers
│   │   ├── skirt_paneled.py      Multi-panel skirts
│   │   ├── circle_skirt.py       Circle and asymmetric skirts
│   │   ├── skirt_levels.py       Tiered skirts
│   │   ├── godet.py              Godet skirt
│   │   └── shapes.py             Geometric primitive helpers
│   ├── bodies/                   Body measurement files
│   │   ├── body_params.py        BodyParameters class (loads YAML, evaluates
│   │   │                           derived measurements: bust_line, waist_level…)
│   │   ├── mean_all.yaml         Default body (171 cm, average measurements, cm)
│   │   ├── mean_all.obj          3D body mesh for simulation placement
│   │   └── [other body variants] mean_female, mean_male, SMPL-based
│   ├── design_params/
│   │   └── default.yaml          Full parameter schema: every key, type,
│   │                               value range, and default
│   ├── Sim_props/                Simulation material presets
│   │   ├── default_sim_props.yaml  max_sim_steps: 2400, spring_ke: 50 000
│   │   └── [other presets]       mid_bending, minimal_bending, soft_ochra…
│   └── Patterns/                 Sample specification JSONs (testing)
│
└── outputs/                      Runtime: per-job subdirectories written here
```

---

## Phase 1 data flow — Pattern generation

```
POST /generate
{
  "design": { "meta": { "upper": {"v": "FittedShirt"}, "bottom": {"v": "PencilSkirt"} } },
  "body":   {}
}
```

### Step 1 — Merge overrides into schema
`app/pipeline/pattern.py :: generate_pattern()`

`_merge(user_overrides, deepcopy(_DEFAULT_DESIGN))` walks the nested schema dict
and copies only `"v"` values. Keys not present in the override are left unchanged.
`_sync_left()` mirrors right-side parameters into the left side when asymmetry is disabled.

### Step 2 — Resolve body parameters
`BodyParameters(mean_all.yaml).eval_dependencies()`

Computes derived measurements from raw anthropometric inputs:
`_waist_level`, `_bust_line`, `_hip_inclination`, `_armscye_depth`, `_leg_length`.

### Step 3 — Assemble garment
`MetaGarment("generated", body, design).assembly()`

`MetaGarment` selects garment classes from `globals()` using the `meta.upper`, `meta.bottom`, and `meta.wb` values. Each component (e.g. `FittedShirt`, `PencilSkirt`) builds its panels and stitching rules. The final `Stitches.assembly()` produces the stitch list that becomes part of the specification JSON.

Raises `pyg.EmptyPatternError` if both upper and bottom are null.

### Step 4 — Export SVG
`pattern.get_svg(tmp_path, with_text=False, view_ids=False, flat=False, margin=0)`

Renders panel outlines as an SVG. Stitch information is not included in the SVG — it exists only in the specification JSON.

### Step 5 — Return response
`pattern.spec` is the live specification dict (same structure as `*_specification.json`):

```json
{
  "pattern": {
    "panels":      { "<name>": { "vertices": [...], "edges": [...], "translation": [...] } },
    "stitches":    [ [{"panel": "...", "edge": 0}, {"panel": "...", "edge": 1}], ... ],
    "panel_order": [...]
  },
  "parameters": {},
  "properties":  { "units_in_meter": 100, "curvature_coords": "relative" }
}
```

### Step 6 — Frontend 3D rendering
`frontend/src/lib/panelGeometry.ts`

The Next.js app consumes the specification JSON directly:
1. **Edge Tessellation:** Converts relative cubic/quadratic Beziers and SVG arcs into dense polyline points.
2. **Triangulation:** Uses `earcut` to convert the 2D panel outline into triangle indices.
3. **3D Transform:** Applies the Maya intrinsic XYZ Euler rotation and translation metadata to position panels around the 3D body.
4. **Scale:** Converts coordinates from cm to meters (Three.js standard).
5. **Render:** Hands the resulting `Float32Array` buffers to `React Three Fiber` for real-time visualization over the `mean_all.obj` body mesh.

---

## Phase 2 data flow — Simulation

*Not yet implemented. The endpoints exist; `app/pipeline/sim.py` raises `NotImplementedError`.*

### Call sequence (from `test_garment_sim.py` in the upstream repo)

```
spec_path  →  BoxMesh(spec_path, resolution_scale)
                .load()           # parse JSON, CGAL triangulation per panel,
                                  # stitch vertex collapsing, spring rest lengths
                .serialize(paths) # writes: boxmesh.obj, segmentation.txt,
                                  #         orig_lens.pickle, vertex_labels.yaml
           →  run_sim(name, props, paths)
                # Creates Cloth (Warp XPBD model with sewing springs)
                # Runs frame loop until static equilibrium or max_sim_steps (2400)
                # Writes: sim.obj, sim.glb
                # Calls render_images() → render_front.png, render_back.png
```

### Warp dependency

`run_sim()` calls `wp.sim.add_cloth_mesh_sewing_spring()` and `wp.sim.replace_mesh_points()` — APIs added only to the custom fork at `github.com/maria-korosteleva/NvidiaWarp-GarmentCode`. Standard `pip install warp-lang` will raise `AttributeError`.

### Job queue design

`app/main.py` maintains an `asyncio.Queue` and a single background `asyncio.Task` (`_simulation_worker`). Simulation runs in a thread pool executor (blocking, CPU-bound) while the event loop remains free to serve other requests.

Job state is held in memory (`_jobs: Dict[str, JobResult]`). Upgrade to Redis or a database when persistence across restarts is needed.

---

## Configuration

`app/config.py` uses Pydantic Settings. All values are read from environment variables with the `GARMENT_` prefix or from a `.env` file:

| Setting | Env var | Default | Used by |
|---|---|---|---|
| `assets_path` | `GARMENT_ASSETS_PATH` | `assets` | Both phases |
| `body_yaml` | `GARMENT_BODY_YAML` | `bodies/mean_all.yaml` | Phase 1 |
| `output_dir` | `GARMENT_OUTPUT_DIR` | `outputs` | Phase 2 |

Computed properties (`body_path`, `design_params_path`, `sim_props_dir`) derive from these three settings.

---

## Critical constraints

### `assets/` import paths are hard-coded absolute

All files under `assets/garment_programs/` import from each other using root-anchored paths:

```python
from assets.garment_programs.base_classes import BaseBodicePanel
from assets.garment_programs.sleeves import Sleeve
```

The `assets/` directory cannot be renamed or moved without a full find-replace across all 14 garment program files.

### CWD must be the project root

`uvicorn` must be launched from `garment-service/`. Both the `assets.*` import resolution and all relative path defaults in `app/config.py` depend on this.

### Python 3.9 compatibility

The conda environment runs Python 3.9. The `X | None` union syntax was introduced in Python 3.10. Use `Optional[X]` from `typing` for any nullable field in Pydantic models or type annotations.

### macOS dynamic library path

```bash
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"
```

Required on macOS before importing `pygarment`. The CGAL and libigl native extensions link against Homebrew-installed libraries.
