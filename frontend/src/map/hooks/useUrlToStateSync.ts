/**
 * Hook to sync URL path to map state with strict loop prevention.
 * Parses hierarchical paths (/{region}/{province}/{municipality}/{barangay})
 * and updates selection state accordingly.
 */

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../types";
import { slugify } from "../../lib/slugUtils";
import type { MapLevel } from "../constants";

interface UseUrlToStateSyncOptions {
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    onSetRegion: (psgc: string | null) => void;
    onSetProvince: (psgc: string | null) => void;
    onSetMunicity: (psgc: string | null) => void;
    onSetBarangay?: (psgc: string | null) => void;
    onSetLevel: (level: MapLevel) => void;
}

export function useUrlToStateSync({
    regions,
    provinces,
    municityMeta,
    barangays,
    onSetRegion,
    onSetProvince,
    onSetMunicity,
    onSetBarangay,
    onSetLevel,
}: UseUrlToStateSyncOptions) {
    const location = useLocation();
    const navigate = useNavigate();
    const lastSyncedPathRef = useRef<string>("");

    useEffect(() => {
        const pathname = location.pathname;

        if (pathname === "/privacy" || pathname === "/terms") {
            return;
        }

        // Infinite loop guard: if we just synced to this pathname, skip
        if (lastSyncedPathRef.current === pathname) {
            return;
        }

        // Geographic data is loaded asynchronously. If lists are still empty,
        // wait for them to load rather than running fallbacks that reset to home.
        if (regions.length === 0 || provinces.length === 0 || municityMeta.length === 0) {
            return;
        }

        const segments = pathname.split("/").filter(Boolean);

        // Root path: reset to country view
        if (segments.length === 0) {
            lastSyncedPathRef.current = pathname;
            onSetLevel("country");
            onSetRegion(null);
            onSetProvince(null);
            onSetMunicity(null);
            onSetBarangay?.(null);
            return;
        }

        // 1. Resolve Region
        const regSlug = segments[0].toLowerCase();
        const region = regions.find((r) => slugify(r.name) === regSlug);
        if (!region) {
            lastSyncedPathRef.current = "/";
            navigate("/", { replace: true });
            return;
        }

        if (segments.length === 1) {
            lastSyncedPathRef.current = pathname;
            onSetLevel("region");
            onSetRegion(region.psgc);
            onSetProvince(null);
            onSetMunicity(null);
            onSetBarangay?.(null);
            return;
        }

        // 2. Resolve Province
        const provSlug = segments[1].toLowerCase();
        const province = provinces.find((p) => p.region_psgc === region.psgc && slugify(p.name) === provSlug);
        if (!province) {
            lastSyncedPathRef.current = `/${regSlug}`;
            navigate(`/${regSlug}`, { replace: true });
            return;
        }

        if (segments.length === 2) {
            lastSyncedPathRef.current = pathname;
            onSetLevel("province");
            onSetRegion(region.psgc);
            onSetProvince(province.psgc);
            onSetMunicity(null);
            onSetBarangay?.(null);
            return;
        }

        // 3. Resolve Municipality
        const muniSlug = segments[2].toLowerCase();
        const muni = municityMeta.find((m) => m.province_psgc === province.psgc && slugify(m.name) === muniSlug);
        if (!muni) {
            const parentPath = `/${regSlug}/${provSlug}`;
            lastSyncedPathRef.current = parentPath;
            navigate(parentPath, { replace: true });
            return;
        }

        if (segments.length === 3) {
            lastSyncedPathRef.current = pathname;
            onSetLevel("municipality");
            onSetRegion(region.psgc);
            onSetProvince(province.psgc);
            onSetMunicity(muni.psgc);
            onSetBarangay?.(null);
            return;
        }

        // 4. Resolve Barangay
        const bgySlug = segments[3].toLowerCase();
        // If barangays list is still loading, wait for it
        if (barangays.length === 0) {
            return;
        }

        const bgy = barangays.find((b) => b.municity_psgc === muni.psgc && slugify(b.name) === bgySlug);
        if (bgy) {
            lastSyncedPathRef.current = pathname;
            onSetLevel("barangay");
            onSetRegion(region.psgc);
            onSetProvince(province.psgc);
            onSetMunicity(muni.psgc);
            onSetBarangay?.(bgy.psgc);
        } else {
            const parentPath = `/${regSlug}/${provSlug}/${muniSlug}`;
            lastSyncedPathRef.current = parentPath;
            navigate(parentPath, { replace: true });
        }
    }, [
        location.pathname,
        regions,
        provinces,
        municityMeta,
        barangays,
        navigate,
        onSetRegion,
        onSetProvince,
        onSetMunicity,
        onSetBarangay,
        onSetLevel,
    ]);
}
