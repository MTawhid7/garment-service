# Garment Service

A clean FastAPI backend for parametric sewing pattern generation and physics-based garment simulation. Built on the [GarmentCode](https://github.com/maria-korosteleva/GarmentCode) DSL (SIGGRAPH Asia 2023).

---

## What it does

**Phase 1 (active):** Accept a JSON description of a garment's design parameters and return:
- An SVG sewing pattern ready to display or print
- A structured specification JSON describing every panel, edge, and stitch

**Phase 2 (planned):** Queue a physics draping simulation using the same input and return:
- A GLB 3D mesh of the draped garment
- Front and back render PNGs

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.9+ | Tested on 3.9 (conda `garmentcode` env) |
| conda | any | Recommended over venv for native dependency management |
| Homebrew | macOS only | `brew install cairo` needed for SVG rendering |

All Python packages listed in `pyproject.toml` must be installed in the same environment as the GarmentCode dependencies (`numpy`, `scipy`, `cgal`, `libigl`, `pyrender`, `CairoSVG`, etc.).

---

## Setup

### 1. Clone and enter the project

```bash
cd /path/to/Documents/garment-service
```

### 2. Activate the conda environment

```bash
conda activate garmentcode
```

If you don't have the environment yet, create it and install the GarmentCode dependencies first by following the [GarmentCode setup instructions](https://github.com/maria-korosteleva/GarmentCode), then return here.

### 3. Install the service package

```bash
pip install -e .
```

This installs `app/`, `pygarment/`, and `assets/` as editable packages so uvicorn can resolve imports from any working directory.

### 4. (Optional) Configure paths

Copy `.env.example` to `.env` and adjust if your paths differ from the defaults:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `GARMENT_ASSETS_PATH` | `assets` | Path to the assets directory |
| `GARMENT_BODY_YAML` | `bodies/mean_all.yaml` | Body measurements file (relative to assets) |
| `GARMENT_OUTPUT_DIR` | `outputs` | Where simulation results are written |

---

## Running the service

```bash
# macOS — DYLD_LIBRARY_PATH is required for the native geometry libraries
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The service must be started from the project root (`garment-service/`) so that relative asset paths resolve correctly.

Interactive API docs are available at `http://localhost:8000/docs`.

---

## API reference

### `GET /`
Health check.

```json
{"status": "ok", "version": "0.1.0"}
```

---

### `GET /schema`
Full design parameter schema — all keys, types, value ranges, and defaults. Use this to discover what can be sent to `/generate`.

---

### `GET /garment-types`
Lists the available garment class names for each slot.

```json
{
  "upper":  ["FittedShirt", "Shirt", null],
  "bottom": ["SkirtCircle", "AsymmSkirtCircle", "GodetSkirt", "Pants",
             "Skirt2", "SkirtManyPanels", "PencilSkirt", "SkirtLevels", null],
  "wb":     ["StraightWB", "FittedWB", null]
}
```

---

### `POST /generate`
Generate a sewing pattern. Send only the parameters you want to change; everything else falls back to `assets/design_params/default.yaml`.

**Request body:**
```json
{
  "design": {
    "meta": {
      "upper":  {"v": "FittedShirt"},
      "bottom": {"v": "PencilSkirt"}
    },
    "shirt": {
      "length": {"v": 1.6}
    }
  },
  "body": {}
}
```

Both `design` and `body` are optional — an empty `{}` body uses all defaults. At least one of `meta.upper` or `meta.bottom` must be set to a non-null garment type.

**Response:**
```json
{
  "svg":     "<svg ...>...</svg>",
  "spec":    { "pattern": { "panels": {...}, "stitches": [...] }, "properties": {...} },
  "panels":  6,
  "warnings": []
}
```

**Errors:**
- `422` — parameters produce an empty pattern (both `meta.upper` and `meta.bottom` are null)
- `500` — internal assembly error

---

### `POST /simulate` *(Phase 2 — not yet active)*
Queue a physics simulation job. Returns immediately with a `job_id`.

**Response:** `202 Accepted`
```json
{"job_id": "uuid", "status": "queued", "created_at": "..."}
```

---

### `GET /jobs/{job_id}` *(Phase 2 — not yet active)*
Poll simulation job status.

```json
{
  "job_id": "uuid",
  "status": "done",
  "outputs": {
    "glb":          "/outputs/{job_id}/generated_sim.glb",
    "render_front": "/outputs/{job_id}/render_front.png",
    "render_back":  "/outputs/{job_id}/render_back.png"
  }
}
```

---

### `GET /outputs/{job_id}/{filename}` *(Phase 2 — not yet active)*
Download a simulation output file (GLB, OBJ, or PNG).

---

## Example: generate a pattern with curl

```bash
curl -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {
        "upper":  {"v": "FittedShirt"},
        "bottom": {"v": "PencilSkirt"}
      }
    }
  }' | python3 -c "import json,sys; r=json.load(sys.stdin); open('pattern.svg','w').write(r['svg'])"
```

Open `pattern.svg` in a browser to view the generated pattern.

---

## Activating Phase 2 (simulation)

Simulation requires a custom NVIDIA Warp fork — the standard `pip install warp-lang` package does **not** include the cloth-specific APIs.

```bash
git clone https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode
pip install -e /path/to/NvidiaWarp-GarmentCode

# Verify:
python -c "import warp; print(warp.__version__)"
python -c "from pygarment.meshgen.simulation import run_sim; print('ok')"
```

Once Warp is installed, implement `app/pipeline/sim.py` following the call sequence documented in that file and in `docs/architecture.md`.

---

## Project layout

```
garment-service/
├── app/
│   ├── main.py          # FastAPI app + all endpoints
│   ├── models.py        # Pydantic request/response types
│   ├── config.py        # Pydantic Settings (env-configurable paths)
│   └── pipeline/
│       ├── pattern.py   # Phase 1: design dict → SVG + spec JSON
│       └── sim.py       # Phase 2: BoxMesh + Warp → GLB (stub)
├── pygarment/           # Core DSL + mesh gen + simulation (copied from GarmentCode)
├── assets/
│   ├── garment_programs/  # 14 Python files defining all garment types
│   ├── bodies/            # Body measurement YAMLs and 3D OBJ meshes
│   ├── design_params/     # default.yaml parameter schema
│   ├── Sim_props/         # Simulation material configs
│   └── Patterns/          # Sample specification JSONs for testing
├── outputs/             # Runtime simulation outputs (gitignored)
├── pyproject.toml
└── .env.example
```

See `docs/architecture.md` for a deeper description of each component and the full data-flow pipeline.

---

## License

The `pygarment/` library and `assets/` content originate from [GarmentCode](https://github.com/maria-korosteleva/GarmentCode) (MIT License). Service code in `app/` is independently authored.
