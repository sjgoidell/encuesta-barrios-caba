# The %-per-manzana formula — as it works today

_Last updated: 2026-06-14 (P1-FORMULA-DOC). **Documentation only** — evaluation/
alternatives are deferred to P4E-FORMULA. This describes current behavior, not a
recommendation._

The same logic runs in two places:
- `src/utils/MapViewPreprocess.js` → `enrichManzana()` (offline, output unused at runtime)
- `src/components/MapView.jsx` → `enrichManzana()` (the version actually rendered)

Both are identical in substance. The numbers shown in the tooltip come from the
**MapView.jsx** version.

## Inputs
- **Manzanas**: city blocks (`merged-manzanas.geojson`), each a polygon with an `id`.
- **Responses**: each respondent contributes a drawn **barrio polygon** (`geometry`),
  a **home pin** (`pinLocation` = `{lat,lng}`), and a **barrio name** (`barrio`).
- **cleanedBarrios**: whitelist of valid normalized barrio slugs.

## Per-block computation (for one manzana `M`)

```
C = centroid(M)
barrios = {}            # slug -> accumulated weight
total = 0

for each response R:
    if NOT polygon(R) intersects M:            skip          # turf.booleanIntersects
    slug = normalize(R.barrio)                                # lowercase, strip accents/spaces
    if slug.length < 5 OR slug not in cleanedBarrios: skip
    pin = R.pinLocation
    if pin invalid:                            skip
    d = haversine_distance(pin, C) in km
    if d > 5:                                  skip           # 5 km cap
    w = 1 / (d + 0.01)                                        # inverse-distance weight
    barrios[slug] += w
    total += w

# Outputs for M (only kept if total > 0):
percent[slug]  = barrios[slug] / total * 100                 # the tooltip %
majorityBarrio = argmax_slug barrios[slug]
blendedColor   = Σ_slug (percent[slug]/100) * color(slug)    # RGB-weighted blend of barrio colors
```

- **Tooltip**: each barrio bar = `round(weight_slug / total * 100)%`, sorted desc.
- **Fill color**: a single blended RGB color = weighted average of each
  contributing barrio's palette color, weighted by its share.
- A block with `total == 0` (no qualifying responses) is dropped entirely.

## What the % currently represents (plain language)

> Of the **inverse-distance-weighted "votes"** from respondents whose **drawn
> barrio polygon overlaps this block** *and* whose **home pin is within 5 km of
> the block's centroid**, what share assigned the block to each barrio name.

It is a **proximity-weighted share of overlapping respondents** — **not**:
- a simple count share of respondents,
- an area-of-overlap share,
- population-normalized in any way.

## Behavioral quirks worth noting (for the P4E discussion — not asserted as bugs)

1. **Weight is by pin↔centroid distance, not polygon overlap.** A respondent
   whose polygon barely clips a block but who lives next to it dominates; one who
   lives 4 km away but drew a polygon covering the block contributes little.
2. **The 5 km cap** is generous for CABA (the city is ~ that wide), so it rarely
   binds — but it can silently exclude valid far-but-overlapping polygons.
3. **`1/(d+0.01)`** makes very close pins extremely heavy (a pin ~10 m from the
   centroid ≈ weight 100), so a single nearby respondent can swamp a block.
4. **Each respondent contributes to many blocks** (every block their polygon
   touches within 5 km), so "votes" are not one-per-person-per-block-equivalent.
5. The intersection test uses the polygon, but the weight uses the pin — the two
   can disagree.

These are **observations to confirm against intent** in P4E-FORMULA, where the
first question is: *what is each % meant to claim?* (share of respondents?
density? population-normalized?). The right formula depends on that answer.
