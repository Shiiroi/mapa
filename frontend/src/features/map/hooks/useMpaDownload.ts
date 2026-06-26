// Download selection state; resolves scope and triggers export.

import { useCallback, useState } from "react";
import { downloadJsonFile } from "../../../lib/downloadFile";
import type { MpaLevel } from "../constants";
import { buildDownloadGeoJson, type DownloadScope } from "../utils/buildDownloadGeoJson";
import type { CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

export type DownloadMode = "single" | "subdivisions" | "allMunisInProvince" | "allBgysInMunicity";

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
    const [downloadMode, setDownloadMode] = useState<DownloadMode>("single");
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setMunicityPsgc = useCallback((psgc: string | null) => {
        setSelectedMunicityPsgcState(psgc);
        setSelectedBarangayPsgc(null);
        if (!psgc && level === "barangay") {
            setLevelState("municipality");
            setDownloadMode("single");
        }
    }, [level]);

    const setLevel = useCallback((next: MpaLevel) => {
        if (next === "barangay" && !selectedMunicityPsgc) {
            return;
        }
        setLevelState(next);
        setDownloadMode("single");
    }, [selectedMunicityPsgc]);

    const setSelectionFromMap = useCallback(
        (mode: MpaLevel, entityPsgc: string) => {
            setLevelState(mode);
            setDownloadMode("single");
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

        if (level === "barangay") {
            const muniPsgc = selectedMunicityPsgc;
            if (!muniPsgc) throw new Error("Select a municipality");
            if (downloadMode === "allBgysInMunicity") {
                return { kind: "bgysInMunicity", municityPsgc: muniPsgc };
            }
            if (!selectedBarangayPsgc) throw new Error("Select a barangay");
            return { kind: "barangay", municityPsgc: muniPsgc, barangayPsgc: selectedBarangayPsgc };
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
        selectedBarangayPsgc,
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
        downloadMode,
        setDownloadMode,
        downloading,
        error,
        setSelectionFromMap,
        download,
    };
}
