#!/usr/bin/env python3
"""Convert country + barangay shapefiles to PSGC-keyed GeoJSON under public/geo."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from geojson_geom import make_transformer, shape_to_geojson
from psgc_lookup import PsgcEntry, load_psgc_csv, pad_psgc, resolve_psgc_from_record
from shapefile_utils import field_names, open_reader, read_prj_wkt, record_as_dict, resolve_shapefile_base, verify_shapefile_set

try:
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union
except ImportError:
    shape = None  # type: ignore
    mapping = None  # type: ignore
    unary_union = None  # type: ignore


SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = SCRIPT_DIR / "../../public"
SHAPE_DIR = PUBLIC_DIR / "shape"
GEO_DIR = PUBLIC_DIR / "geo"
BGY_DIR = GEO_DIR / "municities" / "bgy"
PSGC_CSV = PUBLIC_DIR / "psgc.csv"
MUNI_META = GEO_DIR / "municities" / "meta.json"

CODE_FIELDS = ("adm4_psgc", "psgc_code", "ADM4_PCODE", "adm4_pcode", "PSGC_CODE")
MUNI_FIELDS = ("adm3_psgc", "adm3_pcode", "ADM3_PCODE")
NAME_FIELDS = ("adm4_en", "name", "ADM4_EN", "NAME")
GEO_LVL_FIELDS = ("geo_level", "geo_lvl", "GEO_LEVEL")

# Shapefile municity (adm3) codes that have no arithmetic/correspondence path
# to the current PSGC. Map them to the canonical 10-digit municity PSGC so
# their barangays can be recovered by name within that municity.
# Key: shapefile adm3_psgc (as string of digits). Value: canonical municity PSGC.
MUNI_CODE_OVERRIDES: dict[str, str] = {
    "630200000": "1830200000",  # Bacolod City (HUC) — stale region-06 adm3 code
}

# Shapefile adm4 codes whose polygon should be merged (geometric union) into
# another barangay. San Rafael (Calaca, Batangas) was abolished and merged into
# Dacanlao per the Supreme Court ruling upheld April 2025.
# Key: shapefile adm4 code digits. Value: target canonical barangay PSGC.
BGY_MERGE: dict[str, str] = {
    "401007038": "0401007019",  # San Rafael -> Dacanlao, Calaca, Batangas
}

# Shapefile adm4 codes kept as a single barangay even though the current PSGC
# split them. Caloocan "Barangay 176" exists in PSGC only as 176-A..176-F, but
# the shapefile carries one polygon, so we keep it whole under its own code.
SYNTHETIC_BGY: dict[str, dict[str, str]] = {
    "1380100176": {
        "psgc": "1380100176",
        "name": "Barangay 176",
        "municity_psgc": "1380100000",
        "geo_lvl": "Bgy",
    },
}


def shapefile_muni_digits(muni_raw: Any) -> str | None:
    if muni_raw is None:
        return None
    digits = "".join(c for c in str(muni_raw) if c.isdigit())
    return digits or None


def resolve_muni_override(muni_digits: str) -> str | None:
    """Map stale shapefile adm3 codes to canonical municity PSGC."""
    if muni_digits in MUNI_CODE_OVERRIDES:
        return MUNI_CODE_OVERRIDES[muni_digits]
    # Sulu: shapefile encodes under BARMM region-19 prefix (19066…) but PSGC
    # canonical municities use region-09 (09066…). Verified 100% name overlap.
    if muni_digits.startswith("19066") and len(muni_digits) == 10:
        return "09" + muni_digits[2:]
    return None


def build_unique_name_index(
    by_muni_name: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Barangay names that appear exactly once in the entire PSGC index."""
    counts: dict[str, int] = defaultdict(int)
    first: dict[str, Any] = {}
    for names in by_muni_name.values():
        for name, entry in names.items():
            counts[name] += 1
            first.setdefault(name, entry)
    return {name: entry for name, entry in first.items() if counts[name] == 1}


