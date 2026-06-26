#!/usr/bin/env python3
"""Print shapefile metadata: fields, sample records, CRS, feature count, bbox."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shapefile_utils import field_names, open_reader, read_prj_wkt, record_as_dict, resolve_shapefile_base


def inspect(base_path: str) -> None:
    base = resolve_shapefile_base(base_path)
    print(f"\n=== {base.name} ===")
    print(f"base: {base}")

    reader = open_reader(base)
    names = field_names(reader)
    print(f"features: {len(reader)}")
    print(f"shapeType: {reader.shapeType}")
    print(f"fields ({len(names)}): {names}")

    wkt = read_prj_wkt(base)
    print(f"CRS (first 120 chars): {wkt[:120]}…" if len(wkt) > 120 else f"CRS: {wkt}")

    bbox = reader.bbox
    print(f"bbox (source CRS): {bbox}")

    print("sample records:")
    for i, sr in enumerate(reader.iterShapeRecords()):
        if i >= 3:
            break
        rec = record_as_dict(reader, sr.record)
        print(f"  [{i}] {rec}  parts={len(sr.shape.parts)} points={len(sr.shape.points)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect an ESRI shapefile set")
    parser.add_argument(
        "paths",
        nargs="*",
        default=[
            "../../public/shape/PH_Adm4_BgySubMuns.shp",
            "../../public/shape/BgySubMuns.shp",
            "../../public/shape/PH_Adm0_Country.shp",
        ],
        help="Shapefile base path(s)",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    for raw in args.paths:
        p = Path(raw)
        if not p.is_absolute():
            p = (script_dir / raw).resolve()
        try:
            inspect(str(p))
        except SystemExit:
            print(f"  SKIPPED (incomplete set): {p}", file=sys.stderr)


if __name__ == "__main__":
    main()
