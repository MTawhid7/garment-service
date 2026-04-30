import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional  # noqa: F401 — kept for 3.9 compat

from pydantic import BaseModel, Field


# ── Phase 1: Pattern Generation ──────────────────────────────────────────────

class GenerateRequest(BaseModel):
    design: dict = {}   # partial design overrides; missing keys fall back to default.yaml
    body: dict = {}     # optional body measurement overrides (centimeters)


class GenerateResponse(BaseModel):
    svg: str            # full SVG document as a string
    spec: dict          # parsed *_specification.json
    panels: int         # number of sewing panels generated
    warnings: List[str] = []


# ── Phase 2: Simulation (models defined now; endpoints wired in a later phase) ─

class SimulateRequest(BaseModel):
    design: dict = {}
    body: dict = {}
    sim_config: str = "default_sim_props"   # filename stem in assets/Sim_props/


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class JobResult(BaseModel):
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: JobStatus = JobStatus.QUEUED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    # keys: "glb", "render_front", "render_back" → "/outputs/{job_id}/{filename}"
    outputs: Dict[str, str] = {}
