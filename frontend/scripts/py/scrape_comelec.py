#!/usr/bin/env python3
"""
Download official 2022 COMELEC transparency results (region -> barangay).

Vendored and adapted from ianalis/scraper2022 (MIT License):
  https://github.com/ianalis/scraper2022
Original author: ianalis. See COMELEC_SCRAPER_LICENSE.txt for the MIT notice.

Adaptations by Mapa:
  - `--max-rank` to stop the crawl at a chosen tier (region/province/citymun/
    barangay). The default stops at city/municipality, which is fast and is all
    that is needed for region+province+citymun maps. Use barangay only when you
    want the heavy (~100k precinct) crawl.
  - contest files are also downloaded while saving COCs, so candidate names are
    available even without scraping down to precinct level.
  - resumable: already-downloaded files are never re-fetched.
  - `--only-region` to limit the crawl to one or more regions (e.g. NCR only
    for barangay). Skips other regions at the country node; safe to run later
    against the same data dir without re-downloading finished areas.
  - `--only-citymun` to limit heavy barangay downloads to named city/municipality
    subtrees (e.g. Manila only within NCR). Walks the tree to find matches but
    only downloads COCs and precinct ERs inside the matched area.

The official server (2022electionresults.comelec.gov.ph) is geo-/WAF-restricted,
so run this from a normal Philippine connection. Data is a work of the Philippine
government (public domain, RA 8293 s.176); attribute "COMELEC 2022 transparency".

Usage:
  python scrape_comelec.py                      # stop at city/municipality
  python scrape_comelec.py --max-rank barangay  # full crawl incl. precincts
  python scrape_comelec.py --max-rank barangay --only-region NCR
  python scrape_comelec.py --max-rank barangay --only-region NCR --only-citymun MANILA
  python scrape_comelec.py -b data -d 0.3
"""

import os
import json
import time
import logging
from operator import itemgetter

import click
import requests

BASE_URL = "https://2022electionresults.comelec.gov.ph/data"
RETRY_WAIT = 1.0

# Tier ranks. COMELEC `can` (category) strings map onto these. Anything that is
# not country/region/province/barangay (e.g. "Municipality", "City", NCR
# "District") is treated as the city/municipality tier (rank 3).
RANK = {"country": 0, "region": 1, "province": 2, "citymun": 3, "barangay": 4}

# Short names accepted by --only-region (case-insensitive).
REGION_ALIASES = {
    "NCR": "NATIONAL CAPITAL REGION",
    "CAR": "CORDILLERA ADMINISTRATIVE REGION",
    "BARMM": "BARMM",
    "CALABARZON": "REGION IV-A",
    "MIMAROPA": "REGION IV-B",
    "NIR": "NEGROS ISLAND REGION",
    "OAV": "OAV",
}


def rank_of(can: str) -> int:
    c = (can or "").strip().lower()
    if c == "country":
        return RANK["country"]
    if c == "region":
        return RANK["region"]
    if c == "province":
        return RANK["province"]
    if c == "barangay":
        return RANK["barangay"]
    return RANK["citymun"]


def urljoin(*args):
    return "/".join(args)


def _norm_region(s: str) -> str:
    return (s or "").strip().upper()


def region_matches(child_name: str, filters: tuple[str, ...]) -> bool:
    """True if child_name matches any --only-region filter (aliases supported)."""
    child = _norm_region(child_name)
    for raw in filters:
        filt = _norm_region(REGION_ALIASES.get(_norm_region(raw), raw))
        if filt == child:
            return True
        if filt in child or child in filt:
            return True
    return False


def _norm_name(s: str) -> str:
    return (s or "").strip().upper()


def citymun_matches(name: str, filters: tuple[str, ...]) -> bool:
    """True if name matches any --only-citymun filter (substring, case-insensitive)."""
    n = _norm_name(name)
    for raw in filters:
        filt = _norm_name(raw)
        if filt == n:
            return True
        if filt in n or n in filt:
            return True
    return False


def load_or_download(sess, file_path, url, download_delay):
    """Read file_path if it exists, else download from url and cache it."""
    if os.path.exists(file_path):
        with open(file_path) as f:
            return json.load(f)
    try:
        logging.info(f"downloading {url}")
        data = sess.get(url, timeout=60).json()
        time.sleep(download_delay)
    except json.JSONDecodeError:
        raise ValueError("Results not available.")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w") as f:
        json.dump(data, f)
    return data


def download_contests(sess, base_dir, result_json, download_delay):
    """Download contest lookup files referenced by a COC/precinct result."""
    contests = set(map(itemgetter("cc"), result_json.get("rs", [])))
    for contest in contests:
        contest_path = os.path.join(base_dir, "contests", f"{contest}.json")
        contest_url = urljoin(BASE_URL, "contests", f"{contest}.json")
        while True:
            try:
                load_or_download(sess, contest_path, contest_url, download_delay)
                break
            except ValueError:
                time.sleep(RETRY_WAIT)


