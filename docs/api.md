# Garment Service API Reference

Complete reference for every HTTP endpoint exposed by the FastAPI backend. All examples use `curl`; the interactive Swagger UI is available at `http://localhost:8000/docs`.

---

## Contents

1. [Overview](#1-overview)
2. [Base URL and CORS](#2-base-url-and-cors)
3. [Static file mounts](#3-static-file-mounts)
4. [Endpoint reference](#4-endpoint-reference)
   - [GET /](#get-)
   - [GET /schema](#get-schema)
   - [GET /garment-types](#get-garment-types)
   - [POST /generate](#post-generate)
   - [POST /simulate](#post-simulate)
   - [GET /jobs/{job_id}](#get-jobsjob_id)
5. [Data models](#5-data-models)
6. [Error responses](#6-error-responses)
7. [Configuration reference](#7-configuration-reference)
8. [End-to-end examples](#8-end-to-end-examples)

---

## 1. Overview

The service exposes two operational phases:

| Phase | Endpoints | Status |
|---|---|---|
| **Phase 1 — Pattern generation** | `POST /generate` | Active |
| **Phase 2 — Physics simulation** | `POST /simulate`, `GET /jobs/{id}` | Stubbed (requires Warp fork) |

**Phase 1** is synchronous and returns in under a second. It takes a partial set of design parameter overrides, merges them with the full default schema, assembles the garment using the `MetaGarment` class, and returns an SVG document and a specification JSON dict.

**Phase 2** is asynchronous. It first runs Phase 1 internally to produce the specification JSON, then enqueues a XPBD cloth simulation job. The caller receives a `job_id` immediately and polls `GET /jobs/{job_id}` for completion and output download URLs.

---

## 2. Base URL and CORS

```
http://localhost:8000
```

The service permits cross-origin requests from the following origins (hardcoded in `app/main.py`):

| Origin | Purpose |
|---|---|
| `http://localhost:3000` | Next.js frontend dev server |
| `http://localhost:8000` | Same-host requests |

All HTTP methods and headers are permitted from these origins. Requests from other origins will receive a `403` response.

---

## 3. Static file mounts

Two directory trees are served as static files alongside the API endpoints.

### `/outputs/{job_id}/{filename}`

Files written by Phase 2 simulation jobs.

| Key in `JobResult.outputs` | Filename | Description |
|---|---|---|
| `glb` | `sim.glb` | Draped 3D garment mesh (GLTF Binary) |
| `render_front` | `render_front.png` | Front-view render |
| `render_back` | `render_back.png` | Back-view render |

These paths are constructed automatically by the background worker and placed in `JobResult.outputs` once status is `done`.

Source directory: controlled by `GARMENT_OUTPUT_DIR` environment variable (default: `outputs/`).

### `/bodies/{filename}`

Static body measurement and mesh files from `assets/bodies/`. Used by the Next.js frontend to load the 3D body mesh (`mean_all.obj`) for panel overlay.

Example: `GET /bodies/mean_all.obj`

---

## 4. Endpoint reference

---

### `GET /`

**Health check.**

Returns the service version and confirms the server is running.

#### Response

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

#### Example

```bash
curl http://localhost:8000/
```

---

### `GET /schema`

**Full design parameter schema.**

Returns the complete design parameter dictionary loaded from `assets/design_params/default.yaml` at startup. Every configurable parameter is represented as a leaf node with three fields:

```json
"<parameter_name>": {
  "v":     <current default value>,
  "range": <allowed range or list of options>,
  "type":  "<float|int|bool|select|select_null>"
}
```

This schema is the authoritative list of what can be sent to `POST /generate`. The frontend uses it to build its parameter controls; you can use it to discover the full set of options without reading the YAML file.

#### Response

A nested JSON object. Top-level keys: `meta`, `shirt`, `collar`, `sleeve`, `waistband`, `pencil-skirt`, `skirt`, `flare-skirt`, `godet-skirt`, `levels-skirt`, `pants`, `left`.

#### Example

```bash
curl http://localhost:8000/schema | python3 -m json.tool | head -60
```

---

### `GET /garment-types`

**Available garment type names for each assembly slot.**

Returns the allowed string values for `meta.upper`, `meta.bottom`, and `meta.wb`. Useful for populating dropdowns without parsing the full schema.

#### Response

```json
{
  "upper":  ["FittedShirt", "Shirt", null],
  "bottom": ["PencilSkirt", "SkirtCircle", "AsymmSkirtCircle", "Skirt2",
             "SkirtManyPanels", "GodetSkirt", "SkirtLevels", "Pants", null],
  "wb":     ["StraightWB", "FittedWB", null]
}
```

#### Example

```bash
curl http://localhost:8000/garment-types
```

---

### `POST /generate`

**Generate a sewing pattern from design parameters.**

The core Phase 1 endpoint. Accepts a partial design override dict and optional body measurement overrides. Returns an SVG string, a full specification JSON, and a panel count.

#### Request body

```json
{
  "design": { },
  "body":   { }
}
```

Both fields are optional and default to empty dicts. When empty, the service uses all defaults from `default.yaml` and the standard body file (`assets/bodies/mean_all.yaml`).

##### `design`

A partial nested dict of design overrides. Only send the parameters you want to change. Every key you omit falls back to its default value.

Structure mirrors the schema from `GET /schema`. Each leaf node requires only the `"v"` field — do not send `"range"` or `"type"`.

```json
"design": {
  "meta": {
    "upper":  { "v": "FittedShirt" },
    "bottom": { "v": "PencilSkirt" }
  },
  "shirt": {
    "length": { "v": 1.0 }
  }
}
```

**Constraint:** `meta.upper` and `meta.bottom` cannot both be `null`. The service returns `422` if the assembled pattern has zero panels.

For the full list of parameters, ranges, and visual descriptions, see [pattern_parameters.md](pattern_parameters.md).

##### `body`

Optional dict of body measurement overrides in centimetres. When omitted, the default measurements from `assets/bodies/mean_all.yaml` (171 cm average adult body) are used.

Keys correspond to fields in `BodyParameters` from `assets/bodies/body_params.py`. The YAML file documents all available measurement names.

Example override to use a taller body:

```json
"body": {
  "height": 180
}
```

#### Response — `GenerateResponse`

| Field | Type | Description |
|---|---|---|
| `svg` | `string` | Complete SVG document as a UTF-8 string. Contains all sewing panels as vector paths. Suitable for direct embedding in HTML or writing to a `.svg` file. |
| `spec` | `object` | Full specification JSON — the same format as the `*_specification.json` files in `assets/Patterns/`. Contains `pattern.panels`, `pattern.stitches`, `pattern.panel_order`, `parameters`, and `properties`. |
| `panels` | `integer` | Number of sewing panels in this pattern. Equals `len(spec.pattern.panels)`. |
| `warnings` | `string[]` | Non-fatal warnings emitted during assembly. Usually empty. |

##### `spec` object structure

```json
{
  "pattern": {
    "panels": {
      "<panel_name>": {
        "vertices":    [[x, y], ...],
        "edges":       [{"endpoints": [i, j], "curvature": {...}}, ...],
        "translation": [x, y, z],
        "rotation":    [rx, ry, rz]
      }
    },
    "stitches": [
      [{"panel": "<name>", "edge": 0}, {"panel": "<name>", "edge": 1}],
      ...
    ],
    "panel_order": ["<panel_name>", ...]
  },
  "parameters": {},
  "properties": {
    "units_in_meter": 100,
    "curvature_coords": "relative"
  }
}
```

Key details:
- All coordinates are in **centimetres** (`units_in_meter: 100`).
- Edge curvature control points are expressed in **relative** coordinates (normalised to the edge vector), not absolute coordinates.
- `rotation` is a Maya intrinsic XYZ Euler vector (degrees). The frontend applies it to position each panel in 3D space.
- `stitches` is a list of pairs; each pair is two `{panel, edge}` references identifying which edge on which panel is sewn to which other edge.

#### Errors

| Status | Cause |
|---|---|
| `422` | Both `meta.upper` and `meta.bottom` are `null`, producing an empty pattern. |
| `500` | Unexpected error during pattern assembly (logged in server output). |

#### Example

```bash
# Minimal: FittedShirt + PencilSkirt (defaults for all other parameters)
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {
        "upper":  {"v": "FittedShirt"},
        "bottom": {"v": "PencilSkirt"}
      }
    }
  }' | python3 -c "
import json, sys
r = json.load(sys.stdin)
print('panels:', r['panels'])
print('SVG length:', len(r['svg']), 'chars')
print('panel names:', list(r['spec']['pattern']['panels'].keys()))
"
```

Expected output:

```
panels: 6
SVG length: 8412 chars
panel names: ['front_shirt_0', 'back_shirt_0', 'front_shirt_1', 'back_shirt_1', 'front_skirt_0', 'back_skirt_0']
```

```bash
# Error case: both null → 422
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"design": {"meta": {"upper": {"v": null}, "bottom": {"v": null}}}}' \
  | python3 -m json.tool
```

---

### `POST /simulate`

**Queue a physics simulation job.**

> **Status: Stubbed.** This endpoint exists and accepts requests, but `app/pipeline/sim.py` currently raises `NotImplementedError`. It will activate once the custom NVIDIA Warp fork is installed and `sim.py` is implemented. See [roadmap.md](roadmap.md) section 2.

Accepts the same `design` and `body` fields as `POST /generate`, plus an optional `sim_config` name. Returns immediately with HTTP `202 Accepted` and a `JobResult` object containing the new `job_id`.

Internally, the endpoint:
1. Runs Phase 1 pattern generation synchronously.
2. Writes the specification JSON to `outputs/{job_id}/generated_specification.json`.
3. Enqueues `(job_id, spec_path, out_dir, sim_config)` onto an `asyncio.Queue`.
4. Returns the `JobResult` immediately with `status: "queued"`.

A single background `asyncio.Task` drains the queue sequentially. Each job is executed via `loop.run_in_executor()` so the event loop stays responsive during the blocking CPU-bound simulation.

#### Request body

```json
{
  "design":     { },
  "body":       { },
  "sim_config": "default_sim_props"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `design` | `object` | `{}` | Same as `POST /generate`. |
| `body` | `object` | `{}` | Same as `POST /generate`. |
| `sim_config` | `string` | `"default_sim_props"` | Filename stem (no extension) of a YAML file inside `assets/Sim_props/`. Controls material parameters such as `max_sim_steps`, `spring_ke`, and bending stiffness. Available presets: `default_sim_props`, `mid_bending`, `minimal_bending`, `soft_ochra`. |

#### Response — `JobResult` (HTTP 202)

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID v4. Use this to poll for status. |
| `status` | `string` | Always `"queued"` immediately after creation. |
| `created_at` | `string` | ISO 8601 UTC timestamp. |
| `completed_at` | `string \| null` | `null` until the job finishes or fails. |
| `error` | `string \| null` | Error message if `status` is `"failed"`, otherwise `null`. |
| `outputs` | `object` | Empty dict (`{}`) until the job is `"done"`. |

#### Errors

| Status | Cause |
|---|---|
| `422` | Both `meta.upper` and `meta.bottom` are `null` (Phase 1 fails before queuing). |
| `500` | Unexpected error during Phase 1 pattern generation. |

Note: simulation failures after enqueuing are captured in `JobResult.error` and surfaced via `GET /jobs/{job_id}` — they do not produce an HTTP error on this endpoint.

#### Example

```bash
JOB=$(curl -s -X POST http://localhost:8000/simulate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {
        "upper":  {"v": "FittedShirt"},
        "bottom": {"v": "PencilSkirt"}
      }
    },
    "sim_config": "default_sim_props"
  }' | python3 -c "import json,sys; print(json.load(sys.stdin)['job_id'])")
echo "Job ID: $JOB"
```

---

### `GET /jobs/{job_id}`

**Poll simulation job status.**

Returns the current `JobResult` for a previously submitted simulation job.

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID returned by `POST /simulate`. |

#### Response — `JobResult`

Same schema as the `POST /simulate` response. The `status` field progresses through:

```
queued → running → done
                ↘ failed
```

When `status` is `"done"`, the `outputs` dict is populated:

```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "done",
  "created_at": "2026-05-07T10:00:00Z",
  "completed_at": "2026-05-07T10:02:34Z",
  "error": null,
  "outputs": {
    "glb":          "/outputs/3fa85f64-.../sim.glb",
    "render_front": "/outputs/3fa85f64-.../render_front.png",
    "render_back":  "/outputs/3fa85f64-.../render_back.png"
  }
}
```

The paths in `outputs` are relative URL paths — prepend the service base URL to download them:

```bash
curl http://localhost:8000/outputs/3fa85f64-.../sim.glb -o sim.glb
```

When `status` is `"failed"`, the `error` field contains the exception message from the simulation worker.

#### Errors

| Status | Cause |
|---|---|
| `404` | `job_id` not found. Either invalid, or the service was restarted (jobs are in-memory only). |

#### Example: poll until done

```bash
JOB_ID="<your-job-id>"
while true; do
  STATUS=$(curl -s http://localhost:8000/jobs/$JOB_ID | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  if [[ "$STATUS" == "done" || "$STATUS" == "failed" ]]; then break; fi
  sleep 10
done
```

---

## 5. Data models

All request and response schemas are defined in [app/models.py](../app/models.py).

### `GenerateRequest`

```python
class GenerateRequest(BaseModel):
    design: dict = {}
    body:   dict = {}
```

### `GenerateResponse`

```python
class GenerateResponse(BaseModel):
    svg:      str
    spec:     dict
    panels:   int
    warnings: List[str] = []
```

### `SimulateRequest`

```python
class SimulateRequest(BaseModel):
    design:     dict = {}
    body:       dict = {}
    sim_config: str  = "default_sim_props"
```

### `JobStatus`

```python
class JobStatus(str, Enum):
    QUEUED  = "queued"
    RUNNING = "running"
    DONE    = "done"
    FAILED  = "failed"
```

### `JobResult`

```python
class JobResult(BaseModel):
    job_id:       str                  # UUID v4
    status:       JobStatus            # queued | running | done | failed
    created_at:   datetime             # UTC
    completed_at: Optional[datetime]   # UTC, null until finished
    error:        Optional[str]        # null unless failed
    outputs:      Dict[str, str]       # empty until done
```

---

## 6. Error responses

All errors follow the standard FastAPI JSON envelope:

```json
{
  "detail": "<human-readable message>"
}
```

### Common error codes

| Status | Meaning |
|---|---|
| `404` | Resource not found (job_id unknown). |
| `422` | Validation error — either Pydantic type mismatch in the request body, or `meta.upper` and `meta.bottom` both `null` producing an empty pattern. |
| `500` | Unhandled exception during pattern assembly. The `detail` field contains the exception message. Check server logs for the full traceback. |

### Pydantic validation errors (422)

When the request body fails Pydantic schema validation, the `detail` field is a list of error objects:

```json
{
  "detail": [
    {
      "loc": ["body", "design", "meta", "upper", "v"],
      "msg": "value is not a valid string",
      "type": "type_error.str"
    }
  ]
}
```

Note: because `design` and `body` are typed as `dict`, Pydantic does not validate the contents of those dicts at the request level. Structural errors in `design` (e.g. wrong nesting) are silently absorbed by `_merge()` — unrecognised keys are ignored and known keys with wrong types may produce a `500` during assembly.

---

## 7. Configuration reference

All path settings are read by `app/config.py` using Pydantic Settings with the `GARMENT_` prefix. Values can be set in a `.env` file in the project root or as shell environment variables.

| Setting | Env var | Default | Used by |
|---|---|---|---|
| `assets_path` | `GARMENT_ASSETS_PATH` | `assets` | All phases |
| `body_yaml` | `GARMENT_BODY_YAML` | `bodies/mean_all.yaml` | Phase 1 |
| `output_dir` | `GARMENT_OUTPUT_DIR` | `outputs` | Phase 2 |

Computed properties (derived at runtime, not settable via env vars):

| Property | Resolved path |
|---|---|
| `body_path` | `assets_path / body_yaml` |
| `design_params_path` | `assets_path / "design_params/default.yaml"` |
| `sim_props_dir` | `assets_path / "Sim_props"` |

Example `.env` override:

```env
GARMENT_OUTPUT_DIR=/var/garment-outputs
GARMENT_BODY_YAML=bodies/mean_female.yaml
```

---

## 8. End-to-end examples

### Generate a pattern and save the SVG

```bash
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {
        "upper":  {"v": "FittedShirt"},
        "bottom": {"v": "SkirtCircle"}
      },
      "collar": {
        "f_collar": {"v": "VNeckHalf"},
        "fc_depth": {"v": 0.8}
      },
      "sleeve": {
        "sleeveless": {"v": true}
      },
      "skirt": {
        "length": {"v": 0.7},
        "ruffle": {"v": 1.5}
      }
    }
  }' | python3 -c "
import json, sys
r = json.load(sys.stdin)
print('panels:', r['panels'])
with open('pattern.svg', 'w') as f:
    f.write(r['svg'])
print('Saved to pattern.svg')
"
```

---

### Generate a pattern and extract stitch data

```bash
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"design": {"meta": {"upper": {"v": "Shirt"}, "bottom": {"v": null}}}}' \
  | python3 -c "
import json, sys
r = json.load(sys.stdin)
stitches = r['spec']['pattern']['stitches']
print(f'{len(stitches)} stitch pairs:')
for s in stitches[:3]:
    print(' ', s[0], '↔', s[1])
"
```

---

### Use a custom body height

```bash
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {"upper": {"v": "FittedShirt"}, "bottom": {"v": "Pants"}}
    },
    "body": {
      "height": 165
    }
  }' | python3 -c "
import json, sys
r = json.load(sys.stdin)
print('panels:', r['panels'])
"
```

---

### Discover all schema keys programmatically

```python
import requests

def flatten_schema(node, path=""):
    if "v" in node:
        return {path: {"default": node["v"], "range": node.get("range"), "type": node.get("type")}}
    result = {}
    for k, v in node.items():
        child = flatten_schema(v, f"{path}.{k}" if path else k)
        result.update(child)
    return result

schema = requests.get("http://localhost:8000/schema").json()
flat = flatten_schema(schema)
for key, info in list(flat.items())[:10]:
    print(f"{key}: default={info['default']}, type={info['type']}, range={info['range']}")
```

---

### Asymmetric garment: full sleeve on right, sleeveless on left

```bash
curl -s -X POST http://localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {
        "upper":  {"v": "FittedShirt"},
        "bottom": {"v": null}
      },
      "sleeve": {
        "sleeveless":    {"v": false},
        "armhole_shape": {"v": "ArmholeSquare"},
        "length":        {"v": 1.0}
      },
      "left": {
        "enable_asym": {"v": true},
        "sleeve": {
          "sleeveless": {"v": true}
        }
      }
    }
  }' | python3 -c "
import json, sys
r = json.load(sys.stdin)
print('panels:', r['panels'])
"
```

---

### Submit a simulation job and download outputs (once Phase 2 is active)

```bash
# Submit
RESPONSE=$(curl -s -X POST http://localhost:8000/simulate \
  -H 'Content-Type: application/json' \
  -d '{
    "design": {
      "meta": {"upper": {"v": "FittedShirt"}, "bottom": {"v": "PencilSkirt"}}
    },
    "sim_config": "default_sim_props"
  }')

JOB_ID=$(echo $RESPONSE | python3 -c "import json,sys; print(json.load(sys.stdin)['job_id'])")
echo "Queued job: $JOB_ID"

# Poll
while true; do
  JOB=$(curl -s http://localhost:8000/jobs/$JOB_ID)
  STATUS=$(echo $JOB | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  if [[ "$STATUS" == "done" ]]; then
    echo $JOB | python3 -c "
import json, sys
r = json.load(sys.stdin)
for k, url in r['outputs'].items():
    print(f'{k}: http://localhost:8000{url}')
"
    break
  elif [[ "$STATUS" == "failed" ]]; then
    echo $JOB | python3 -c "import json,sys; print('Error:', json.load(sys.stdin)['error'])"
    break
  fi
  sleep 15
done

# Download GLB
curl -s http://localhost:8000/outputs/$JOB_ID/sim.glb -o sim.glb
echo "Downloaded sim.glb"
```
