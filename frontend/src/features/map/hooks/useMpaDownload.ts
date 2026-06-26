// Download selection state; resolves scope and triggers export.

import { useCallback, useState } from "react";
import { downloadJsonFile } from "../../../lib/downloadFile";
import type { MpaLevel } from "../constants";
import { buildDownloadGeoJson, type DownloadScope } from "../utils/buildDownloadGeoJson";
import type { MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

export type DownloadMode = "single" | "subdivisions" | "allMunisInProvince";

interface UseMpaDownloadOptions {
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
}

export function useMpaDownload({ regions, provinces, municities, municityMeta }: UseMpaDownloadOptions) {
    const [level, setLevel] = useState<MpaLevel>("province");
    const [selectedRegionPsgc, setSelectedRegionPsgc] = useState<string | null>(null);
    const [selectedProvincePsgc, setSelectedProvincePsgc] = useState<string | null>(null);
    const [selectedMunicityPsgc, setSelectedMunicityPsgc] = useState<string | null>(null);
    const [regionFilterPsgc, setRegionFilterPsgc] = useState<string | null>(null);
    const [provinceFilterPsgc, setProvinceFilterPsgc] = useState<string | null>(null);
    const [downloadMode, setDownloadMode] = useState<DownloadMode>("single");
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setSelectionFromMap = useCallback(
        (mode: MpaLevel, entityPsgc: string) => {
            setLevel(mode);
            setDownloadMode("single");
            if (mode === "region") {
                setSelectedRegionPsgc(entityPsgc);
                setRegionFilterPsgc(entityPsgc);
            } else if (mode === "province") {
                const province = provinces.find((p) => p.psgc === entityPsgc);
                setSelectedProvincePsgc(entityPsgc);
                if (province) {
                    setRegionFilterPsgc(province.region_psgc);
                    setProvinceFilterPsgc(entityPsgc);
                }
            } else {
                const muni =
                    municities.find((m) => m.psgc === entityPsgc) ??
                    municityMeta.find((m) => m.psgc === entityPsgc);
                setSelectedMunicityPsgc(entityPsgc);
                if (muni?.province_psgc) {
                    setProvinceFilterPsgc(muni.province_psgc);
                    const province = provinces.find((p) => p.psgc === muni.province_psgc);
                    if (province) setRegionFilterPsgc(province.region_psgc);
                }
            }
        },
        [provinces, municities, municityMeta],
    );

    const resolveScope = useCallback((): DownloadScope => {
        if (level === "region") {
            if (!selectedRegionPsgc) throw new Error("Select a region");
            if (downloadMode === "subdivisions") {
                return { kind: "provincesInRegion", regionPsgc: selectedRegionPsgc };
            }
            return { kind: "region", regionPsgc: selectedRegionPsgc };
        }

        if (level === "province") {
            if (downloadMode === "subdivisions") {
                const regionPsgc = selectedRegionPsgc ?? regionFilterPsgc;
                if (!regionPsgc) throw new Error("Select a region");
                return { kind: "munisInRegion", regionPsgc };
            }
            if (!selectedProvincePsgc) throw new Error("Select a province");
            return { kind: "province", provincePsgc: selectedProvincePsgc };
        }

        if (downloadMode === "allMunisInProvince") {
            const psgc = provinceFilterPsgc ?? selectedProvincePsgc;
            if (!psgc) throw new Error("Select a province");
            return { kind: "munisInProvince", provincePsgc: psgc };
        }

        const muniPsgc = selectedMunicityPsgc;
        const provPsgc = provinceFilterPsgc ?? selectedProvincePsgc;
        if (!muniPsgc || !provPsgc) throw new Error("Select a municipality");
        return { kind: "municipality", municityPsgc: muniPsgc, provincePsgc: provPsgc };
    }, [
        level,
        downloadMode,
        selectedRegionPsgc,
        selectedProvincePsgc,
        selectedMunicityPsgc,
        provinceFilterPsgc,
        regionFilterPsgc,
    ]);

    const download = useCallback(async () => {
        setError(null);
        setDownloading(true);
        try {
            const scope = resolveScope();
            const result = await buildDownloadGeoJson({
                level,
                scope,
                regions,
                provinces,
                municities,
                municityMeta,
            });
            downloadJsonFile(result.geojson, result.filename);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Download failed");
        } finally {
            setDownloading(false);
        }
    }, [level, resolveScope, regions, provinces, municities, municityMeta]);

    return {
        level,
        setLevel,
        selectedRegionPsgc,
        setSelectedRegionPsgc,
        selectedProvincePsgc,
        setSelectedProvincePsgc,
        selectedMunicityPsgc,
        setSelectedMunicityPsgc,
        regionFilterPsgc,
        setRegionFilterPsgc,
        provinceFilterPsgc,
        setProvinceFilterPsgc,
        downloadMode,
        setDownloadMode,
        downloading,
        error,
        setSelectionFromMap,
        download,
    };
}
