"""
Correctness tests for POST /generate.

Test categories:
  1. Response structure — required fields and types
  2. SVG validity — well-formed XML with real dimensions
  3. Spec structural integrity — panels, stitches, panel_order are consistent
  4. Stitch edge integrity — every referenced panel/edge actually exists
  5. Known panel counts — regression anchors for each garment type
  6. Parameter sensitivity — changing a value changes the output
  7. Error handling — empty pattern, invalid inputs
"""
import xml.etree.ElementTree as ET

import pytest


# ── 1. Response structure ─────────────────────────────────────────────────────

def test_response_has_required_fields(shirt_skirt):
    assert "svg" in shirt_skirt
    assert "spec" in shirt_skirt
    assert "panels" in shirt_skirt
    assert "warnings" in shirt_skirt


def test_panels_field_is_integer(shirt_skirt):
    assert isinstance(shirt_skirt["panels"], int)
    assert shirt_skirt["panels"] > 0


def test_warnings_is_list(shirt_skirt):
    assert isinstance(shirt_skirt["warnings"], list)


# ── 2. SVG validity ───────────────────────────────────────────────────────────

def test_svg_is_valid_xml(shirt_skirt):
    root = ET.fromstring(shirt_skirt["svg"])
    assert root.tag.endswith("svg"), f"Root tag is '{root.tag}', expected 'svg'"


def test_svg_has_nonzero_dimensions(shirt_skirt):
    root = ET.fromstring(shirt_skirt["svg"])
    # height and width are present and parseable as positive floats
    for attr in ("height", "width"):
        val = root.get(attr, "")
        # strip units (e.g. "104.54cm" → "104.54")
        numeric = val.rstrip("abcdefghijklmnopqrstuvwxyz%")
        assert float(numeric) > 0, f"SVG {attr}={val!r} is not positive"


def test_svg_contains_path_elements(shirt_skirt):
    root = ET.fromstring(shirt_skirt["svg"])
    ns = {"svg": "http://www.w3.org/2000/svg"}
    # Panels are drawn as <path> elements
    paths = root.findall(".//svg:path", ns) or root.findall(".//{http://www.w3.org/2000/svg}path")
    # Fall back to unqualified search (svgwrite omits namespace prefix on some versions)
    if not paths:
        paths = root.findall(".//path")
    assert len(paths) > 0, "SVG contains no <path> elements"


# ── 3. Spec structural integrity ──────────────────────────────────────────────

def test_spec_has_required_keys(shirt_skirt):
    spec = shirt_skirt["spec"]
    assert "pattern" in spec
    assert "properties" in spec
    pattern = spec["pattern"]
    assert "panels" in pattern
    assert "stitches" in pattern
    assert "panel_order" in pattern


def test_panels_count_matches_field(shirt_skirt):
    """panels field must equal the actual number of panel entries in spec."""
    n_reported = shirt_skirt["panels"]
    n_actual = len(shirt_skirt["spec"]["pattern"]["panels"])
    assert n_reported == n_actual


def test_panel_order_matches_panels(shirt_skirt):
    """panel_order must contain exactly the same names as panels dict."""
    pattern = shirt_skirt["spec"]["pattern"]
    assert set(pattern["panel_order"]) == set(pattern["panels"].keys())


def test_spec_properties(shirt_skirt):
    props = shirt_skirt["spec"]["properties"]
    assert props["units_in_meter"] == 100
    assert props["curvature_coords"] == "relative"


def test_each_panel_has_vertices_and_edges(shirt_skirt):
    for name, panel in shirt_skirt["spec"]["pattern"]["panels"].items():
        assert "vertices" in panel, f"Panel {name!r} missing 'vertices'"
        assert "edges" in panel,    f"Panel {name!r} missing 'edges'"
        assert len(panel["vertices"]) >= 3, f"Panel {name!r} has < 3 vertices"
        assert len(panel["edges"]) >= 3,    f"Panel {name!r} has < 3 edges"


# ── 4. Stitch edge integrity ──────────────────────────────────────────────────

def _assert_stitch_integrity(spec):
    panels = spec["pattern"]["panels"]
    for i, stitch in enumerate(spec["pattern"]["stitches"]):
        sides = [s for s in stitch if isinstance(s, dict)]
        assert len(sides) == 2, f"Stitch {i} does not have exactly 2 dict entries"
        for side in sides:
            panel_name = side["panel"]
            edge_id = side["edge"]
            assert panel_name in panels, (
                f"Stitch {i} references unknown panel {panel_name!r}"
            )
            n_edges = len(panels[panel_name]["edges"])
            assert 0 <= edge_id < n_edges, (
                f"Stitch {i}: panel {panel_name!r} edge {edge_id} out of range (has {n_edges} edges)"
            )


