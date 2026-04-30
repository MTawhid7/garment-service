"""
Phase 2 — Physics simulation pipeline.

Not yet activated. Requires:
  - Custom NVIDIA Warp fork: github.com/maria-korosteleva/NvidiaWarp-GarmentCode
    (standard `pip install warp-lang` will NOT work)
  - Install: pip install -e /path/to/NvidiaWarp-GarmentCode

Call sequence (mirrors test_garment_sim.py):
  spec_path → BoxMesh.load() → BoxMesh.serialize() → run_sim() → GLB + PNGs

See plan file for full implementation details.
"""
from pathlib import Path
from typing import Dict


def run_simulation(
    spec_path: Path,
    out_dir: Path,
    sim_config_name: str = "default_sim_props",
) -> Dict[str, Path]:
    raise NotImplementedError(
        "Phase 2 simulation is not yet activated. "
        "Install the custom Warp fork and implement app/pipeline/sim.py."
    )
