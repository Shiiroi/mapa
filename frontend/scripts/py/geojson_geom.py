"""Geometry helpers: reproject shapefile shapes to GeoJSON (EPSG:4326)."""

from __future__ import annotations

from typing import Any

import shapefile as sf
from pyproj import Transformer
from shapefile import Shape


def make_transformer(src_wkt: str) -> Transformer:
    return Transformer.from_crs(src_wkt, "EPSG:4326", always_xy=True)


def _transform_ring(ring: list[tuple[float, float]], transformer: Transformer | None) -> list[list[float]]:
    if transformer is None:
        return [[x, y] for x, y in ring]
    out: list[list[float]] = []
    for x, y in ring:
        lon, lat = transformer.transform(x, y)
        out.append([lon, lat])
    return out


def shape_to_geojson(shape: Shape, transformer: Transformer | None) -> dict[str, Any] | None:
    """Converts a pyshp Shape to a GeoJSON geometry dict."""
    if shape.shapeType == sf.NULL:
        return None

    parts = list(shape.parts) + [len(shape.points)]
    rings: list[list[list[float]]] = []
    for i in range(len(shape.parts)):
        ring_pts = shape.points[parts[i] : parts[i + 1]]
        if len(ring_pts) < 3:
            continue
        rings.append(_transform_ring(ring_pts, transformer))

    if not rings:
        return None

    if len(rings) == 1:
        return {"type": "Polygon", "coordinates": [rings[0]]}
    return {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}