def test_stitch_integrity_shirt_skirt(shirt_skirt):
    _assert_stitch_integrity(shirt_skirt["spec"])


@pytest.mark.parametrize("upper,bottom", [
    ("FittedShirt", None),
    ("Shirt",       None),
    (None,          "SkirtCircle"),
    (None,          "Pants"),
    (None,          "PencilSkirt"),
    ("FittedShirt", "Pants"),
    ("FittedShirt", "SkirtManyPanels"),
])
def test_stitch_integrity_all_types(client, upper, bottom):
    r = client.post("/generate", json={
        "design": {"meta": {"upper": {"v": upper}, "bottom": {"v": bottom}}}
    })
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    _assert_stitch_integrity(r.json()["spec"])


# ── 5. Known panel counts (regression anchors) ────────────────────────────────

@pytest.mark.parametrize("upper,bottom,expected_panels,expected_stitches", [
    ("FittedShirt", None,          4,  16),
    ("Shirt",       None,          4,   6),
    (None,          "SkirtCircle", 2,   2),
    (None,          "Pants",       4,  14),
    (None,          "PencilSkirt", 2,   8),
    ("FittedShirt", "Pants",       8,  40),
    ("FittedShirt", "PencilSkirt", 6,  34),
])
def test_panel_and_stitch_counts(client, upper, bottom, expected_panels, expected_stitches):
    r = client.post("/generate", json={
        "design": {"meta": {"upper": {"v": upper}, "bottom": {"v": bottom}}}
    })
    assert r.status_code == 200
    body = r.json()
    assert body["panels"] == expected_panels, (
        f"{upper}+{bottom}: expected {expected_panels} panels, got {body['panels']}"
    )
    n_stitches = len(body["spec"]["pattern"]["stitches"])
    assert n_stitches == expected_stitches, (
        f"{upper}+{bottom}: expected {expected_stitches} stitches, got {n_stitches}"
    )


# ── 6. Parameter sensitivity ──────────────────────────────────────────────────

def test_changing_shirt_length_changes_svg(client):
    """shirt.length applies to the Shirt garment type (not FittedShirt)."""
    def generate(length):
        return client.post("/generate", json={
            "design": {
                "meta":  {"upper": {"v": "Shirt"}},
                "shirt": {"length": {"v": length}},
            }
        }).json()["svg"]

    svg_short = generate(0.5)
    svg_long  = generate(3.5)
    assert svg_short != svg_long, "Changing shirt.length had no effect on SVG"


def test_changing_collar_width_changes_fitted_shirt(client):
    """collar.width is one of the parameters that controls FittedShirt geometry."""
    def generate(width):
        return client.post("/generate", json={
            "design": {
                "meta":   {"upper": {"v": "FittedShirt"}},
                "collar": {"width": {"v": width}},
            }
        }).json()["svg"]

    svg_narrow = generate(0.2)
    svg_wide   = generate(1.0)
    assert svg_narrow != svg_wide, "Changing collar.width had no effect on FittedShirt SVG"


def test_changing_body_height_changes_svg(client):
    """A taller body must produce a different (taller) SVG."""
    def generate(height):
        return client.post("/generate", json={
            "design": {"meta": {"upper": {"v": "FittedShirt"}}},
            "body":   {"height": height},
        }).json()["svg"]

    svg_short = generate(155)
    svg_tall  = generate(190)
    assert svg_short != svg_tall, "Changing body height had no effect on SVG"


def test_default_overrides_are_partial(client):
    """Sending only meta.upper must still produce a valid pattern (other keys default)."""
    r = client.post("/generate", json={
        "design": {"meta": {"upper": {"v": "Shirt"}}}
    })
    assert r.status_code == 200
    assert r.json()["panels"] > 0


# ── 7. Error handling ─────────────────────────────────────────────────────────

def test_both_null_returns_422(client):
    r = client.post("/generate", json={
        "design": {"meta": {"upper": {"v": None}, "bottom": {"v": None}}}
    })
    assert r.status_code == 422
    assert "empty" in r.json()["detail"].lower()


def test_empty_body_returns_422(client):
    """An empty design request has both meta slots at their null defaults."""
    r = client.post("/generate", json={})
    assert r.status_code == 422


def test_invalid_garment_type_returns_error(client):
    """An unrecognised garment type name must not silently succeed."""
    r = client.post("/generate", json={
        "design": {"meta": {"upper": {"v": "NonexistentGarment"}}}
    })
    assert r.status_code in (422, 500), (
        f"Expected 422 or 500 for invalid garment type, got {r.status_code}"
    )
