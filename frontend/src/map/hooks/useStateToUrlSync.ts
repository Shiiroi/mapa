/**
 * Hook to sync map state to URL with strict loop prevention.
 * When the user selects a region or province, update the browser URL.
 * Before navigating, check if the pathname already matches the target.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Region, ProvinceGeoJSON } from "../types";
import { slugify } from "../../lib/slugUtils";

interface UseStateToUrlSyncOptions {
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    selectedRegionPsgc: string | null;
    selectedProvincePsgc: string | null;
    level: "country" | "region" | "province" | "municipality" | "barangay";
}

export function useStateToUrlSync({
    regions,
    provinces,
    selectedRegionPsgc,
    selectedProvincePsgc,
    level,
}: UseStateToUrlSyncOptions) {
    const navigate = useNavigate();
    const lastNavigatedPathRef = useRef<string>("");

    useEffect(() => {
        let targetPath: string | null = null;

        if (level === "region" && selectedRegionPsgc) {
            const region = regions.find((r) => r.psgc === selectedRegionPsgc);
            if (region) {
                targetPath = `/region/${slugify(region.name)}`;
            }
        } else if (level === "province" && selectedProvincePsgc) {
            const province = provinces.find((p) => p.psgc === selectedProvincePsgc);
            if (province) {
                targetPath = `/province/${slugify(province.name)}`;
            }
        } else if (level === "country") {
            targetPath = "/";
        }

        // Infinite loop guard: check if the current path already matches the target
        if (targetPath && window.location.pathname !== targetPath && lastNavigatedPathRef.current !== targetPath) {
            lastNavigatedPathRef.current = targetPath;
            navigate(targetPath, { replace: true });
        }
    }, [selectedRegionPsgc, selectedProvincePsgc, level, regions, provinces, navigate]);
}
