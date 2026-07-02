// Split-layout shell: map panel and download sidebar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPanel } from "../map/components/MapPanel";
import { Sidebar, type SidebarTab } from "../map/components/Sidebar";
import { useBarangays } from "../map/hooks/useBarangays";
import { useMapDownload } from "../map/hooks/useMapDownload";
import { useMapLayers } from "../map/hooks/useMapLayers";
import type { MapLevel } from "../map/constants";
import type { CustomOverlay, SeriesViewState } from "../map/types";
import { defaultSeriesViewState } from "../map/utils/seriesScale";
import { cn } from "../lib/cn";

export default function MainPage() {
    const [activeOverlay, setActiveOverlay] = useState<CustomOverlay | null>(null);
    const [overlayView, setOverlayView] = useState<SeriesViewState>({ mode: "lead" });
    const [mapLevel, setMapLevel] = useState<MapLevel>("country");
    const [activeTab, setActiveTab] = useState<SidebarTab>("geojson");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 0));
    const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
    );
    const mobileDrawerMinHeightPx = 88;
    const mobileDrawerMaxHeightPx = useMemo(() => Math.max(mobileDrawerMinHeightPx, Math.round(viewportHeight * 0.65)), [viewportHeight]);
    const [mobileDrawerHeightPx, setMobileDrawerHeightPx] = useState(mobileDrawerMinHeightPx);

    const { provinces, municities, municityMeta, regions, country, loading, municitiesLoading, error } = useMapLayers({
        loadMunicitiesGeometry: mapLevel === "municipality" || mapLevel === "province",
    });

    useEffect(() => {
        if (activeOverlay?.kind === "series") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOverlayView(defaultSeriesViewState(activeOverlay));
        } else {
            setOverlayView({ mode: "lead" });
        }
    }, [activeOverlay]);

    useEffect(() => {
        const onResize = () => {
            setViewportHeight(window.innerHeight);
            setIsDesktopViewport(window.matchMedia("(min-width: 1024px)").matches);
        };

        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const download = useMapDownload({ regions, provinces, municities, municityMeta, country });

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        const map = new Map<string, MapLevel>();
        if (country) map.set(country.psgc, "country");
        for (const r of regions) map.set(r.psgc, "region");
        for (const p of provinces) map.set(p.psgc, "province");
        for (const m of municityMeta) map.set(m.psgc, "municipality");
        return map;
    }, [country, regions, provinces, municityMeta]);

    const psgcLevelsByTier = useMemo(
        (): Partial<Record<MapLevel, ReadonlySet<string>>> => ({
            region: new Set(regions.map((r) => r.psgc)),
            province: new Set(provinces.map((p) => p.psgc)),
            municipality: new Set(municityMeta.map((m) => m.psgc)),
        }),
        [regions, provinces, municityMeta],
    );

    const barangaysQuery = useBarangays(download.selectedMunicityPsgc, download.level === "barangay");

    const barangays = barangaysQuery.data ?? [];
    const mapLoading =
        loading || (download.level === "municipality" && municitiesLoading) || (download.level === "barangay" && barangaysQuery.isLoading);

    const handleFeatureClick = useCallback(
        (entityPsgc: string, mode: MapLevel) => {
            download.setSelectionFromMap(mode, entityPsgc);
            // On mobile: expand info tab so user sees details. Otherwise, do not alter collapse state.
            if (activeTab === "info") {
                setIsSidebarCollapsed(false);
            }
        },
        [download, activeTab],
    );

    const handleDrawerExpand = useCallback(() => {
        setIsSidebarCollapsed(false);
        setMobileDrawerHeightPx(mobileDrawerMaxHeightPx);
    }, [mobileDrawerMaxHeightPx]);

    const handleDrawerCollapse = useCallback(() => {
        setIsSidebarCollapsed(true);
        setMobileDrawerHeightPx(mobileDrawerMinHeightPx);
    }, []);

    const handleDrawerHeightChange = useCallback((heightPx: number) => {
        setMobileDrawerHeightPx(heightPx);
    }, []);

    const handleDrawerToggle = useCallback(() => {
        setIsSidebarCollapsed((prev) => {
            const nextCollapsed = !prev;
            setMobileDrawerHeightPx(nextCollapsed ? mobileDrawerMinHeightPx : mobileDrawerMaxHeightPx);
            return nextCollapsed;
        });
    }, [mobileDrawerMaxHeightPx]);

    return (
        // Desktop: exact original grid.  Mobile: flex column with animated collapse.
        <div className="flex h-dvh flex-col overflow-hidden select-none outline-none focus:outline-none lg:grid lg:grid-cols-2">
            {/* Map — desktop: always h-full.  Mobile: grows/shrinks with sidebar. */}
            <div
                className={cn(
                    // Desktop classes (unchanged from original)
                    "lg:h-full lg:min-h-0 lg:select-none lg:outline-none lg:focus:outline-none",
                    // Mobile classes — drawer height is controlled from the sidebar gesture.
                    "flex-1 min-h-0 select-none outline-none focus:outline-none",
                )}
            >
                <MapPanel
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
                    isSidebarCollapsed={isSidebarCollapsed}
                    sidebarDrawerHeightPx={mobileDrawerHeightPx}
                />
            </div>
            {/* Sidebar — desktop: always flex-1 with original styling.  Mobile: collapses to header-only. */}
            <div
                className={cn(
                    // Desktop classes (unchanged from original)
                    "lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:border-t-0 lg:max-h-none lg:select-none lg:outline-none lg:focus:outline-none",
                    // Mobile shared
                    "border-t border-border-light overflow-hidden select-none outline-none focus:outline-none",
                    isSidebarCollapsed ? "flex-none" : "flex-none",
                )}
                style={isDesktopViewport ? undefined : { height: mobileDrawerHeightPx }}
            >
                <Sidebar
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
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isCollapsed={isSidebarCollapsed}
                    isDesktopViewport={isDesktopViewport}
                    onToggleCollapse={handleDrawerToggle}
                    onExpand={handleDrawerExpand}
                    onCollapse={handleDrawerCollapse}
                    drawerHeightPx={mobileDrawerHeightPx}
                    drawerMinHeightPx={mobileDrawerMinHeightPx}
                    drawerMaxHeightPx={mobileDrawerMaxHeightPx}
                    onDrawerHeightChange={handleDrawerHeightChange}
                />
            </div>
        </div>
    );
}
