// Split-layout shell: map panel and download sidebar.

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MpaMapPanel } from "../features/map/components/MpaMapPanel";
import { MpaSidebar } from "../features/map/components/MpaSidebar";
import { useMpaDownload } from "../features/map/hooks/useMpaDownload";
import { useMapLayers } from "../features/map/hooks/useMapLayers";
import { fetchBarangaysByMunicity } from "../features/map/services/mapApi";
import { computeDensityBenchmarks } from "../features/map/utils/densityInsights";
import type { MpaLevel } from "../features/map/constants";

export default function MainPage() {
    const { provinces, municities, municityMeta, regions, country, loading, error } = useMapLayers();

    const download = useMpaDownload({ regions, provinces, municities, municityMeta, country });

    const barangaysQuery = useQuery({
        queryKey: ["barangays", download.selectedMunicityPsgc],
        queryFn: () => fetchBarangaysByMunicity(download.selectedMunicityPsgc!),
        enabled: download.level === "barangay" && !!download.selectedMunicityPsgc,
        staleTime: 10 * 60 * 1000,
    });

    const barangays = barangaysQuery.data ?? [];

    const benchmarks = useMemo(
        () => computeDensityBenchmarks(regions, provinces, municities),
        [regions, provinces, municities],
    );

    const handleFeatureClick = useCallback(
        (entityPsgc: string, mode: MpaLevel) => {
            download.setSelectionFromMap(mode, entityPsgc);
        },
        [download],
    );

    return (
        <div className="flex h-dvh flex-col lg:grid lg:grid-cols-[3fr_2fr]">
            <div className="min-h-[55dvh] flex-1 lg:min-h-0">
                <MpaMapPanel
                    country={country}
                    provinces={provinces}
                    regions={regions}
                    municities={municities}
                    barangays={download.level === "barangay" ? barangays : []}
                    mode={download.level}
                    onFeatureClick={handleFeatureClick}
                    loading={loading || (download.level === "barangay" && barangaysQuery.isFetching)}
                    error={error ?? (barangaysQuery.error as Error | null)}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden lg:flex-none">
                <MpaSidebar
                    level={download.level}
                    onLevelChange={download.setLevel}
                    regions={regions}
                    provinces={provinces}
                    municities={municities}
                    municityMeta={municityMeta}
                    country={country}
                    barangays={barangays}
                    barangaysLoading={barangaysQuery.isFetching}
                    selectedRegionPsgc={download.selectedRegionPsgc}
                    onRegionChange={download.setSelectedRegionPsgc}
                    selectedProvincePsgc={download.selectedProvincePsgc}
                    onProvinceChange={download.setSelectedProvincePsgc}
                    selectedMunicityPsgc={download.selectedMunicityPsgc}
                    onMunicityChange={download.setSelectedMunicityPsgc}
                    selectedBarangayPsgc={download.selectedBarangayPsgc}
                    onBarangayChange={download.setSelectedBarangayPsgc}
                    regionFilterPsgc={download.regionFilterPsgc}
                    onRegionFilterChange={download.setRegionFilterPsgc}
                    provinceFilterPsgc={download.provinceFilterPsgc}
                    onProvinceFilterChange={download.setProvinceFilterPsgc}
                    exportKind={download.exportKind}
                    onExportKindChange={download.setExportKind}
                    onDownload={download.download}
                    downloading={download.downloading}
                    error={download.error}
                    benchmarks={benchmarks}
                />
            </div>
        </div>
    );
}
