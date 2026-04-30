import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

import pygarment as pyg

from app.config import settings
from app.models import (
    GenerateRequest,
    GenerateResponse,
    JobResult,
    JobStatus,
    SimulateRequest,
)
from app.pipeline.pattern import _DEFAULT_DESIGN, generate_pattern
from app.pipeline.sim import run_simulation

# ── In-memory job store (Phase 2) ─────────────────────────────────────────────
# Replace with Redis / a database when persistence is needed.
_jobs: Dict[str, JobResult] = {}
_job_queue: asyncio.Queue = asyncio.Queue()
_worker_task: Optional[asyncio.Task] = None


async def _simulation_worker() -> None:
    """Background worker: drains _job_queue and runs simulations one at a time."""
    while True:
        job_id, spec_path, out_dir, sim_config = await _job_queue.get()
        _jobs[job_id].status = JobStatus.RUNNING
        try:
            loop = asyncio.get_event_loop()
            outputs = await loop.run_in_executor(
                None, run_simulation, spec_path, out_dir, sim_config
            )
            _jobs[job_id].status = JobStatus.DONE
            _jobs[job_id].outputs = {
                k: f"/outputs/{job_id}/{v.name}" for k, v in outputs.items()
            }
        except Exception as exc:
            _jobs[job_id].status = JobStatus.FAILED
            _jobs[job_id].error = str(exc)
        finally:
            _jobs[job_id].completed_at = datetime.utcnow()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    _worker_task = asyncio.create_task(_simulation_worker())
    yield
    if _worker_task:
        _worker_task.cancel()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Garment Service",
    version="0.1.0",
    description="Pattern generation and physics simulation for parametric sewing patterns.",
    lifespan=lifespan,
)

# Serve simulation outputs as static files (Phase 2).
app.mount("/outputs", StaticFiles(directory=str(settings.output_dir), check_dir=False), name="outputs")


# ── Phase 1: Pattern generation ───────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/schema")
def schema():
    """Full design parameter schema: all keys, types, ranges, and defaults."""
    return _DEFAULT_DESIGN


@app.get("/garment-types")
def garment_types():
    """Available garment class names for upper, bottom, and waistband slots."""
    meta = _DEFAULT_DESIGN["meta"]
    return {
        "upper": meta["upper"]["range"],
        "bottom": meta["bottom"]["range"],
        "wb": meta["wb"]["range"],
    }


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    """
    Generate a sewing pattern from design parameters.

    Supply only the parameters you want to override; everything else falls back
    to the defaults in assets/design_params/default.yaml.

    Example:
        {
          "design": {
            "meta": {
              "upper": {"v": "FittedShirt"},
              "bottom": {"v": "PencilSkirt"}
            }
          }
        }
    """
    try:
        return generate_pattern(req.design, req.body)
    except pyg.EmptyPatternError:
        raise HTTPException(
            status_code=422,
            detail=(
                "These parameters produce an empty pattern. "
                "Set meta.upper or meta.bottom to a valid garment type."
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Phase 2: Simulation (endpoints stubbed — not yet active) ──────────────────

@app.post("/simulate", response_model=JobResult, status_code=202)
async def simulate(req: SimulateRequest):
    """
    Queue a physics simulation job. Returns immediately with a job_id.
    Poll GET /jobs/{job_id} for status and result download URLs.

    NOTE: Requires the custom NVIDIA Warp fork to be installed.
          See pyproject.toml [project.optional-dependencies] sim for details.
    """
    # Step 1: Generate the specification JSON (fast, synchronous).
    try:
        result = generate_pattern(req.design, req.body)
    except pyg.EmptyPatternError:
        raise HTTPException(422, "Parameters produce an empty pattern.")
    except Exception as exc:
        raise HTTPException(500, str(exc))

    # Step 2: Write spec to a job output directory and enqueue.
    job = JobResult()
    job_dir = settings.output_dir / job.job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    import json as _json
    spec_path = job_dir / "generated_specification.json"
    spec_path.write_text(_json.dumps(result.spec, indent=2))

    _jobs[job.job_id] = job
    await _job_queue.put((job.job_id, spec_path, job_dir, req.sim_config))
    return job


@app.get("/jobs/{job_id}", response_model=JobResult)
def job_status(job_id: str):
    """Poll simulation job status. When status is 'done', outputs contains download URLs."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _jobs[job_id]