def resolve_bgy_fallback(
    muni_raw: Any,
    name_raw: Any,
    by_muni_name: dict[str, dict[str, Any]],
    by_unique_name: dict[str, Any],
) -> tuple[str | None, Any | None]:
    """Recover a barangay when the shapefile adm4 code does not match PSGC."""
    if not name_raw:
        return None, None
    name_key = str(name_raw).strip().lower()
    if not name_key:
        return None, None

    muni_digits = shapefile_muni_digits(muni_raw)
    candidates: list[str] = []
    if muni_digits:
        override = resolve_muni_override(muni_digits)
        if override:
            candidates.append(override)
        padded = pad_psgc(muni_raw)
        if padded and padded not in candidates:
            candidates.append(padded)

    for municity in candidates:
        entry = by_muni_name.get(municity, {}).get(name_key)
        if entry:
            return entry.psgc, entry

    entry = by_unique_name.get(name_key)
    if entry:
        return entry.psgc, entry

    return None, None


def pick_field(rec: dict[str, Any], candidates: tuple[str, ...]) -> Any:
    for key in candidates:
        if key in rec and rec[key] not in (None, ""):
            return rec[key]
        lower = {k.lower(): v for k, v in rec.items()}
        for key in candidates:
            if key.lower() in lower and lower[key.lower()] not in (None, ""):
                return lower[key.lower()]
    return None


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":")))
    kb = round(path.stat().st_size / 1024)
    print(f"  {path.relative_to(GEO_DIR)} — {kb} KB")


def load_municity_parents() -> dict[str, dict[str, str | None]]:
    meta = json.loads(MUNI_META.read_text(encoding="utf-8"))
    return {
        row["psgc"]: {
            "province_psgc": row.get("province_psgc"),
            "region_psgc": row.get("region_psgc"),
        }
        for row in meta
    }


def convert_country(args: argparse.Namespace, muni_parents: dict) -> None:
    adm0_base = resolve_shapefile_base(SHAPE_DIR / "PH_Adm0_Country.shp")
    out_path = GEO_DIR / "country.json"

    try:
        verify_shapefile_set(adm0_base)
        reader = open_reader(adm0_base)
        wkt = read_prj_wkt(adm0_base)
        transformer = make_transformer(wkt)
        geoms = []
        for sr in reader.iterShapeRecords():
            g = shape_to_geojson(sr.shape, transformer)
            if g:
                geoms.append(g)
        if len(geoms) == 1:
            geometry = geoms[0]
        elif shape and unary_union:
            geometry = mapping(unary_union([shape(g) for g in geoms]))
        else:
            geometry = geoms[0] if geoms else None
        print("Country: converted from Adm0 shapefile")
    except SystemExit:
        print("Country: Adm0 shapefile incomplete — building from regions.json union", file=sys.stderr)
        regions = json.loads((GEO_DIR / "regions.json").read_text(encoding="utf-8"))
        if not shape or not unary_union:
            raise RuntimeError("shapely required for country fallback from regions")
        geometry = mapping(unary_union([shape(r["geometry"]) for r in regions if r.get("geometry")]))

    if args.simplify and shape:
        geometry = mapping(shape(geometry).simplify(args.simplify, preserve_topology=True))

    record = {
        "psgc": "0000000000",
        "correspondence": None,
        "name": "Philippines",
        "geo_lvl": "Country",
        "city_lvl": None,
        "geometry": geometry,
    }
    write_json(out_path, record)


