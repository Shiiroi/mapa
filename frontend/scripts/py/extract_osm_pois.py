#!/usr/bin/env python3
"""Count OpenStreetMap hospitals (amenity=hospital) per province polygon."""

from __future__ import annotations

import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from shapely.geometry import Point, shape
    from shapely.prepared import prep
except ImportError:
    print("ERROR: shapely required. Run: pip install shapely", file=sys.stderr)
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = SCRIPT_DIR / "../../public"
PROVINCES_JSON = PUBLIC_DIR / "geo/provinces.json"
OUT_CSV = PUBLIC_DIR / "osm_hospitals_by_province.csv"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "mapa-frontend/1.0 (local data pipeline; contact: local dev)"
MAX_RETRIES = 6
# Philippines bounding box (generous) for a single nationwide Overpass query.
PH_BBOX = (4.0, 116.0, 22.5, 127.5)  # south, west, north, east


def load_provinces() -> list[dict]:
    with PROVINCES_JSON.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("provinces.json must be a list of province features")
    return data


def overpass_all_hospitals(south: float, west: float, north: float, east: float) -> list[tuple[float, float]]:
    query = f"""
    [out:json][timeout:180];
    (
      node["amenity"="hospital"]({south},{west},{north},{east});
      way["amenity"="hospital"]({south},{west},{north},{east});
      relation["amenity"="hospital"]({south},{west},{north},{east});
    );
    out center;
    """
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    payload: dict | None = None
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(
            OVERPASS_URL,
            data=body,
            headers={"User-Agent": USER_AGENT},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                payload = json.load(resp)
            break
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code in (429, 504) and attempt + 1 < MAX_RETRIES:
                wait = 5 * (2**attempt)
                print(f"Overpass {exc.code}, retry in {wait}s…", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
    if payload is None:
        raise last_err or RuntimeError("Overpass query failed")

    points: list[tuple[float, float]] = []
    for el in payload.get("elements", []):
        if el.get("type") == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue
        points.append((float(lon), float(lat)))
    return points


def count_in_polygon(points: list[tuple[float, float]], polygon) -> int:
    prepared = prep(polygon)
    count = 0
    for lon, lat in points:
        if prepared.contains(Point(lon, lat)):
            count += 1
    return count


def main() -> None:
    if not PROVINCES_JSON.exists():
        print(f"ERROR: missing {PROVINCES_JSON}", file=sys.stderr)
        sys.exit(1)

    provinces = load_provinces()
    south, west, north, east = PH_BBOX

    print(f"Fetching OSM hospitals for Philippines bbox ({south},{west},{north},{east})…")
    points = overpass_all_hospitals(south, west, north, east)
    print(f"  {len(points)} hospital features in bbox")

    rows: list[dict[str, str | int]] = []
    for i, prov in enumerate(provinces, start=1):
        psgc = str(prov["psgc"]).zfill(10)
        name = prov.get("name", psgc)
        geom = shape(prov["geometry"])
        count = count_in_polygon(points, geom)
        rows.append({"psgc": psgc, "level": "province", "name": name, "hospital_count": count})
        print(f"  [{i}/{len(provinces)}] {name}: {count}")

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["psgc", "level", "name", "hospital_count"])
        writer.writeheader()
        writer.writerows(rows)

    total = sum(int(r["hospital_count"]) for r in rows)
    print(f"Wrote {OUT_CSV} ({len(rows)} rows, {total} hospitals total)")


if __name__ == "__main__":
    main()
