# GarmentCode Pattern Parameters

Reference for the `/generate` endpoint of `pattern_service.py`. Send any subset of these parameters as JSON; everything you omit falls back to the default values from `assets/design_params/default.yaml`.

---

## Contents

1. [How the JSON is structured](#1-how-the-json-is-structured)
2. [meta — Garment type selection](#2-meta--garment-type-selection)
3. [shirt — Top body proportions](#3-shirt--top-body-proportions)
4. [collar — Neckline shape](#4-collar--neckline-shape)
5. [sleeve — Arms](#5-sleeve--arms)
6. [waistband — Waist transition piece](#6-waistband--waist-transition-piece)
7. [Bottom pieces](#7-bottom-pieces)
   - [pencil-skirt](#pencil-skirt)
   - [skirt — Circle and asymmetric skirts](#skirt--circle-and-asymmetric-skirts)
   - [flare-skirt — Flared and multi-panel skirts](#flare-skirt--flared-and-multi-panel-skirts)
   - [godet-skirt](#godet-skirt)
   - [levels-skirt — Tiered skirts](#levels-skirt--tiered-skirts)
   - [pants](#pants)
8. [left — Per-side asymmetry overrides](#8-left--per-side-asymmetry-overrides)
9. [Complete recipes](#9-complete-recipes)
10. [Quick-reference tables](#10-quick-reference-tables)

---

## 1. How the JSON is structured

Every parameter in the schema is a leaf node that looks like this:

```json
"length": {
  "v": 0.4,
  "range": [0.2, 0.95],
  "type": "float"
}
```

- `"v"` is the **value** — the only field you send in your request.
- `"range"` and `"type"` are metadata the engine uses internally. You never send them.

Your request body therefore looks like:

```json
{
  "design": {
    "section": {
      "parameter": { "v": YOUR_VALUE }
    }
  }
}
```

Send only the parameters you want to change. Omitted parameters use their defaults.

### Parameter types

| Type | Meaning | Example values |
|---|---|---|
| `float` | Decimal number within a range | `0.5`, `1.2`, `3.14` |
| `int` | Whole number within a range | `4`, `10`, `95` |
| `bool` | On/off toggle | `true`, `false` |
| `select` | One string from a fixed list | `"VNeckHalf"`, `"ArmholeSquare"` |
| `select_null` | One string from a list, or absent | `"FittedShirt"`, `null` |

For `float` and `int` parameters, values outside `range` will produce unexpected results. Stay within the listed bounds.

---

## 2. `meta` — Garment type selection

**This is the most important section.** It decides what kind of garment is assembled. Everything else fine-tunes the chosen types.

At least one of `upper` or `bottom` must be non-`null`, otherwise the engine returns a 422 error.

```json
"meta": {
  "upper":  { "v": "FittedShirt" },
  "wb":     { "v": "StraightWB"  },
  "bottom": { "v": "PencilSkirt" }
}
```

### `meta.upper` — Top garment type

| Value | Description |
|---|---|
| `"FittedShirt"` | Tailored top that follows the body shape; supports structured collar and sleeve options |
| `"Shirt"` | Looser, boxy cut; less structured than FittedShirt |
| `null` | No top piece — bottom only |

**Default:** `null`

### `meta.wb` — Waistband between top and bottom

| Value | Description |
|---|---|
| `"StraightWB"` | Flat rectangular waistband band |
| `"FittedWB"` | Waistband shaped to follow the waist curve |
| `null` | No waistband; top and bottom join directly |

**Default:** `null`

### `meta.bottom` — Bottom garment type

| Value | Section to configure | Description |
|---|---|---|
| `"PencilSkirt"` | `pencil-skirt` | Slim, fitted straight skirt |
| `"SkirtCircle"` | `skirt` | Full circular flowy skirt |
| `"AsymmSkirtCircle"` | `skirt` | Circle skirt with asymmetric hem length |
| `"Skirt2"` | `flare-skirt` | Simple two-panel skirt |
| `"SkirtManyPanels"` | `flare-skirt` | Multi-panel skirt with configurable panel count |
| `"GodetSkirt"` | `godet-skirt` | Skirt with decorative triangular fabric inserts |
| `"SkirtLevels"` | `levels-skirt` | Tiered/layered skirt |
| `"Pants"` | `pants` | Trousers — **slow to compute (several seconds)** |
| `null` | — | No bottom piece — top only |

**Default:** `null`

> **Rule:** When you set `meta.bottom`, configure parameters in the **matching section only**. For example, if you pick `"PencilSkirt"`, configure `pencil-skirt`. Sending `skirt` or `pants` parameters alongside a `"PencilSkirt"` bottom has no effect.

---

## 3. `shirt` — Top body proportions

Controls the body of the shirt (torso area). Does not affect neckline or sleeves — those are in `collar` and `sleeve`.

```json
"shirt": {
  "length":    { "v": 1.2  },
  "width":     { "v": 1.05 },
  "flare":     { "v": 1.0  },
  "strapless": { "v": false }
}
```

### `shirt.length` — Shirt body length

Multiplier relative to the default torso length.

| Value | Visual result |
|---|---|
| `0.5` | Cropped — stops at the midriff |
| `1.0` | Standard hip length |
| `1.2` | *(default)* Slightly below the hip |
| `2.0` | Long tunic, reaches mid-thigh |
| `3.5` | Maximum — very long shirt/dress |

**Range:** 0.5 – 3.5 · **Default:** 1.2

### `shirt.width` — Shirt body width

Width relative to body width. Values close to 1.0 are fitted; higher values are loose.

| Value | Visual result |
|---|---|
| `1.0` | Skin-tight / body-hugging |
| `1.05` | *(default)* Slightly relaxed fit |
| `1.2` | Loose, casual fit |
| `1.3` | Oversized |

**Range:** 1.0 – 1.3 · **Default:** 1.05

### `shirt.flare` — Shirt hem flare

Controls whether the shirt widens toward the hem.

| Value | Visual result |
|---|---|
| `0.7` | Tapered inward at hem |
| `1.0` | *(default)* Straight, no flare |
| `1.3` | Moderate A-line shape |
| `1.6` | Strong flare at hem |

**Range:** 0.7 – 1.6 · **Default:** 1.0

### `shirt.strapless` — Strapless top

Removes shoulder straps to create a tube/strapless top. Only has a visible effect with `"FittedShirt"`.

| Value | Visual result |
|---|---|
| `false` | *(default)* Normal shoulders |
| `true` | Strapless / tube top |

---

## 4. `collar` — Neckline shape

Defines how the neck opening is cut and whether a collar component (turtleneck, lapel, hood) is attached.

```json
"collar": {
  "f_collar":  { "v": "CircleNeckHalf" },
  "b_collar":  { "v": "CircleNeckHalf" },
  "fc_depth":  { "v": 0.4 },
  "bc_depth":  { "v": 0.0 },
  "width":     { "v": 0.2 },
  "component": {
    "style": { "v": null }
  }
}
```

### `collar.f_collar` — Front neckline curve

The geometric shape used to cut the front neckline.

| Value | Visual result |
|---|---|
| `"CircleNeckHalf"` | *(default)* Classic round crew neck |
| `"VNeckHalf"` | V-neck |
| `"SquareNeckHalf"` | Square / boat neck |
| `"CurvyNeckHalf"` | Sweetheart-style curved neckline |
| `"TrapezoidNeckHalf"` | Wide flat neckline |
| `"CircleArcNeckHalf"` | Shallow arc neck |
| `"Bezier2NeckHalf"` | Freeform curve; shape controlled by `f_bezier_x` / `f_bezier_y` |

### `collar.b_collar` — Back neckline curve

Same options as `f_collar`. Usually set to a simpler shape than the front.

**Default:** `"CircleNeckHalf"`

### `collar.fc_depth` — Front collar depth (plunge)

How far down the front neckline cuts into the torso.

| Value | Visual result |
|---|---|
| `0.3` | Very high / modest neckline |
| `0.4` | *(default)* Standard crew depth |
| `1.0` | Moderate plunge |
| `2.0` | Very deep plunge |

**Range:** 0.3 – 2.0 · **Default:** 0.4

### `collar.bc_depth` — Back collar depth

How open the back neckline is.

| Value | Visual result |
|---|---|
| `0.0` | *(default)* Closed back |
| `0.5` | Moderately open back |
| `2.0` | Very open / backless |

**Range:** 0.0 – 2.0 · **Default:** 0.0

### `collar.width` — Collar horizontal spread

How far the neckline spreads horizontally toward the shoulders.

| Value | Visual result |
|---|---|
| `-0.5` | Very narrow neck opening |
| `0.2` | *(default)* Standard width |
| `0.5` | Wide neckline |
| `1.0` | Shoulder-to-shoulder |

**Range:** -0.5 – 1.0 · **Default:** 0.2

### `collar.fc_depth` / `collar.bc_depth` angles

Fine-tune the opening angle of the front or back neckline curve. Only meaningful for certain collar shapes.

- `collar.fc_angle` — **Range:** 70 – 110 · **Default:** 95
- `collar.bc_angle` — **Range:** 70 – 110 · **Default:** 95

### Bézier control points (only for `"Bezier2NeckHalf"`)

When `f_collar` or `b_collar` is set to `"Bezier2NeckHalf"`, these two pairs of values control the shape of the freeform curve.

- `collar.f_bezier_x` / `collar.f_bezier_y` — front curve control point · **Range:** 0.05 – 0.95
- `collar.b_bezier_x` / `collar.b_bezier_y` — back curve control point · **Range:** 0.05 – 0.95
- `collar.f_flip_curve` / `collar.b_flip_curve` (`bool`) — mirror the curve direction

### `collar.component` — Attached collar piece

An optional structural piece stitched onto the neckline after it is cut.

```json
"component": {
  "style":           { "v": null  },
  "depth":           { "v": 7    },
  "lapel_standing":  { "v": false },
  "hood_depth":      { "v": 1.0  },
  "hood_length":     { "v": 1.0  }
}
```

| `style` value | Description |
|---|---|
| `null` | *(default)* No collar component |
| `"Turtle"` | Turtleneck / roll collar |
| `"SimpleLapel"` | Open lapel / notched collar |
| `"Hood2Panels"` | Two-panel hood — **slow to compute** |

- `depth` — how tall the turtleneck or lapel stands · **Range:** 2 – 8 · **Default:** 7
- `lapel_standing` — if `true`, lapel stands upright rather than folding flat
- `hood_depth` — hood depth (front-to-back) · **Range:** 1.0 – 2.0
- `hood_length` — hood height · **Range:** 1.0 – 1.5

---

## 5. `sleeve` — Arms

Controls whether the garment has sleeves and how they are shaped.

```json
"sleeve": {
  "sleeveless":       { "v": false           },
  "armhole_shape":    { "v": "ArmholeSquare" },
  "length":           { "v": 0.5             },
  "connecting_width": { "v": 0.2             },
  "end_width":        { "v": 1.0             },
  "sleeve_angle":     { "v": 10              },
  "cuff": {
    "type":     { "v": null  },
    "cuff_len": { "v": 0.1   }
  }
}
```

### `sleeve.sleeveless` — Remove sleeves entirely

| Value | Visual result |
|---|---|
| `true` | *(default)* No sleeves; armhole is left open |
| `false` | Sleeves are generated |

When `true`, all other sleeve parameters are ignored.

### `sleeve.armhole_shape` — How the armhole is cut

| Value | Description | Speed |
|---|---|---|
| `"ArmholeSquare"` | Right-angle cut into the shirt body | Fast |
| `"ArmholeAngle"` | Angled / diagonal cut | Fast |
| `"ArmholeCurve"` | Smooth curved armhole, most realistic | **Slow** |

**Default:** `"ArmholeCurve"`

> `"ArmholeCurve"` adds several seconds to generation time. Use `"ArmholeSquare"` while iterating quickly.

### `sleeve.length` — Sleeve length

Fraction of the full arm length.

| Value | Visual result |
|---|---|
| `0.1` | Cap sleeve (just covers the shoulder) |
| `0.3` | Short sleeve |
| `0.5` | Elbow length |
| `0.8` | Three-quarter length |
| `1.15` | Full length, past the wrist |

**Range:** 0.1 – 1.15 · **Default:** 0.3

### `sleeve.connecting_width` — Sleeve width at the shoulder

How wide the sleeve is where it connects to the body. Larger values create a puffier top.

**Range:** 0.0 – 2.0 · **Default:** 0.2

### `sleeve.end_width` — Sleeve width at the cuff end

| Value | Visual result |
|---|---|
| `0.2` | Very narrow, tapered sleeve |
| `1.0` | *(default)* Straight tube |
| `1.5` | Flared sleeve |
| `2.0` | Wide bell sleeve |

**Range:** 0.2 – 2.0 · **Default:** 1.0

### `sleeve.sleeve_angle` — Sleeve drape angle

How far the sleeve drops from the horizontal. Higher values make the sleeve hang more steeply downward.

**Range:** 10 – 50 (degrees) · **Default:** 10

### `sleeve.standing_shoulder` — Shoulder pad effect

| Value | Visual result |
|---|---|
| `false` | *(default)* Normal shoulder |
| `true` | Structured / padded-shoulder silhouette |

- `standing_shoulder_len` — pad length when enabled · **Range:** 4 – 10 · **Default:** 5

### `sleeve.cuff` — Wrist cuff

An optional piece added to the sleeve end.

```json
"cuff": {
  "type":           { "v": null },
  "cuff_len":       { "v": 0.1  },
  "skirt_fraction": { "v": 0.5  },
  "skirt_flare":    { "v": 1.2  },
  "skirt_ruffle":   { "v": 1.0  },
  "top_ruffle":     { "v": 1.0  }
}
```

| `type` value | Description |
|---|---|
| `null` | *(default)* No cuff |
| `"CuffBand"` | Plain flat band at the wrist |
| `"CuffSkirt"` | Flared ruffle at the wrist |
| `"CuffBandSkirt"` | Flat band followed by a ruffle |

- `cuff_len` — cuff height as a fraction of sleeve length · **Range:** 0.05 – 0.9
- `skirt_fraction` — what portion of the cuff is the flared skirt part (for `CuffBandSkirt`) · **Range:** 0.1 – 0.9
- `skirt_flare` — how much the ruffle flares outward · **Range:** 1.0 – 2.0
- `skirt_ruffle` — ruffle fullness multiplier · **Range:** 1.0 – 1.5
- `top_ruffle` — gathering at the top of the cuff · **Range:** 1.0 – 3.0

---

## 6. `waistband` — Waist transition piece

Fine-tunes the waistband when `meta.wb` is `"StraightWB"` or `"FittedWB"`.

```json
"waistband": {
  "waist": { "v": 1.0 },
  "width": { "v": 0.2 }
}
```

### `waistband.waist` — Waist ease

How much extra room is in the waistband relative to the body measurement. `1.0` = fitted to the waist measurement. `2.0` = very loose.

**Range:** 1.0 – 2.0 · **Default:** 1.0

### `waistband.width` — Waistband height

How tall the waistband is. `0.1` = thin strip. `1.0` = very wide corset-like band.

**Range:** 0.1 – 1.0 · **Default:** 0.2

---

## 7. Bottom pieces

> Only configure the section that matches your `meta.bottom` choice. The others are silently ignored.

---

### `pencil-skirt`

Use when `meta.bottom` is `"PencilSkirt"`.

```json
"pencil-skirt": {
  "length":     { "v": 0.4 },
  "rise":       { "v": 1.0 },
  "flare":      { "v": 1.0 },
  "low_angle":  { "v": 0   },
  "front_slit": { "v": 0.0 },
  "back_slit":  { "v": 0.0 },
  "left_slit":  { "v": 0.0 },
  "right_slit": { "v": 0.0 }
}
```

#### `pencil-skirt.length`

Fraction of leg length.

| Value | Visual result |
|---|---|
| `0.2` | Very short / mini |
| `0.4` | *(default)* Above the knee |
| `0.6` | Knee length |
| `0.8` | Below the knee / midi |
| `0.95` | Maxi / near floor length |

**Range:** 0.2 – 0.95

#### `pencil-skirt.rise`

How high the waist of the skirt sits on the body.

| Value | Visual result |
|---|---|
| `0.5` | Low rise / hip hugger |
| `1.0` | *(default)* High waist |

**Range:** 0.5 – 1.0

#### `pencil-skirt.flare`

How much the skirt widens toward the hem.

| Value | Visual result |
|---|---|
| `0.6` | Very tight / mermaid taper |
| `1.0` | *(default)* Straight pencil |
| `1.5` | Slight A-line |

**Range:** 0.6 – 1.5

#### `pencil-skirt.low_angle`

Angle of the lower hem edge. Positive = front hem rises; negative = front hem dips.

**Range:** -30 – 30 (degrees) · **Default:** 0

#### Slits

Slits cut upward from the hem.

| Parameter | Side |
|---|---|
| `front_slit` | Center front |
| `back_slit` | Center back |
| `left_slit` | Left side seam |
| `right_slit` | Right side seam |

`0.0` = no slit · `0.9` = slit almost the full skirt length · **Range:** 0.0 – 0.9

---

### `skirt` — Circle and asymmetric skirts

Use when `meta.bottom` is `"SkirtCircle"` or `"AsymmSkirtCircle"`.

```json
"skirt": {
  "length":     { "v": 0.2 },
  "rise":       { "v": 1.0 },
  "ruffle":     { "v": 1.3 },
  "bottom_cut": { "v": 0.0 },
  "flare":      { "v": 0   }
}
```

#### `skirt.length`

| Value | Visual result |
|---|---|
| `-0.2` | Extremely short (above mini) |
| `0.2` | *(default)* Mini |
| `0.5` | Knee length |
| `0.95` | Floor length |

**Range:** -0.2 – 0.95

#### `skirt.ruffle`

Fullness / gathering multiplier. `1.0` = no gathering. `2.0` = very full and gathered.

**Range:** 1.0 – 2.0 · **Default:** 1.3

#### `skirt.bottom_cut`

How much of the center bottom circle is cut away (creates a shorter front/inner panel effect).

`0.0` = no cut · `0.9` = large cut · **Range:** 0.0 – 0.9 · **Default:** 0.0

#### `skirt.flare`

Number of additional triangular gore panels inserted to add flare. `0` = plain circle skirt. Higher values add more volume.

**Range:** 0 – 20 (integer) · **Default:** 0

---

### `flare-skirt` — Flared and multi-panel skirts

Use when `meta.bottom` is `"Skirt2"` or `"SkirtManyPanels"`.

```json
"flare-skirt": {
  "length": { "v": 0.2  },
  "rise":   { "v": 1.0  },
  "suns":   { "v": 0.75 },
  "skirt-many-panels": {
    "n_panels":    { "v": 4 },
    "panel_curve": { "v": 0 }
  },
  "asymm": {
    "front_length": { "v": 0.5 }
  },
  "cut": {
    "add":   { "v": false },
    "depth": { "v": 0.5   },
    "width": { "v": 0.1   },
    "place": { "v": -0.5  }
  }
}
```

#### `flare-skirt.suns`

Controls the circular fullness (how many "suns" worth of fabric). `0.1` = very little flare. `1.95` = almost two full circles of fabric, very dramatic volume.

**Range:** 0.1 – 1.95 · **Default:** 0.75

#### `flare-skirt.skirt-many-panels` (only for `"SkirtManyPanels"`)

- `n_panels` — number of vertical panels · **Range:** 4 – 15 (integer) · **Default:** 4
- `panel_curve` — curvature of each panel's side seams · **Options:** -0.35, -0.25, -0.15, 0, 0.15, 0.25, 0.35, 0.45

#### `flare-skirt.asymm.front_length` (only for `"AsymmSkirtCircle"` via this section)

Controls what fraction of the skirt the front panel extends to. Creates a hi-lo hem effect.

**Range:** 0.1 – 0.9 · **Default:** 0.5

#### `flare-skirt.cut` — Decorative cut-out

Adds a cutout shape on the skirt surface.

- `add` (`bool`) — `true` to enable the cut-out · **Default:** `false`
- `depth` — how deep the cutout goes into the skirt · **Range:** 0.05 – 0.95
- `width` — how wide the cutout is · **Range:** 0.05 – 0.4
- `place` — horizontal position, `-1` = far left, `+1` = far right · **Range:** -1.0 – 1.0

---

### `godet-skirt`

Use when `meta.bottom` is `"GodetSkirt"`. Godets are triangular fabric inserts sewn into slits in a base skirt to add flare.

```json
"godet-skirt": {
  "base":          { "v": "PencilSkirt" },
  "insert_w":      { "v": 15 },
  "insert_depth":  { "v": 20 },
  "num_inserts":   { "v": 4  },
  "cuts_distance": { "v": 5  }
}
```

#### `godet-skirt.base`

The base skirt shape the godets are inserted into.

| Value | Description |
|---|---|
| `"PencilSkirt"` | *(default)* Slim base, godets add dramatic flare |
| `"Skirt2"` | Looser base, more moderate flare |

#### `godet-skirt.insert_w`

Width of each triangular insert at its widest point (in cm). Larger = more flare per insert.

**Range:** 10 – 50 · **Default:** 15

#### `godet-skirt.insert_depth`

How high up the slit goes into the base skirt (in cm). Larger = slit extends higher.

**Range:** 10 – 50 · **Default:** 20

#### `godet-skirt.num_inserts`

Total number of godet inserts around the skirt.

**Options:** 4, 6, 8, 10, 12 · **Default:** 4

#### `godet-skirt.cuts_distance`

Gap between adjacent slit cuts (in cm). Larger values spread the inserts further apart.

**Range:** 0 – 10 · **Default:** 5

---

### `levels-skirt` — Tiered skirts

Use when `meta.bottom` is `"SkirtLevels"`.

```json
"levels-skirt": {
  "base":             { "v": "PencilSkirt"  },
  "level":            { "v": "Skirt2"       },
  "num_levels":       { "v": 1              },
  "level_ruffle":     { "v": 1.0            },
  "length":           { "v": 0.5            },
  "rise":             { "v": 1.0            },
  "base_length_frac": { "v": 0.5            }
}
```

#### `levels-skirt.base` — Base (top) tier shape

| Value | Description |
|---|---|
| `"PencilSkirt"` | *(default)* Fitted top tier |
| `"Skirt2"` | Loose top tier |
| `"SkirtCircle"` | Circular top tier |
| `"AsymmSkirtCircle"` | Asymmetric circular top tier |

#### `levels-skirt.level` — Additional tier shape

Each level added below the base uses this shape.

| Value | Description |
|---|---|
| `"Skirt2"` | *(default)* Simple panel tier |
| `"SkirtCircle"` | Circular flowy tier |
| `"AsymmSkirtCircle"` | Asymmetric circular tier |

#### `levels-skirt.num_levels`

How many additional tiers are added below the base tier. `1` = just the base. `5` = very layered.

**Range:** 1 – 5 · **Default:** 1

#### `levels-skirt.level_ruffle`

Fullness of each additional tier. `1.0` = flat/ungathered. `1.7` = very ruffled.

**Range:** 1.0 – 1.7 · **Default:** 1.0

#### `levels-skirt.base_length_frac`

What fraction of the total skirt length the base tier occupies. `0.5` = equal split.

**Range:** 0.2 – 0.8 · **Default:** 0.5

---

### `pants`

Use when `meta.bottom` is `"Pants"`. **Pants are slow to compute — expect several seconds per request.**

```json
"pants": {
  "length": { "v": 0.3 },
  "width":  { "v": 1.0 },
  "flare":  { "v": 1.0 },
  "rise":   { "v": 1.0 },
  "cuff": {
    "type":     { "v": null },
    "cuff_len": { "v": 0.1  }
  }
}
```

#### `pants.length`

Fraction of leg length.

| Value | Visual result |
|---|---|
| `0.2` | Very short shorts |
| `0.4` | Bermuda / knee length |
| `0.6` | Capri / three-quarter |
| `0.9` | Full length trousers |

**Range:** 0.2 – 0.9 · **Default:** 0.3

#### `pants.width`

How wide the legs are. `1.0` = fitted. `1.5` = wide-leg / palazzo style.

**Range:** 1.0 – 1.5 · **Default:** 1.0

#### `pants.flare`

Whether the legs taper or flare toward the hem. `1.0` = straight. `1.2` = slightly flared (boot-cut). `0.5` = tapered (skinny-style).

**Range:** 0.5 – 1.2 · **Default:** 1.0

#### `pants.rise`

How high the waist sits. `1.0` = high waist. `0.5` = low rise.

**Range:** 0.5 – 1.0 · **Default:** 1.0

#### `pants.cuff`

Same structure as `sleeve.cuff` (see [Section 5](#sleeveuff--wrist-cuff)). Adds a cuff at the trouser hem.

---

## 8. `left` — Per-side asymmetry overrides

By default, the garment is perfectly symmetrical. Enabling asymmetry lets you configure the left side of the shirt, collar, and sleeve independently from the right.

```json
"left": {
  "enable_asym": { "v": true },
  "shirt": {
    "strapless": { "v": true },
    "width":     { "v": 1.0  },
    "flare":     { "v": 1.2  }
  },
  "collar": { ... },
  "sleeve": { ... }
}
```

### `left.enable_asym`

| Value | Effect |
|---|---|
| `false` | *(default)* Left side mirrors the right; `left.*` values are ignored |
| `true` | Left side uses its own independent values |

When `enable_asym` is `false`, any values you set inside `left.shirt`, `left.collar`, or `left.sleeve` are silently discarded.

The available parameters inside `left.shirt`, `left.collar`, and `left.sleeve` are a subset of the main `shirt`, `collar`, and `sleeve` sections — the same names and ranges apply.

---

## 9. Complete recipes

These are ready-to-paste JSON bodies for common garment types.

---

### Classic T-shirt

```json
{
  "design": {
    "meta": {
      "upper":  { "v": "Shirt" },
      "bottom": { "v": null    }
    },
    "shirt": {
      "length": { "v": 1.0 },
      "width":  { "v": 1.1 }
    },
    "collar": {
      "f_collar": { "v": "CircleNeckHalf" },
      "fc_depth": { "v": 0.3 },
      "width":    { "v": 0.2 }
    },
    "sleeve": {
      "sleeveless":    { "v": false          },
      "armhole_shape": { "v": "ArmholeSquare" },
      "length":        { "v": 0.3            },
      "end_width":     { "v": 1.0            }
    }
  }
}
```

---

### Fitted dress with V-neck

```json
{
  "design": {
    "meta": {
      "upper":  { "v": "FittedShirt" },
      "wb":     { "v": null          },
      "bottom": { "v": "PencilSkirt" }
    },
    "shirt": {
      "length": { "v": 0.6 },
      "width":  { "v": 1.0 }
    },
    "collar": {
      "f_collar": { "v": "VNeckHalf" },
      "fc_depth": { "v": 0.8 },
      "width":    { "v": 0.3 }
    },
    "sleeve": {
      "sleeveless": { "v": true }
    },
    "pencil-skirt": {
      "length": { "v": 0.75 },
      "rise":   { "v": 1.0  }
    }
  }
}
```

---

### Blouse with waistband and circle skirt

```json
{
  "design": {
    "meta": {
      "upper":  { "v": "Shirt"       },
      "wb":     { "v": "StraightWB"  },
      "bottom": { "v": "SkirtCircle" }
    },
    "shirt": {
      "length": { "v": 0.9  },
      "width":  { "v": 1.15 }
    },
    "collar": {
      "f_collar": { "v": "SquareNeckHalf" },
      "fc_depth": { "v": 0.5 }
    },
    "sleeve": {
      "sleeveless":    { "v": false    },
      "armhole_shape": { "v": "ArmholeSquare" },
      "length":        { "v": 0.6     },
      "end_width":     { "v": 1.5     },
      "cuff": {
        "type":     { "v": "CuffBand" },
        "cuff_len": { "v": 0.1       }
      }
    },
    "waistband": {
      "width": { "v": 0.3 }
    },
    "skirt": {
      "length": { "v": 0.6 },
      "ruffle": { "v": 1.5 }
    }
  }
}
```

---

### Wide-leg trousers with turtleneck top

```json
{
  "design": {
    "meta": {
      "upper":  { "v": "FittedShirt" },
      "wb":     { "v": "FittedWB"   },
      "bottom": { "v": "Pants"       }
    },
    "shirt": {
      "length": { "v": 1.0 },
      "width":  { "v": 1.0 }
    },
    "collar": {
      "f_collar": { "v": "CircleNeckHalf" },
      "fc_depth": { "v": 0.3 },
      "component": {
        "style": { "v": "Turtle" },
        "depth": { "v": 6       }
      }
    },
    "sleeve": {
      "sleeveless":    { "v": false           },
      "armhole_shape": { "v": "ArmholeSquare" },
      "length":        { "v": 1.0             },
      "end_width":     { "v": 0.9             }
    },
    "pants": {
      "length": { "v": 0.9 },
      "width":  { "v": 1.4 },
      "flare":  { "v": 1.1 },
      "rise":   { "v": 1.0 }
    }
  }
}
```

---

### Asymmetric top (left sleeve vs right sleeve)

```json
{
  "design": {
    "meta": {
      "upper":  { "v": "FittedShirt" },
      "bottom": { "v": null          }
    },
    "shirt": {
      "length":    { "v": 1.0   },
      "strapless": { "v": false }
    },
    "sleeve": {
      "sleeveless": { "v": false          },
      "length":     { "v": 1.0           },
      "armhole_shape": { "v": "ArmholeSquare" }
    },
    "left": {
      "enable_asym": { "v": true },
      "sleeve": {
        "sleeveless": { "v": true }
      }
    }
  }
}
```

Right side has a full-length sleeve; left side is sleeveless.

---

## 10. Quick-reference tables

### `meta.upper` options

| Value | Notes |
|---|---|
| `"FittedShirt"` | Tailored; supports all collar and sleeve features |
| `"Shirt"` | Loose boxy cut |
| `null` | No top piece |

### `meta.wb` options

| Value | Notes |
|---|---|
| `"StraightWB"` | Flat rectangular waistband |
| `"FittedWB"` | Curved to follow waist |
| `null` | No waistband |

### `meta.bottom` options and matching section

| Value | Section | Notes |
|---|---|---|
| `"PencilSkirt"` | `pencil-skirt` | Slim fitted skirt |
| `"SkirtCircle"` | `skirt` | Full circle skirt |
| `"AsymmSkirtCircle"` | `skirt` | Circle skirt, asymmetric hem |
| `"Skirt2"` | `flare-skirt` | Simple two-panel |
| `"SkirtManyPanels"` | `flare-skirt` | Multi-panel, set `n_panels` |
| `"GodetSkirt"` | `godet-skirt` | Triangular inserts |
| `"SkirtLevels"` | `levels-skirt` | Tiered layers |
| `"Pants"` | `pants` | Trousers — slow |
| `null` | — | No bottom |

### Collar neckline shapes

| Value | Front look |
|---|---|
| `"CircleNeckHalf"` | Round crew neck |
| `"VNeckHalf"` | V-neck |
| `"SquareNeckHalf"` | Square / boat neck |
| `"CurvyNeckHalf"` | Sweetheart curve |
| `"TrapezoidNeckHalf"` | Wide flat |
| `"CircleArcNeckHalf"` | Shallow arc |
| `"Bezier2NeckHalf"` | Freeform via `bezier_x/y` |

### Collar add-on components

| Value | Effect |
|---|---|
| `null` | Plain neckline |
| `"Turtle"` | Turtleneck |
| `"SimpleLapel"` | Open lapel |
| `"Hood2Panels"` | Hood — slow |

### Armhole shapes

| Value | Speed |
|---|---|
| `"ArmholeSquare"` | Fast |
| `"ArmholeAngle"` | Fast |
| `"ArmholeCurve"` | Slow |

### Cuff types (sleeve and pants)

| Value | Description |
|---|---|
| `null` | No cuff |
| `"CuffBand"` | Flat band |
| `"CuffSkirt"` | Flared ruffle |
| `"CuffBandSkirt"` | Band + ruffle |

### Slow parameters — expect longer response times

| Parameter | Reason |
|---|---|
| `meta.bottom: "Pants"` | Complex trouser geometry |
| `sleeve.armhole_shape: "ArmholeCurve"` | Curved armhole computation |
| `collar.component.style: "Hood2Panels"` | Hood geometry |
| `shirt.strapless: true` with `FittedShirt` | Strapless bodice computation |