def convert_barangays(args: argparse.Namespace, muni_parents: dict) -> None:
    bgy_base = resolve_shapefile_base(SHAPE_DIR / args.bgy_source)
    reader = open_reader(bgy_base)
    wkt = read_prj_wkt(bgy_base)
    transformer = make_transformer(wkt)

    by_psgc, by_corr = load_psgc_csv(PSGC_CSV)

    # Index barangays by parent municity + lowercased name for override recovery.
    by_muni_name: dict[str, dict[str, Any]] = defaultdict(dict)
    for entry in by_psgc.values():
        municity = entry.psgc[:7] + "000"
        key = (entry.name or "").strip().lower()
        if key:
            by_muni_name[municity].setdefault(key, entry)
    by_unique_name = build_unique_name_index(by_muni_name)

    if BGY_DIR.exists():
        shutil.rmtree(BGY_DIR)
    BGY_DIR.mkdir(parents=True)

    by_municity: dict[str, list[dict[str, Any]]] = defaultdict(list)
    meta_rows: list[dict[str, Any]] = []
    seen_psgc: set[str] = set()
    merge_geoms: dict[str, list[Any]] = defaultdict(list)

    unmatched: list[dict[str, Any]] = []
    stats = {
        "total": 0,
        "matched": 0,
        "merged": 0,
        "bgy_not_found": 0,
        "parent_not_found": 0,
        "duplicate": 0,
        "no_geometry": 0,
    }

    for idx, sr in enumerate(reader.iterShapeRecords()):
        stats["total"] += 1
        rec = record_as_dict(reader, sr.record)
        code_raw = pick_field(rec, CODE_FIELDS)
        name_raw = pick_field(rec, NAME_FIELDS)
        geo_lvl_raw = pick_field(rec, GEO_LVL_FIELDS)
        muni_raw = pick_field(rec, MUNI_FIELDS)

        code_digits = "".join(c for c in str(code_raw) if c.isdigit()) if code_raw is not None else ""

        if code_digits in BGY_MERGE:
            geometry = shape_to_geojson(sr.shape, transformer)
            if geometry:
                merge_geoms[BGY_MERGE[code_digits]].append(geometry)
            stats["merged"] += 1
            print(f"[merge] {code_digits} ({name_raw}) -> {BGY_MERGE[code_digits]}", file=sys.stderr)
            continue

        psgc, csv_entry = resolve_psgc_from_record(code_raw, by_psgc, by_corr)

        if not csv_entry and code_digits in SYNTHETIC_BGY:
            spec = SYNTHETIC_BGY[code_digits]
            csv_entry = PsgcEntry(
                psgc=spec["psgc"],
                name=spec["name"],
                correspondence=None,
                geo_lvl=spec.get("geo_lvl", "Bgy"),
                city_lvl=None,
            )
            psgc = spec["psgc"]

        if not csv_entry:
            psgc, csv_entry = resolve_bgy_fallback(
                muni_raw, name_raw, by_muni_name, by_unique_name
            )

        if not csv_entry:
            stats["bgy_not_found"] += 1
            print(
                f"[bgy not found in PSGC] code={code_raw!r} name={name_raw!r} idx={idx}",
                file=sys.stderr,
            )
            unmatched.append({"reason": "bgy_not_found", "code": code_raw, "name": name_raw, "idx": idx})
            continue

        psgc = csv_entry.psgc
        if psgc in seen_psgc:
            stats["duplicate"] += 1
            print(f"[duplicate psgc] psgc={psgc} name={name_raw!r}", file=sys.stderr)
            unmatched.append({"reason": "duplicate", "psgc": psgc, "name": name_raw, "idx": idx})
            continue
        seen_psgc.add(psgc)

        # Prefer the parent derived from the matched (canonical) barangay PSGC,
        # since the shapefile's adm3_psgc can use stale/renumbered region codes.
        candidate_munis = [
            psgc[:7] + "000",
            pad_psgc(muni_raw),
        ]
        municity_psgc = None
        parents = None
        for cand in candidate_munis:
            if cand and cand in muni_parents:
                municity_psgc = cand
                parents = muni_parents[cand]
                break
            # SubMun districts (e.g. Manila's Tondo/Sampaloc) roll up to the
            # parent city: 1380606000 -> 1380600000.
            if cand:
                city_psgc = cand[:5] + "00000"
                if city_psgc in muni_parents:
                    municity_psgc = city_psgc
                    parents = muni_parents[city_psgc]
                    break
        if municity_psgc is None:
            municity_psgc = candidate_munis[0]
        if not parents:
            stats["parent_not_found"] += 1
            print(
                f"[parent municity not found] bgy={psgc} municity_psgc={municity_psgc} name={csv_entry.name}",
                file=sys.stderr,
            )
            unmatched.append({
                "reason": "parent_not_found",
                "psgc": psgc,
                "municity_psgc": municity_psgc,
                "name": csv_entry.name,
            })
            continue

        geometry = shape_to_geojson(sr.shape, transformer)
        if not geometry:
            stats["no_geometry"] += 1
            print(f"[no geometry] psgc={psgc} name={csv_entry.name}", file=sys.stderr)
            continue

        geo_lvl = csv_entry.geo_lvl or (str(geo_lvl_raw) if geo_lvl_raw else "Bgy")
        row = {
            "psgc": psgc,
            "correspondence": csv_entry.correspondence,
            "name": csv_entry.name or (str(name_raw) if name_raw else ""),
            "geo_lvl": geo_lvl,
            "city_lvl": csv_entry.city_lvl,
            "municity_psgc": municity_psgc,
            "province_psgc": parents["province_psgc"],
            "region_psgc": parents["region_psgc"],
            "geometry": geometry,
        }
        by_municity[municity_psgc].append(row)
        meta_rows.append({k: v for k, v in row.items() if k != "geometry"})
        stats["matched"] += 1

        if stats["total"] % 5000 == 0:
            print(f"  … processed {stats['total']} features")

    # Union merged-away polygons (e.g. San Rafael) into their target barangay.
    for target_psgc, geoms in merge_geoms.items():
        target_row = next(
            (r for rows in by_municity.values() for r in rows if r["psgc"] == target_psgc),
            None,
        )
        if not target_row:
            print(f"[merge] target {target_psgc} not found; skipping union", file=sys.stderr)
            continue
        if not shape or not unary_union:
            print("[merge] shapely required for geometry union; skipping", file=sys.stderr)
            break
        parts = [shape(target_row["geometry"])] + [shape(g) for g in geoms]
        target_row["geometry"] = mapping(unary_union(parts))
        print(f"[merge] unioned {len(geoms)} polygon(s) into {target_psgc}", file=sys.stderr)

    municity_psgcs = sorted(by_municity.keys())
    print(f"Writing {len(municity_psgcs)} per-municity barangay files…")
    for mpsgc in municity_psgcs:
        write_json(BGY_DIR / f"{mpsgc}.json", by_municity[mpsgc])

    write_json(BGY_DIR / "meta.json", meta_rows)
    write_json(BGY_DIR / "manifest.json", {"municityPsgcs": municity_psgcs})

    report = {
        "stats": stats,
        "unmatched": unmatched,
        "missing_municities": sorted({u["municity_psgc"] for u in unmatched if u.get("reason") == "parent_not_found"}),
    }
    write_json(BGY_DIR / "_unmatched.json", report)

    print("\n=== Barangay conversion summary ===")
    print(f"  total features:     {stats['total']}")
    print(f"  matched:            {stats['matched']}")
    print(f"  merged into others: {stats['merged']}")
    print(f"  bgy not in PSGC:    {stats['bgy_not_found']}")
    print(f"  parent not found:   {stats['parent_not_found']}")
    print(f"  duplicate psgc:     {stats['duplicate']}")
    print(f"  no geometry:        {stats['no_geometry']}")
    print(f"  municities w/ bgy:  {len(municity_psgcs)}")
    print(f"  report:             {BGY_DIR / '_unmatched.json'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert shapefiles to PSGC GeoJSON")
    parser.add_argument(
        "--bgy-source",
        default="PH_Adm4_BgySubMuns.shp",
        help="Barangay shapefile base name in public/shape",
    )
    parser.add_argument(
        "--simplify",
        type=float,
        default=0.0,
        help="Douglas-Peucker tolerance (degrees) for country geometry; 0 = no simplify",
    )
    parser.add_argument("--skip-country", action="store_true")
    parser.add_argument("--skip-bgy", action="store_true")
    args = parser.parse_args()

    if not PSGC_CSV.exists():
        print(f"ERROR: missing {PSGC_CSV}", file=sys.stderr)
        sys.exit(1)
    if not MUNI_META.exists():
        print(f"ERROR: missing {MUNI_META} — run pnpm build:geo first", file=sys.stderr)
        sys.exit(1)

    muni_parents = load_municity_parents()
    print(f"Loaded {len(muni_parents)} municity parent records")

    if not args.skip_country:
        convert_country(args, muni_parents)
    if not args.skip_bgy:
        convert_barangays(args, muni_parents)

    print(f"\nDone → {GEO_DIR}")


if __name__ == "__main__":
    main()
