import { useCallback, useEffect, useMemo, useState } from "react";
import { track } from "@vercel/analytics";
import { MapDashboard } from "../map/components/Index";
import type { SidebarTab } from "../map/components/Sidebar";
import { useBarangays } from "../map/hooks/useBarangays";
import { useMapDownload } from "../map/hooks/useMapDownload";
import { useUrlToStateSync } from "../map/hooks/useUrlToStateSync";
import { useStateToUrlSync } from "../map/hooks/useStateToUrlSync";
import { useMapLayers } from "../map/hooks/useMapLayers";
import type { MapLevel } from "../map/constants";
import type { CustomOverlay, SeriesViewState } from "../map/types";
import { defaultSeriesViewState } from "../map/utils/seriesScale";

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // True level per PSGC
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

    const barangaysQuery = useBarangays(
        download.selectedMunicityPsgc,
        download.level === "barangay" || download.level === "municipality"
    );

    const barangays = barangaysQuery.data ?? [];

    // Sync URL to state on direct page load
    useUrlToStateSync({
        regions,
        provinces,
        municityMeta,
        barangays,
        onSetRegion: download.setSelectedRegionPsgc,
        onSetProvince: download.setSelectedProvincePsgc,
        onSetMunicity: download.setSelectedMunicityPsgc,
        onSetBarangay: download.setSelectedBarangayPsgc,
        onSetLevel: download.setLevel,
    });

    // Sync state to URL when user selects location tiers
    useStateToUrlSync({
        regions,
        provinces,
        municityMeta,
        barangays,
        selectedRegionPsgc: download.selectedRegionPsgc,
        selectedProvincePsgc: download.selectedProvincePsgc,
        selectedMunicityPsgc: download.selectedMunicityPsgc,
        selectedBarangayPsgc: download.selectedBarangayPsgc,
        level: download.level,
    });
    const mapLoading =
        loading || (download.level === "municipality" && municitiesLoading) || (download.level === "barangay" && barangaysQuery.isLoading);

    const activePsgc = useMemo(() => {
        return (
            download.selectedBarangayPsgc ||
            download.selectedMunicityPsgc ||
            download.selectedProvincePsgc ||
            download.selectedRegionPsgc ||
            (country?.psgc ?? null)
        );
    }, [download.selectedBarangayPsgc, download.selectedMunicityPsgc, download.selectedProvincePsgc, download.selectedRegionPsgc, country]);

    const handleFeatureClick = useCallback(
        (entityPsgc: string, mode: MapLevel) => {
            track("select_shape", { psgc: entityPsgc, level: mode });
            download.setSelectionFromMap(mode, entityPsgc);
            // On mobile: expand info tab so user sees details.
            if (activeTab === "info") {
                setIsSidebarCollapsed(false);
            }
        },
        [download, activeTab],
    );

    const handleLevelChange = useCallback(
        (level: MapLevel) => {
            track("toggle_map_view_mode", { level });
            download.setLevel(level);
        },
        [download],
    );

    const handleTabChange = useCallback((tab: SidebarTab) => {
        track("switch_sidebar_tab", { tab });
        setActiveTab(tab);
    }, []);

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
        <MapDashboard
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
            downloadError={download.error}
            activeOverlay={activeOverlay}
            onOverlayChange={setActiveOverlay}
            overlayView={overlayView}
            onOverlayViewChange={setOverlayView}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isSidebarCollapsed={isSidebarCollapsed}
            isDesktopViewport={isDesktopViewport}
            onToggleCollapse={handleDrawerToggle}
            onExpand={handleDrawerExpand}
            onCollapse={handleDrawerCollapse}
            drawerHeightPx={mobileDrawerHeightPx}
            drawerMinHeightPx={mobileDrawerMinHeightPx}
            drawerMaxHeightPx={mobileDrawerMaxHeightPx}
            onDrawerHeightChange={handleDrawerHeightChange}
            onLevelChange={handleLevelChange}
            mapLoading={mapLoading}
            mapError={error ?? (barangaysQuery.error as Error | null)}
            activePsgc={activePsgc}
            onFeatureClick={handleFeatureClick}
            knownPsgcs={knownPsgcs}
            psgcLevels={psgcLevels}
            psgcLevelsByTier={psgcLevelsByTier}
        />
    );
}
