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
    const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
    const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
    const [selectedMunicityId, setSelectedMunicityId] = useState<number | null>(null);
    const [regionFilterId, setRegionFilterId] = useState<number | null>(null);
    const [provinceFilterId, setProvinceFilterId] = useState<number | null>(null);
    const [downloadMode, setDownloadMode] = useState<DownloadMode>("single");
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Syncs sidebar pickers when a map feature is clicked.
    const setSelectionFromMap = useCallback(
        (mode: MpaLevel, entityId: number) => {
            setLevel(mode);
            setDownloadMode("single");
            if (mode === "region") {
                setSelectedRegionId(entityId);
                setRegionFilterId(entityId);
            } else if (mode === "province") {
                const province = provinces.find((p) => p.id === entityId);
                setSelectedProvinceId(entityId);
                if (province) {
                    setRegionFilterId(province.region_id);
                    setProvinceFilterId(entityId);
                }
            } else {
                const muni = municities.find((m) => m.id === entityId) ?? municityMeta.find((m) => m.id === entityId);
                setSelectedMunicityId(entityId);
                if (muni?.province_id) {
                    setProvinceFilterId(muni.province_id);
                    const province = provinces.find((p) => p.id === muni.province_id);
                    if (province) setRegionFilterId(province.region_id);
                }
            }
        },
        [provinces, municities, municityMeta],
    );

    // Maps sidebar level, mode, and selections to a download scope.
    const resolveScope = useCallback((): DownloadScope => {
        if (level === "region") {
            if (!selectedRegionId) throw new Error("Select a region");
            if (downloadMode === "subdivisions") {
                return { kind: "provincesInRegion", regionId: selectedRegionId };
            }
            return { kind: "region", regionId: selectedRegionId };
        }

        if (level === "province") {
            if (downloadMode === "subdivisions") {
                const regionId = selectedRegionId ?? regionFilterId;
                if (!regionId) throw new Error("Select a region");
                return { kind: "munisInRegion", regionId };
            }
            if (!selectedProvinceId) throw new Error("Select a province");
            return { kind: "province", provinceId: selectedProvinceId };
        }

        if (downloadMode === "allMunisInProvince") {
            const pid = provinceFilterId ?? selectedProvinceId;
            if (!pid) throw new Error("Select a province");
            return { kind: "munisInProvince", provinceId: pid };
        }

        const muniId = selectedMunicityId;
        const pid = provinceFilterId ?? selectedProvinceId;
        if (!muniId || !pid) throw new Error("Select a municipality");
        return { kind: "municipality", municityId: muniId, provinceId: pid };
    }, [
        level,
        downloadMode,
        selectedRegionId,
        selectedProvinceId,
        selectedMunicityId,
        provinceFilterId,
        regionFilterId,
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
        selectedRegionId,
        setSelectedRegionId,
        selectedProvinceId,
        setSelectedProvinceId,
        selectedMunicityId,
        setSelectedMunicityId,
        regionFilterId,
        setRegionFilterId,
        provinceFilterId,
        setProvinceFilterId,
        downloadMode,
        setDownloadMode,
        downloading,
        error,
        setSelectionFromMap,
        download,
    };
}
