"""
Shared fixtures for the garment-service test suite.

IMPORTANT — run pytest with DYLD_LIBRARY_PATH set (macOS):
    export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"
    pytest tests/ -v

The setting below handles the common case where the env var is not set before
pytest is launched. It must happen before any pygarment import so the
dynamic linker finds libcairo and the native geometry libraries.
"""
import os
import sys

# --- macOS native library path (must be set before cairosvg/cgal imports) ---
if sys.platform == "darwin":
    existing = os.environ.get("DYLD_LIBRARY_PATH", "")
    homebrew = "/opt/homebrew/lib"
    if homebrew not in existing:
        os.environ["DYLD_LIBRARY_PATH"] = f"{homebrew}:{existing}" if existing else homebrew

# --- ensure the project root is on sys.path ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client():
    """A session-scoped TestClient — no live server needed."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def shirt_skirt(client):
    """Pre-computed FittedShirt + PencilSkirt response, reused across tests."""
    r = client.post("/generate", json={
        "design": {
            "meta": {
                "upper":  {"v": "FittedShirt"},
                "bottom": {"v": "PencilSkirt"},
            }
        }
    })
    assert r.status_code == 200
    return r.json()