def download_data(
    sess,
    base_dir,
    node_dir,
    node_url,
    download_delay,
    max_rank,
    only_regions: tuple[str, ...] = (),
    only_citymuns: tuple[str, ...] = (),
    inside_target: bool = False,
):
    """Recursively download info + COC (and precinct ERs at barangay)."""
    info_path = os.path.join(base_dir, "results", node_dir, "info.json")
    info_url = urljoin(BASE_URL, "regions", node_url)
    while True:
        try:
            node_info = load_or_download(sess, info_path, info_url, download_delay)
            break
        except ValueError:
            time.sleep(RETRY_WAIT)

    can = node_info.get("can", "")
    rank = rank_of(can)
    node_name = node_info.get("rn", os.path.basename(node_dir) if node_dir else "")

    matched_here = (
        bool(only_citymuns)
        and rank >= RANK["province"]
        and citymun_matches(node_name, only_citymuns)
    )
    inside = inside_target or matched_here or (not only_citymuns)

    if can == "Barangay":
        # Barangay tier: aggregate the clustered-precinct ERs.
        if inside and rank <= max_rank:
            for precinct in node_info.get("pps", []):
                precinct_path = os.path.join(
                    base_dir, "results", node_dir, precinct["ppcc"] + ".json"
                )
                precinct_url = urljoin(
                    BASE_URL, "results", precinct["vbs"][0]["url"] + ".json"
                )
                try:
                    res = load_or_download(sess, precinct_path, precinct_url, download_delay)
                except ValueError:
                    continue
                download_contests(sess, base_dir, res, download_delay)
        return

    # Aggregated node: download its Certificate of Canvass.
    if inside:
        for coc in node_info.get("pps", []):
            coc_path = os.path.join(base_dir, "results", node_dir, "coc.json")
            coc_url = urljoin(BASE_URL, "results", coc["vbs"][0]["url"] + ".json")
            try:
                res = load_or_download(sess, coc_path, coc_url, download_delay)
                download_contests(sess, base_dir, res, download_delay)
            except ValueError:
                pass

    # Recurse into children unless we've hit the requested tier.
    if rank >= max_rank:
        return
    for child in node_info.get("srs", {}).values():
        if only_regions and can == "Country":
            if not region_matches(child["rn"], only_regions):
                logging.info(f"skipping region {child['rn']} (--only-region)")
                continue
        child_dir = os.path.join(node_dir, child["rn"].replace("/", "_"))
        download_data(
            sess,
            base_dir,
            child_dir,
            child["url"] + ".json",
            download_delay,
            max_rank,
            only_regions,
            only_citymuns,
            inside,
        )


@click.command()
@click.option("-b", "--base-dir", default="data", help="output directory")
@click.option("-d", "--download-delay", type=float, default=0.3, help="delay between downloads (s)")
@click.option(
    "--max-rank",
    type=click.Choice(["region", "province", "citymun", "barangay"]),
    default="citymun",
    help="deepest tier to download (citymun is fast; barangay is the heavy crawl)",
)
@click.option(
    "--only-region",
    multiple=True,
    help=(
        "limit crawl to named region(s); repeat for multiple. "
        "Aliases: NCR, CAR, BARMM, CALABARZON, MIMAROPA. "
        "Example: --only-region NCR"
    ),
)
@click.option(
    "--only-citymun",
    multiple=True,
    help=(
        "limit heavy downloads to named city/municipality subtree(s); repeat for "
        "multiple. Substring match (MANILA matches CITY OF MANILA). "
        "Combine with --only-region NCR for Manila barangays only."
    ),
)
@click.option("-l", "--log-level", default="INFO",
              type=click.Choice(["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"]))
def main(base_dir, download_delay, max_rank, only_region, only_citymun, log_level):
    logging.basicConfig(level=log_level, format="%(message)s")
    sess = requests.Session()
    sess.headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": "https://2022electionresults.comelec.gov.ph/",
    }
    target = RANK[max_rank]
    regions = tuple(only_region)
    citymuns = tuple(only_citymun)
    scope_parts = []
    if regions:
        scope_parts.append(f"region(s) {', '.join(regions)}")
    if citymuns:
        scope_parts.append(f"city/mun(s) {', '.join(citymuns)}")
    if scope_parts:
        logging.info(
            f"Scraping COMELEC 2022 to tier='{max_rank}' "
            f"for {'; '.join(scope_parts)} into '{base_dir}/'"
        )
    else:
        logging.info(f"Scraping COMELEC 2022 to tier='{max_rank}' into '{base_dir}/'")
    download_data(
        sess, base_dir, "", "root.json", download_delay, target, regions, citymuns
    )
    logging.info("Done.")


if __name__ == "__main__":
    main()
