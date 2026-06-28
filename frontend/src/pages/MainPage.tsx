// Split-layout shell: map panel and download sidebar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MpaMapPanel } from "../features/map/components/MpaMapPanel";
import { MpaSidebar } from "../features/map/components/MpaSidebar";
import { useMpaDownload } from "../features/map/hooks/useMpaDownload";
import { useMapLayers } from "../features/map/hooks/useMapLayers";
import { fetchBarangaysByMunicity } from "../features/map/services/mapApi";
import type { MpaLevel } from "../features/map/constants";
import type { CustomOverlay, SeriesViewState } from "../features/map/types";
import { defaultSeriesViewState } from "../features/map/utils/seriesScale";

export default function MainPage() {
    const [activeOverlay, setActiveOverlay] = useState<CustomOverlay | null>(null);
    const [overlayView, setOverlayView] = useState<SeriesViewState>({ mode: "lead" });
    const [mapLevel, setMapLevel] = useState<MpaLevel>("country");

    const { provinces, municities, municityMeta, regions, country, loading, municitiesLoading, error } =
        useMapLayers({
            loadMunicitiesGeometry: mapLevel === "municipality" || mapLevel === "province",
        });

    useEffect(() => {
        if (activeOverlay?.kind === "series") {
            setOverlayView(defaultSeriesViewState(activeOverlay));
        } else {
            setOverlayView({ mode: "lead" });
        }
    }, [activeOverlay]);

    const download = useMpaDownload({ regions, provinces, municities, municityMeta, country });

    useEffect(() => {
        setMapLevel(download.level);
    }, [download.level]);

    const knownPsgcs = useMemo(() => {
        const set = new Set<string>();
        if (country) set.add(country.psgc);
        for (const r of regions) set.add(r.psgc);
        for (const p of provinces) set.add(p.psgc);
        for (const m of municityMeta) set.add(m.psgc);
        return set;
    }, [country, regions, provinces, municityMeta]);

    // True level per PSGC, so the CSV parser can tell HUC/independent cities
    // (codes ending in "00000", like provinces) apart from actual provinces.
    const psgcLevels = useMemo(() => {
        const map = new Map<string, MpaLevel>();
        if (country) map.set(country.psgc, "country");
        for (const r of regions) map.set(r.psgc, "region");
        for (const p of provinces) map.set(p.psgc, "province");
        for (const m of municityMeta) map.set(m.psgc, "municipality");
        return map;
    }, [country, regions, provinces, municityMeta]);

    const psgcLevelsByTier = useMemo(
        (): Partial<Record<MpaLevel, ReadonlySet<string>>> => ({
            region: new Set(regions.map((r) => r.psgc)),
            province: new Set(provinces.map((p) => p.psgc)),
            municipality: new Set(municityMeta.map((m) => m.psgc)),
        }),
        [regions, provinces, municityMeta],
    );

    const barangaysQuery = useQuery({
        queryKey: ["barangays", download.selectedMunicityPsgc],
        queryFn: () => fetchBarangaysByMunicity(download.selectedMunicityPsgc!),
        enabled: download.level === "barangay" && !!download.selectedMunicityPsgc,
        staleTime: 10 * 60 * 1000,
    });

    const barangays = barangaysQuery.data ?? [];
    const mapLoading =
        loading ||
        (download.level === "municipality" && municitiesLoading) ||
        (download.level === "barangay" && barangaysQuery.isLoading);

    const handleFeatureClick = useCallback(
        (entityPsgc: string, mode: MpaLevel) => {
            download.setSelectionFromMap(mode, entityPsgc);
        },
        [download],
    );

    return (
        <div className="flex h-dvh flex-col overflow-hidden lg:grid lg:grid-cols-2">
            <div className="h-[min(52dvh,28rem)] shrink-0 lg:h-full lg:min-h-0">
                <MpaMapPanel
                    country={country}
                    provinces={provinces}
                    regions={regions}
                    municities={municities}
                    barangays={download.level === "barangay" ? barangays : []}
                    mode={download.level}
                    onFeatureClick={handleFeatureClick}
                    onLevelChange={download.setLevel}
                    barangayAvailable={!!download.selectedMunicityPsgc}
                    loading={mapLoading}
                    error={error ?? (barangaysQuery.error as Error | null)}
                    overlay={activeOverlay}
                    overlayView={overlayView}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden border-t border-border-light lg:border-t-0">
                <MpaSidebar
                    level={download.level}
                    regions={regions}
                    provinces={provinces}
                    municities={municities}
                    municityMeta={municityMeta}
                    country={country}
                    barangays={barangays}
                    barangaysLoading={barangaysQuery.isLoading}
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
                    activeOverlay={activeOverlay}
                    onOverlayChange={setActiveOverlay}
                    overlayView={overlayView}
                    onOverlayViewChange={setOverlayView}
                    knownPsgcs={knownPsgcs}
                    psgcLevels={psgcLevels}
                    psgcLevelsByTier={psgcLevelsByTier}
                />
            </div>
        </div>
    );
}
