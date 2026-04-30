import json
import tempfile
from copy import deepcopy
from pathlib import Path

import yaml

import pygarment as pyg
from assets.bodies.body_params import BodyParameters
from assets.garment_programs.meta_garment import MetaGarment

from app.config import settings
from app.models import GenerateResponse


def _load_default_design(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)["design"]


def _merge(src: dict, dst: dict) -> None:
    """Copy 'v' values from src into dst, walking the schema tree in dst."""
    if "v" in dst:
        if "v" in src:
            dst["v"] = src["v"]
    else:
        for key in dst:
            if key in src:
                _merge(src[key], dst[key])


def _sync_left(design: dict) -> None:
    """Mirror right-side params into left when asymmetry is disabled."""
    if "left" not in design:
        return
    if design["left"]["enable_asym"]["v"]:
        return
    for k in design["left"]:
        if k != "enable_asym":
            _merge(design[k], design["left"][k])


# Loaded once at startup — not per-request.
_DEFAULT_DESIGN: dict = _load_default_design(settings.design_params_path)


def generate_pattern(design_overrides: dict, body_overrides: dict) -> GenerateResponse:
    """
    Merge overrides into the default design, assemble the garment, and return
    the SVG string plus the full specification JSON.

    Raises pyg.EmptyPatternError if the parameters produce no panels.
    """
    design = deepcopy(_DEFAULT_DESIGN)
    _merge(design_overrides, design)
    _sync_left(design)

    body = BodyParameters(str(settings.body_path))
    if body_overrides:
        body.load_from_dict(body_overrides)
    body.eval_dependencies()

    garment = MetaGarment("generated", body, design)
    pattern = garment.assembly()   # raises EmptyPatternError if empty

    # SVG — get_svg() requires a file path, so use a temp file.
    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as f:
        tmp_svg = Path(f.name)
    try:
        dwg = pattern.get_svg(tmp_svg, with_text=False, view_ids=False, flat=False, margin=0)
        dwg.save()
        svg = tmp_svg.read_text()
    finally:
        tmp_svg.unlink(missing_ok=True)

    # Spec JSON — pattern.spec is the live dict populated during assembly.
    spec = deepcopy(pattern.spec)

    panels = len(spec.get("pattern", {}).get("panels", {}))
    return GenerateResponse(svg=svg, spec=spec, panels=panels)
