// Sitemap and dashboard layout: IndexSidebar and MapDashboard.
import { useState, useMemo } from "react";
import { cn } from "../../lib/cn";
import type { MapLevel } from "../constants";
import type {
    Region,
    ProvinceGeoJSON,
    MunicityGeoJSON,
    MunicityMeta,
    BarangayGeoJSON,
    CountryGeoJSON,
    CustomOverlay,
    SeriesViewState,
} from "../types";
import { MapTab } from "./Map";
import { Sidebar, type SidebarTab } from "./Sidebar";
import type { ExportKind } from "../hooks/useMapDownload";

interface IndexSidebarProps {
    level: MapLevel;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    selectedRegionPsgc: string | null;
    onRegionChange: (psgc: string | null) => void;
    selectedProvincePsgc: string | null;
    onProvinceChange: (psgc: string | null) => void;
    selectedMunicityPsgc: string | null;
    onMunicityChange: (psgc: string | null) => void;
    onLevelChange: (level: MapLevel) => void;
}

export function IndexSidebar({
    level,
    regions,
    provinces,
    municityMeta,
    selectedRegionPsgc,
    onRegionChange,
    selectedProvincePsgc,
    onProvinceChange,
    selectedMunicityPsgc,
    onMunicityChange,
    onLevelChange,
}: IndexSidebarProps) {
    const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

    const toggleRegion = (psgc: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRegions((prev) => {
            const next = new Set(prev);
            if (next.has(psgc)) {
                next.delete(psgc);
            } else {
                next.add(psgc);
            }
            return next;
        });
    };

    const handleSelectCountry = () => {
        onRegionChange(null);
        onProvinceChange(null);
        onMunicityChange(null);
        onLevelChange("country");
    };

    const handleSelectRegion = (region: Region) => {
        onRegionChange(region.psgc);
        onProvinceChange(null);
        onMunicityChange(null);
        onLevelChange("region");
    };

    const handleSelectProvince = (province: ProvinceGeoJSON) => {
        onRegionChange(province.region_psgc);
        onProvinceChange(province.psgc);
        onMunicityChange(null);
        onLevelChange("province");
    };

    const handleSelectMunicity = (municity: MunicityMeta) => {
        onRegionChange(municity.region_psgc);
        onProvinceChange(municity.province_psgc);
        onMunicityChange(municity.psgc);
        onLevelChange("municipality");
    };

    const sortedRegions = useMemo(() => {
        return [...regions].sort((a, b) => a.name.localeCompare(b.name));
    }, [regions]);

    return (
        <aside className="flex h-full w-full flex-col border-r border-border bg-surface select-none font-sans text-xs">
            <div className="shrink-0 border-b border-border px-4 py-3 bg-white">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Geographic Index</h2>
                <p className="text-[10px] text-muted mt-0.5">Jump directly to any administrative division.</p>
            </div>

            <div className="flex-1 overflow-y-auto">
                <ul className="divide-y divide-border-light">
                    <li className="bg-white">
                        <button
                            type="button"
                            onClick={handleSelectCountry}
                            className={cn(
                                "flex w-full items-center justify-between px-4 py-2.5 text-left font-semibold transition-colors hover:bg-slate-100 cursor-pointer",
                                level === "country" ? "text-accent bg-accent/5 border-l-2 border-accent" : "text-primary",
                            )}
                        >
                            <span>Philippines (All Regions)</span>
                            <span className="text-[10px] text-muted tabular-nums">17 Regions</span>
                        </button>
                    </li>

                    {sortedRegions.map((region) => {
                        const isRegionSelected = selectedRegionPsgc === region.psgc && level === "region";
                        const isRegionActive = selectedRegionPsgc === region.psgc;
                        const isExpanded = expandedRegions.has(region.psgc) || selectedRegionPsgc === region.psgc;
                        const regionProvinces = provinces.filter((p) => p.region_psgc === region.psgc);
                        const sortedProvinces = [...regionProvinces].sort((a, b) => a.name.localeCompare(b.name));

                        return (
                            <li key={region.psgc} className="flex flex-col bg-white">
                                <div
                                    className={cn(
                                        "flex w-full items-stretch justify-between transition-colors hover:bg-slate-100",
                                        isRegionSelected ? "bg-accent/5 border-l-2 border-accent text-accent font-semibold" : "text-primary",
                                        isRegionActive && !isRegionSelected ? "bg-slate-50/50" : "",
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleSelectRegion(region)}
                                        className="flex-1 py-2 pl-4 pr-1 text-left font-medium truncate cursor-pointer"
                                        title={region.name}
                                    >
                                        {region.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => toggleRegion(region.psgc, e)}
                                        className="px-3 flex items-center justify-center hover:bg-slate-200 text-muted transition-transform duration-100 cursor-pointer"
                                        aria-label={isExpanded ? "Collapse region" : "Expand region"}
                                    >
                                        <svg
                                            className={cn("w-3 h-3 transform transition-transform", isExpanded ? "rotate-90" : "")}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            viewBox="0 0 24 24"
                                        >
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                </div>

                                {isExpanded && (
                                    <ul className="bg-slate-50/30 divide-y divide-border-light/40 border-t border-border-light/60">
                                        {sortedProvinces.length === 0 ? (
                                            <li className="py-1.5 pl-8 pr-4 italic text-[10px] text-muted">No provinces (e.g. NCR)</li>
                                        ) : (
                                            sortedProvinces.map((province) => {
                                                const isProvSelected = selectedProvincePsgc === province.psgc && level === "province";
                                                const isProvActive = selectedProvincePsgc === province.psgc;
                                                const provinceMunis = municityMeta.filter((m) => m.province_psgc === province.psgc);
                                                const sortedMunis = [...provinceMunis].sort((a, b) => a.name.localeCompare(b.name));

                                                return (
                                                    <li key={province.psgc} className="flex flex-col">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectProvince(province)}
                                                            className={cn(
                                                                "w-full py-1.5 pl-8 pr-4 text-left font-normal transition-colors cursor-pointer hover:bg-slate-100",
                                                                isProvSelected ? "text-accent font-semibold bg-accent/5" : "text-primary",
                                                            )}
                                                        >
                                                            {province.name}
                                                        </button>

                                                        {isProvActive && sortedMunis.length > 0 && (
                                                            <ul className="bg-slate-100/20 divide-y divide-border-light/20 border-t border-border-light/40">
                                                                {sortedMunis.map((muni) => {
                                                                    const isMuniSelected =
                                                                        selectedMunicityPsgc === muni.psgc && level === "municipality";
                                                                    return (
                                                                        <li key={muni.psgc}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSelectMunicity(muni)}
                                                                                className={cn(
                                                                                    "w-full py-1 pl-12 pr-4 text-left font-normal transition-colors text-[11px] cursor-pointer hover:bg-slate-100",
                                                                                    isMuniSelected
                                                                                        ? "text-accent font-medium bg-accent/5"
                                                                                        : "text-slate-600",
                                                                                )}
                                                                            >
                                                                                {muni.name}
                                                                            </button>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        )}
                                                    </li>
                                                );
                                            })
                                        )}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </aside>
    );
}

// --- Top-Level Unified Dashboard Layout Component ---

interface MapDashboardProps {
    level: MapLevel;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    country: CountryGeoJSON | null;
    barangays: BarangayGeoJSON[];
    barangaysLoading: boolean;

    selectedRegionPsgc: string | null;
    onRegionChange: (psgc: string | null) => void;
    selectedProvincePsgc: string | null;
    onProvinceChange: (psgc: string | null) => void;
    selectedMunicityPsgc: string | null;
    onMunicityChange: (psgc: string | null) => void;
    selectedBarangayPsgc: string | null;
    onBarangayChange: (psgc: string | null) => void;

    regionFilterPsgc: string | null;
    onRegionFilterChange: (psgc: string | null) => void;
    provinceFilterPsgc: string | null;
    onProvinceFilterChange: (psgc: string | null) => void;

    exportKind: ExportKind;
    onExportKindChange: (kind: ExportKind) => void;
    onDownload: () => void;
    downloading: boolean;
    downloadError: string | null;

    activeOverlay: CustomOverlay | null;
    onOverlayChange: (overlay: CustomOverlay | null) => void;
    overlayView: SeriesViewState;
    onOverlayViewChange: (view: SeriesViewState) => void;

    activeTab: SidebarTab;
    onTabChange: (tab: SidebarTab) => void;

    isSidebarCollapsed: boolean;
    isDesktopViewport: boolean;
    onToggleCollapse: () => void;
    onExpand: () => void;
    onCollapse: () => void;

    drawerHeightPx: number;
    drawerMinHeightPx: number;
    drawerMaxHeightPx: number;
    onDrawerHeightChange: (heightPx: number) => void;
    onLevelChange: (level: MapLevel) => void;

    mapLoading: boolean;
    mapError: Error | null;
    activePsgc: string | null;
    onFeatureClick: (entityPsgc: string, mode: MapLevel) => void;

    knownPsgcs: Set<string>;
    psgcLevels: ReadonlyMap<string, MapLevel>;
    psgcLevelsByTier: Partial<Record<MapLevel, ReadonlySet<string>>>;
}

export function MapDashboard({
    level,
    regions,
    provinces,
    municities,
    municityMeta,
    country,
    barangays,
    barangaysLoading,
    selectedRegionPsgc,
    onRegionChange,
    selectedProvincePsgc,
    onProvinceChange,
    selectedMunicityPsgc,
    onMunicityChange,
    selectedBarangayPsgc,
    onBarangayChange,
    regionFilterPsgc,
    onRegionFilterChange,
    provinceFilterPsgc,
    onProvinceFilterChange,
    exportKind,
    onExportKindChange,
    onDownload,
    downloading,
    downloadError,
    activeOverlay,
    onOverlayChange,
    overlayView,
    onOverlayViewChange,
    activeTab,
    onTabChange,
    isSidebarCollapsed,
    isDesktopViewport,
    onToggleCollapse,
    onExpand,
    onCollapse,
    drawerHeightPx,
    drawerMinHeightPx,
    drawerMaxHeightPx,
    onDrawerHeightChange,
    onLevelChange,
    mapLoading,
    mapError,
    activePsgc,
    onFeatureClick,
    knownPsgcs,
    psgcLevels,
    psgcLevelsByTier,
}: MapDashboardProps) {
    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden select-none outline-none focus:outline-none lg:grid lg:grid-cols-[240px_1fr_45%] lg:items-stretch">
            {/* Sitemap Sidebar — Desktop only */}
            <div className="hidden lg:block lg:h-full lg:w-full lg:min-w-0 lg:min-h-0">
                <IndexSidebar
                    level={level}
                    regions={regions}
                    provinces={provinces}
                    municityMeta={municityMeta}
                    selectedRegionPsgc={selectedRegionPsgc}
                    onRegionChange={onRegionChange}
                    selectedProvincePsgc={selectedProvincePsgc}
                    onProvinceChange={onProvinceChange}
                    selectedMunicityPsgc={selectedMunicityPsgc}
                    onMunicityChange={onMunicityChange}
                    onLevelChange={onLevelChange}
                />
            </div>

            {/* Map — desktop: strict grid child. Mobile: grows/shrinks with sidebar. */}
            <div className="lg:h-full lg:w-full lg:min-w-0 lg:min-h-0 lg:relative flex-1 min-h-0 select-none outline-none focus:outline-none">
                <MapTab
                    country={country}
                    provinces={provinces}
                    regions={regions}
                    municities={municities}
                    barangays={level === "barangay" ? barangays : []}
                    mode={level}
                    onFeatureClick={onFeatureClick}
                    onLevelChange={onLevelChange}
                    barangayAvailable={!!selectedMunicityPsgc}
                    loading={mapLoading}
                    error={mapError}
                    overlay={activeOverlay}
                    overlayView={overlayView}
                    isSidebarCollapsed={isSidebarCollapsed}
                    sidebarDrawerHeightPx={drawerHeightPx}
                    activePsgc={activePsgc}
                />
            </div>

            {/* Details/Data Sidebar — desktop: strict grid child. Mobile: animated collapse drawer. */}
            <div
                className="lg:h-full lg:w-full lg:min-w-0 lg:min-h-0 lg:overflow-hidden lg:border-t-0 lg:max-h-none lg:select-none lg:outline-none lg:focus:outline-none border-t border-border-light overflow-hidden select-none outline-none focus:outline-none flex-none"
                style={isDesktopViewport ? undefined : { height: drawerHeightPx }}
            >
                <Sidebar
                    level={level}
                    regions={regions}
                    provinces={provinces}
                    municities={municities}
                    municityMeta={municityMeta}
                    country={country}
                    barangays={barangays}
                    barangaysLoading={barangaysLoading}
                    selectedRegionPsgc={selectedRegionPsgc}
                    onRegionChange={onRegionChange}
                    selectedProvincePsgc={selectedProvincePsgc}
                    onProvinceChange={onProvinceChange}
                    selectedMunicityPsgc={selectedMunicityPsgc}
                    onMunicityChange={onMunicityChange}
                    selectedBarangayPsgc={selectedBarangayPsgc}
                    onBarangayChange={onBarangayChange}
                    regionFilterPsgc={regionFilterPsgc}
                    onRegionFilterChange={onRegionFilterChange}
                    provinceFilterPsgc={provinceFilterPsgc}
                    onProvinceFilterChange={onProvinceFilterChange}
                    exportKind={exportKind}
                    onExportKindChange={onExportKindChange}
                    onDownload={onDownload}
                    downloading={downloading}
                    error={downloadError}
                    activeOverlay={activeOverlay}
                    onOverlayChange={onOverlayChange}
                    overlayView={overlayView}
                    onOverlayViewChange={onOverlayViewChange}
                    knownPsgcs={knownPsgcs}
                    psgcLevels={psgcLevels}
                    psgcLevelsByTier={psgcLevelsByTier}
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                    isCollapsed={isSidebarCollapsed}
                    isDesktopViewport={isDesktopViewport}
                    onToggleCollapse={onToggleCollapse}
                    onExpand={onExpand}
                    onCollapse={onCollapse}
                    drawerHeightPx={drawerHeightPx}
                    drawerMinHeightPx={drawerMinHeightPx}
                    drawerMaxHeightPx={drawerMaxHeightPx}
                    onDrawerHeightChange={onDrawerHeightChange}
                    onLevelChange={onLevelChange}
                />
            </div>
        </div>
    );
}
