// Download selection state; resolves scope and triggers export.

import { useCallback, useState } from "react";
import { downloadJsonFile } from "../../../lib/downloadFile";
import type { MpaLevel } from "../constants";
import { buildDownloadGeoJson, type DownloadScope } from "../utils/buildDownloadGeoJson";
import type { CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

// What to export within the current view level. "self" = the selected unit's own
// boundary; the others export one child level (single level per file).
export type ExportKind = "self" | "provinces" | "municipalities" | "barangays";

interface UseMpaDownloadOptions {
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    country: CountryGeoJSON | null;
}

export function useMpaDownload({ regions, provinces, municities, municityMeta, country }: UseMpaDownloadOptions) {
    const [level, setLevelState] = useState<MpaLevel>("province");
    const [selectedRegionPsgc, setSelectedRegionPsgc] = useState<string | null>(null);
    const [selectedProvincePsgc, setSelectedProvincePsgc] = useState<string | null>(null);
    const [selectedMunicityPsgc, setSelectedMunicityPsgcState] = useState<string | null>(null);
    const [selectedBarangayPsgc, setSelectedBarangayPsgc] = useState<string | null>(null);
    const [regionFilterPsgc, setRegionFilterPsgc] = useState<string | null>(null);
    const [provinceFilterPsgc, setProvinceFilterPsgc] = useState<string | null>(null);
    const [exportKind, setExportKind] = useState<ExportKind>("self");
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setMunicityPsgc = useCallback((psgc: string | null) => {
        setSelectedMunicityPsgcState(psgc);
        setSelectedBarangayPsgc(null);
        if (!psgc && level === "barangay") {
            setLevelState("municipality");
            setExportKind("self");
        }
    }, [level]);

    const setLevel = useCallback((next: MpaLevel) => {
        if (next === "barangay" && !selectedMunicityPsgc) {
            return;
        }
        setLevelState(next);
        setExportKind("self");
    }, [selectedMunicityPsgc]);

    const setSelectionFromMap = useCallback(
        (mode: MpaLevel, entityPsgc: string) => {
            setLevelState(mode);
            setExportKind("self");
            if (mode === "country") {
                return;
            }
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
            } else if (mode === "municipality") {
                const muni =
                    municities.find((m) => m.psgc === entityPsgc) ??
                    municityMeta.find((m) => m.psgc === entityPsgc);
                setSelectedMunicityPsgcState(entityPsgc);
                setSelectedBarangayPsgc(null);
                if (muni?.province_psgc) {
                    setProvinceFilterPsgc(muni.province_psgc);
                    const province = provinces.find((p) => p.psgc === muni.province_psgc);
                    if (province) setRegionFilterPsgc(province.region_psgc);
                }
            } else if (mode === "barangay") {
                setSelectedBarangayPsgc(entityPsgc);
            }
        },
        [provinces, municities, municityMeta],
    );

    const resolveScope = useCallback((): DownloadScope => {
        if (level === "country") {
            return { kind: "country" };
        }

        if (level === "region") {
            if (!selectedRegionPsgc) throw new Error("Select a region");
            if (exportKind === "provinces") {
                return { kind: "provincesInRegion", regionPsgc: selectedRegionPsgc };
            }
            if (exportKind === "municipalities") {
                return { kind: "munisInRegion", regionPsgc: selectedRegionPsgc };
            }
            return { kind: "region", regionPsgc: selectedRegionPsgc };
        }

        if (level === "province") {
            if (!selectedProvincePsgc) throw new Error("Select a province");
            if (exportKind === "municipalities") {
                return { kind: "munisInProvince", provincePsgc: selectedProvincePsgc };
            }
            return { kind: "province", provincePsgc: selectedProvincePsgc };
        }

        if (level === "barangay") {
            const muniPsgc = selectedMunicityPsgc;
            if (!muniPsgc) throw new Error("Select a municipality");
            if (!selectedBarangayPsgc) throw new Error("Select a barangay");
            return { kind: "barangay", municityPsgc: muniPsgc, barangayPsgc: selectedBarangayPsgc };
        }

        // municipality level
        const muniPsgc = selectedMunicityPsgc;
        if (!muniPsgc) throw new Error("Select a municipality");
        if (exportKind === "barangays") {
            return { kind: "bgysInMunicity", municityPsgc: muniPsgc };
        }
        const provPsgc =
            provinceFilterPsgc ??
            selectedProvincePsgc ??
            municityMeta.find((m) => m.psgc === muniPsgc)?.province_psgc ??
            null;
        if (!provPsgc) throw new Error("Select a municipality");
        return { kind: "municipality", municityPsgc: muniPsgc, provincePsgc: provPsgc };
    }, [
        level,
        exportKind,
        selectedRegionPsgc,
        selectedProvincePsgc,
        selectedMunicityPsgc,
        selectedBarangayPsgc,
        provinceFilterPsgc,
        municityMeta,
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
                country,
            });
            downloadJsonFile(result.geojson, result.filename);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Download failed");
        } finally {
            setDownloading(false);
        }
    }, [level, resolveScope, regions, provinces, municities, municityMeta, country]);

    return {
        level,
        setLevel,
        selectedRegionPsgc,
        setSelectedRegionPsgc,
        selectedProvincePsgc,
        setSelectedProvincePsgc,
        selectedMunicityPsgc,
        setSelectedMunicityPsgc: setMunicityPsgc,
        selectedBarangayPsgc,
        setSelectedBarangayPsgc,
        regionFilterPsgc,
        setRegionFilterPsgc,
        provinceFilterPsgc,
        setProvinceFilterPsgc,
        exportKind,
        setExportKind,
        downloading,
        error,
        setSelectionFromMap,
        download,
    };
}
