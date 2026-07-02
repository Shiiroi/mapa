/**
 * Hook to sync URL path to map state with strict loop prevention.
 * When the URL changes (direct navigation), parse the slug and update the selection state.
 * Before setting state, check if the current pathname already matches the target to prevent loops.
 */

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Region, ProvinceGeoJSON } from "../types";
import { slugify } from "../../lib/slugUtils";
import type { MapLevel } from "../constants";

interface UseUrlToStateSyncOptions {
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    onSetRegion: (psgc: string | null) => void;
    onSetProvince: (psgc: string | null) => void;
    onSetLevel: (level: MapLevel) => void;
}

export function useUrlToStateSync({ regions, provinces, onSetRegion, onSetProvince, onSetLevel }: UseUrlToStateSyncOptions) {
    const location = useLocation();
    const navigate = useNavigate();
    const lastSyncedPathRef = useRef<string>("");

    useEffect(() => {
        const pathname = location.pathname;

        // Infinite loop guard: if we just synced to this pathname, skip
        if (lastSyncedPathRef.current === pathname) {
            return;
        }

        // Parse region slug
        const regionMatch = pathname.match(/^\/region\/(.+?)(?:\/|$)/);
        if (regionMatch) {
            const slug = regionMatch[1].toLowerCase();
            const region = regions.find((r) => slugify(r.name) === slug);

            if (region) {
                lastSyncedPathRef.current = pathname;
                onSetLevel("region");
                onSetRegion(region.psgc);
                onSetProvince(null);
            } else {
                // Region slug not found; fallback to home once
                if (pathname !== "/") {
                    lastSyncedPathRef.current = "/";
                    navigate("/", { replace: true });
                }
            }
            return;
        }

        // Parse province slug
        const provinceMatch = pathname.match(/^\/province\/(.+?)(?:\/|$)/);
        if (provinceMatch) {
            const slug = provinceMatch[1].toLowerCase();
            const province = provinces.find((p) => slugify(p.name) === slug);

            if (province) {
                lastSyncedPathRef.current = pathname;
                onSetLevel("province");
                onSetProvince(province.psgc);
                // Set region filter if available
                const region = regions.find((r) => r.psgc === province.region_psgc);
                if (region) {
                    onSetRegion(region.psgc);
                }
            } else {
                // Province slug not found; fallback to home once
                if (pathname !== "/") {
                    lastSyncedPathRef.current = "/";
                    navigate("/", { replace: true });
                }
            }
            return;
        }

        // Root path; reset selection
        if (pathname === "/" && lastSyncedPathRef.current !== pathname) {
            lastSyncedPathRef.current = pathname;
            onSetLevel("country");
            onSetRegion(null);
            onSetProvince(null);
        }
    }, [location.pathname, regions, provinces, navigate, onSetRegion, onSetProvince, onSetLevel]);
}
