# Development Roadmap

This document tracks what has been built, what is planned, and the reasoning behind the sequencing.

---

## Phase 1 — Pattern generation (complete)

**Goal:** A clean, fast HTTP endpoint that turns design parameters into a sewing pattern.

**Delivered:**
- `POST /generate` — synchronous, < 1 second, returns SVG + specification JSON
- **3D Frontend Visualizer** — Next.js/Three.js interactive web app showing real-time panel mapping over a 3D body
- `GET /schema` — full design parameter schema from `default.yaml`
- `GET /garment-types` — available garment class names per slot
- `GET /` — health check
- Pydantic Settings for environment-variable-driven configuration
- Python 3.9-compatible type annotations throughout
- `app/models.py` defines both Phase 1 and Phase 2 Pydantic types so no model restructuring is needed when Phase 2 is activated

---

## Phase 2 — Physics simulation (planned)

**Goal:** Accept the same design parameters and return a 3D draped garment (GLB) and front/back render images.

**Why async jobs:**
Simulation runs for 30 seconds to several minutes (up to 2,400 XPBD frames). An async job queue lets the server stay responsive during long simulations and handle multiple concurrent requests gracefully.

**What needs to happen:**

### 2.1 Install the custom NVIDIA Warp fork

Standard `pip install warp-lang` does not expose `add_cloth_mesh_sewing_spring()` or `replace_mesh_points()`, which are required by `pygarment/meshgen/garment.py`.

```bash
git clone https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode
pip install -e /path/to/NvidiaWarp-GarmentCode
python -c "from pygarment.meshgen.simulation import run_sim; print('ok')"
```

### 2.2 Implement `app/pipeline/sim.py`

The call sequence is already documented in `sim.py` and in `docs/architecture.md`. The function signature is defined:

```python
def run_simulation(spec_path, out_dir, sim_config_name) -> Dict[str, Path]:
    # returns {"glb": Path, "render_front": Path, "render_back": Path}
```

Key objects:
- `PathCofig` from `pygarment.meshgen.sim_config` (note upstream typo) — manages all input/output path construction
- `BoxMesh` from `pygarment.meshgen.boxmeshgen` — converts spec JSON to 3D mesh via CGAL Delaunay triangulation
- `run_sim()` from `pygarment.meshgen.simulation` — XPBD cloth simulation

### 2.3 Wire up the endpoints in `app/main.py`

The `POST /simulate` and `GET /jobs/{id}` endpoints already exist and are wired to the background worker. The worker calls `run_simulation()`. Once `sim.py` is implemented, these endpoints will activate automatically.

### 2.4 Test against a known spec JSON

The sample files in `assets/Patterns/` are pre-validated specifications that will exercise the full pipeline without needing pattern generation first:

```bash
# Verify simulation works standalone
python -c "
from pathlib import Path
from app.pipeline.sim import run_simulation
outputs = run_simulation(
    spec_path=Path('assets/Patterns/shirt_mean_specification.json'),
    out_dir=Path('outputs/test_job'),
    sim_config_name='default_sim_props'
)
print(outputs)
"
```

### 2.5 Persist job state (when needed)

The current in-memory `_jobs` dict is lost on restart. Once multi-process deployment or restart resilience is needed, replace it with:
- SQLite via SQLAlchemy (simplest, no extra service)
- Redis (if jobs are also queued across processes)

---

## Phase 3 — Natural language input (future)

**Goal:** Accept a natural-language description of a garment and produce design parameters that can be passed to Phase 1 or Phase 2.

This is intentionally deferred until Phase 2 is stable. The architecture is designed to accommodate it as an additional pre-processing step — the NL layer produces a `design` dict, which is then passed unchanged to `generate_pattern()` or the simulation pipeline.

**Options under consideration:**

| Approach | Pros | Cons |
|---|---|---|
| Claude API (tool use) | Flexible, prompt-engineered constraints, no model training | API cost per request, latency |
| Design2GarmentCode (Qwen2-VL-2B + LoRA) | Local, fast inference | 3.5 GB model weights, requires GPU, iterative refinement harder |
| ChatGarment (LLaVA v1.5-7B + float head) | Accepts images too | 14 GB weights, cluster-specific code, less flexible |

A Claude-based agent with tool use is the most tractable starting point: the design schema from `GET /schema` can be embedded in the system prompt, and a `propose_changes` tool maps the agent's output directly to the `design` override dict for `POST /generate`.

**Suggested endpoint shape:**

```
POST /nl-generate
{
  "prompt":  "A fitted shirt with a V-neck and a flowing circle skirt",
  "current": { ... current design dict for iterative refinement ... }
}
→ same response as POST /generate
```

---

## Phase 4 — Multi-garment and advanced features (future)

Ideas to revisit once the core pipeline is stable:

- **Texture mapping** — apply fabric texture PNGs to the simulated GLB for realistic previews
- **Body diversity** — expose the full body measurement YAML as a structured request field with named presets (mean_female, mean_male, custom)
- **Zipper and closure annotations** — extend the stitch JSON format with a `type` field (`seam`, `zipper`, `button`) to support downstream CAD export
- **Streaming SVG** — use Server-Sent Events to stream the SVG incrementally as panels are assembled, reducing perceived latency for complex garments
- **Export formats** — DXF for CAD systems, PDF with seam allowances for print-ready patterns
- **Batch generation** — `POST /batch/generate` accepting an array of design overrides, running pattern generation in a thread pool

---

## Dependency notes

| Dependency | Status | Notes |
|---|---|---|
| `pygarment` (DSL + mesh gen) | Copied, stable | All edits own our copy; sync with upstream manually when needed |
| `fastapi`, `uvicorn` | pip, stable | No known conflicts |
| `cgal`, `libigl` | conda/pip, stable | Require `DYLD_LIBRARY_PATH` on macOS |
| `CairoSVG` | pip, stable | Requires system Cairo (`brew install cairo`) |
| NVIDIA Warp (custom fork) | Not yet installed | Required for Phase 2 only |
| `pyrender` | pip, stable | Requires EGL on Linux headless servers |
