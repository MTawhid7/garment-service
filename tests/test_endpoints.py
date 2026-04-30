"""Tests for the non-generate endpoints: health, schema, garment-types."""


def test_health(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_schema_returns_design_tree(client):
    r = client.get("/schema")
    assert r.status_code == 200
    schema = r.json()
    assert "meta" in schema
    meta = schema["meta"]
    assert "upper" in meta and "bottom" in meta and "wb" in meta
    # Every leaf must have a 'v' key (current value) and a 'type' key
    assert "v" in meta["upper"]
    assert "type" in meta["upper"]


def test_schema_contains_known_sections(client):
    r = client.get("/schema")
    schema = r.json()
    # These top-level design sections must exist
    for section in ("meta", "shirt", "pants", "skirt"):
        assert section in schema, f"Missing section: {section}"


def test_garment_types_shape(client):
    r = client.get("/garment-types")
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"upper", "bottom", "wb"}
    for slot in ("upper", "bottom", "wb"):
        assert isinstance(body[slot], list)
        assert len(body[slot]) >= 1


def test_garment_types_known_values(client):
    body = client.get("/garment-types").json()
    assert "FittedShirt" in body["upper"]
    assert "Shirt" in body["upper"]
    assert "PencilSkirt" in body["bottom"]
    assert "Pants" in body["bottom"]
    assert "SkirtCircle" in body["bottom"]
    assert "StraightWB" in body["wb"]
