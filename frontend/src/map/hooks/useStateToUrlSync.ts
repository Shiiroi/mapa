/**
 * Hook to sync map state to URL with strict loop prevention.
 * Constructs deep URL paths based on active region, province, municipality, and barangay.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../types";
import { slugify } from "../../lib/slugUtils";

interface UseStateToUrlSyncOptions {
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    selectedRegionPsgc: string | null;
    selectedProvincePsgc: string | null;
    selectedMunicityPsgc: string | null;
    selectedBarangayPsgc: string | null;
    level: "country" | "region" | "province" | "municipality" | "barangay";
}

export function useStateToUrlSync({
    regions,
    provinces,
    municityMeta,
    barangays,
    selectedRegionPsgc,
    selectedProvincePsgc,
    selectedMunicityPsgc,
    selectedBarangayPsgc,
    level,
}: UseStateToUrlSyncOptions) {
    const navigate = useNavigate();
    const lastNavigatedPathRef = useRef<string>("");

    useEffect(() => {
        // Return early while core geographic lists are still loading.
        // Prevents premature redirects to "/" (country level) on initial deep-link mount.
        if (regions.length === 0 || provinces.length === 0 || municityMeta.length === 0) {
            return;
        }

        let targetPath: string | null = null;

        if (level === "country") {
            targetPath = "/";
        } else if (level === "region" && selectedRegionPsgc) {
            const region = regions.find((r) => r.psgc === selectedRegionPsgc);
            if (region) {
                targetPath = `/${slugify(region.name)}`;
            }
        } else if (level === "province" && selectedProvincePsgc) {
            const province = provinces.find((p) => p.psgc === selectedProvincePsgc);
            if (province) {
                const region = regions.find((r) => r.psgc === province.region_psgc);
                if (region) {
                    targetPath = `/${slugify(region.name)}/${slugify(province.name)}`;
                }
            }
        } else if (level === "municipality" && selectedMunicityPsgc) {
            const muni = municityMeta.find((m) => m.psgc === selectedMunicityPsgc);
            if (muni) {
                const province = provinces.find((p) => p.psgc === muni.province_psgc);
                const region = regions.find((r) => r.psgc === muni.region_psgc);
                if (region && province) {
                    targetPath = `/${slugify(region.name)}/${slugify(province.name)}/${slugify(muni.name)}`;
                }
            }
        } else if (level === "barangay" && selectedBarangayPsgc) {
            const bgy = barangays.find((b) => b.psgc === selectedBarangayPsgc);
            if (bgy) {
                const muni = municityMeta.find((m) => m.psgc === bgy.municity_psgc);
                if (muni) {
                    // Pull region and province from municipality if missing on barangay record
                    const provincePsgc = bgy.province_psgc || muni.province_psgc;
                    const regionPsgc = bgy.region_psgc || muni.region_psgc;
                    const province = provinces.find((p) => p.psgc === provincePsgc);
                    const region = regions.find((r) => r.psgc === regionPsgc);
                    if (region && province) {
                        targetPath = `/${slugify(region.name)}/${slugify(province.name)}/${slugify(muni.name)}/${slugify(bgy.name)}`;
                    }
                }
            }
        }

        // Only update if we successfully resolved a target path and it differs from current pathname
        if (targetPath && window.location.pathname !== targetPath) {
            lastNavigatedPathRef.current = targetPath;
            navigate(targetPath, { replace: true });
        }
    }, [
        selectedRegionPsgc,
        selectedProvincePsgc,
        selectedMunicityPsgc,
        selectedBarangayPsgc,
        level,
        regions,
        provinces,
        municityMeta,
        barangays,
        navigate,
    ]);
}
