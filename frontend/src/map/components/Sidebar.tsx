import { useRef, useState } from "react";
import { cn } from "../../lib/cn";
import type { MapLevel } from "../constants";
import type { ExportKind } from "../hooks/useMapDownload";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";
import { resolveSelectedPlace } from "../utils/resolvePlace";
import { ComparePanel, type CompareSelection } from "./ComparePanel";
import { CustomPanel } from "./CustomPanel";
import { DownloadPanel } from "./DownloadPanel";
import { InfoPanel } from "./InfoPanel";
import type { CustomOverlay, SeriesViewState } from "../types";

export type SidebarTab = "geojson" | "info" | "compare" | "custom";

interface SidebarProps {
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
    error: string | null;
    activeOverlay: CustomOverlay | null;
    onOverlayChange: (overlay: CustomOverlay | null) => void;
    overlayView: SeriesViewState;
    onOverlayViewChange: (view: SeriesViewState) => void;
    knownPsgcs: Set<string>;
    psgcLevels: ReadonlyMap<string, MapLevel>;
    psgcLevelsByTier: Partial<Record<MapLevel, ReadonlySet<string>>>;
    activeTab: SidebarTab;
    onTabChange: (tab: SidebarTab) => void;
    isCollapsed?: boolean;
    isDesktopViewport?: boolean;
    onToggleCollapse?: () => void;
    onExpand?: () => void;
    onCollapse?: () => void;
    drawerHeightPx?: number;
    drawerMinHeightPx?: number;
    drawerMaxHeightPx?: number;
    onDrawerHeightChange?: (heightPx: number) => void;
}

const TABS: { id: SidebarTab; label: string }[] = [
    { id: "geojson", label: "GeoJSON" },
    { id: "info", label: "Info" },
    { id: "compare", label: "Compare" },
    { id: "custom", label: "Custom" },
];

function CollapsibleSources({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    return (
        <footer className="shrink-0 border-t border-border-light bg-white select-none outline-none focus:outline-none focus-within:outline-none focus-within:ring-0">
            <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-surface/50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 lg:pointer-events-none lg:hover:bg-transparent lg:px-5 lg:py-4 lg:pb-1"
            >
                <span>Sources</span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("transition-transform duration-300 lg:hidden", isCollapsed ? "" : "rotate-180")}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            <div
                className={cn("px-4 pb-2.5 text-xs leading-relaxed text-muted space-y-1 select-text lg:px-5 lg:pb-4 lg:block", isCollapsed ? "hidden" : "block")}
            >
                {children}
            </div>
        </footer>
    );
}

export function Sidebar(props: SidebarProps) {
    const tab = props.activeTab;
    const isDesktopViewport = Boolean(props.isDesktopViewport);
    const drawerHeightPx = props.drawerHeightPx ?? 0;
    const drawerMinHeightPx = props.drawerMinHeightPx ?? 0;
    const isDrawerOpenEnough = drawerHeightPx > drawerMinHeightPx + 4;
    const isEffectivelyCollapsed = !isDesktopViewport && Boolean(props.isCollapsed) && !isDrawerOpenEnough;

    const gestureRef = useRef<{
        pointerId: number;
        startY: number;
        startHeight: number;
        currentHeight: number;
        moved: boolean;
    } | null>(null);

    const beginDrawerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!props.onToggleCollapse || e.button !== 0) return;

        gestureRef.current = {
            pointerId: e.pointerId,
            startY: e.clientY,
            startHeight: drawerHeightPx,
            currentHeight: drawerHeightPx,
            moved: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const updateDrawerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== e.pointerId) return;

        const deltaY = e.clientY - gesture.startY;
        const minHeight = props.drawerMinHeightPx ?? gesture.startHeight;
        const maxHeight = props.drawerMaxHeightPx ?? gesture.startHeight;
        const nextHeight = Math.min(maxHeight, Math.max(minHeight, gesture.startHeight - deltaY));
        gesture.currentHeight = nextHeight;
        gesture.moved = gesture.moved || Math.abs(deltaY) > 4;
        props.onDrawerHeightChange?.(nextHeight);
    };

    const endDrawerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== e.pointerId) return;

        const finalHeight = gesture.currentHeight;
        gestureRef.current = null;

        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }

        if (!gesture.moved) {
            props.onToggleCollapse?.();
            return;
        }

        const minHeight = props.drawerMinHeightPx ?? finalHeight;
        const maxHeight = props.drawerMaxHeightPx ?? finalHeight;
        const midpoint = (minHeight + maxHeight) / 2;
        if (finalHeight >= midpoint) {
            props.onExpand?.();
        } else {
            props.onCollapse?.();
        }
    };

    const cancelDrawerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== e.pointerId) return;

        gestureRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const selectedPlace = resolveSelectedPlace({
        level: props.level,
        country: props.country,
        regions: props.regions,
        provinces: props.provinces,
        municities: props.municities,
        municityMeta: props.municityMeta,
        barangays: props.barangays,
        selectedRegionPsgc: props.selectedRegionPsgc,
        selectedProvincePsgc: props.selectedProvincePsgc,
        selectedMunicityPsgc: props.selectedMunicityPsgc,
        selectedBarangayPsgc: props.selectedBarangayPsgc,
    });

    const currentSelection: CompareSelection | null = selectedPlace
        ? {
              level: props.level,
              regionPsgc: props.selectedRegionPsgc,
              provincePsgc: props.selectedProvincePsgc,
              municityPsgc: props.selectedMunicityPsgc,
              barangayPsgc: props.selectedBarangayPsgc,
          }
        : null;

    return (
        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-white select-none outline-none focus:outline-none focus-within:outline-none focus-within:ring-0">
            {props.onToggleCollapse && (
                <div
                    className="lg:hidden flex items-center justify-center w-full py-2.5 cursor-ns-resize active:bg-surface/60 transition-colors select-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 touch-none [-webkit-tap-highlight-color:transparent]"
                    onPointerDown={beginDrawerGesture}
                    onPointerMove={updateDrawerGesture}
                    onPointerUp={endDrawerGesture}
                    onPointerCancel={cancelDrawerGesture}
                >
                    <div className="w-12 h-1.5 rounded-full bg-muted/40" />
                </div>
            )}

            <header className="shrink-0 border-b border-border-light px-4 py-2 lg:px-5 lg:py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold tracking-tight text-primary lg:text-2xl">Mapa</h1>
                    <div className="flex items-center gap-2">
                        <span
                            className="text-[10px] font-medium text-muted bg-surface rounded-md px-2 py-0.5 truncate max-w-35 lg:max-w-50 lg:text-xs"
                            title={selectedPlace ? selectedPlace.breadcrumb : "Explore region maps"}
                        >
                            {selectedPlace ? selectedPlace.name : "Explore"}
                        </span>
                        <a
                            href="https://github.com/Shiiroi/mapa"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted hover:text-accent transition-colors"
                            aria-label="GitHub Repository"
                        >
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                            </svg>
                        </a>
                    </div>
                </div>
                <div
                    className={cn(
                        "rounded-lg border border-border-light bg-surface p-0.5 lg:mt-3 lg:p-1 lg:flex lg:items-stretch",
                        isEffectivelyCollapsed ? "hidden" : "flex mt-2",
                    )}
                >
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                props.onTabChange(t.id);
                                if (props.onExpand) props.onExpand();
                            }}
                            className={cn(
                                "flex-1 rounded-md text-center transition-all duration-200 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                                "px-2.5 py-1.5 text-xs leading-none lg:px-3 lg:py-1.5 lg:text-sm",
                                tab === t.id ? "bg-accent font-medium text-white shadow-soft" : "text-primary hover:bg-white/90 hover:text-primary",
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden select-text", isEffectivelyCollapsed ? "hidden lg:flex" : "")}>
                {tab === "geojson" && (
                    <DownloadPanel
                        level={props.level}
                        regions={props.regions}
                        provinces={props.provinces}
                        municityMeta={props.municityMeta}
                        barangays={props.barangays}
                        barangaysLoading={props.barangaysLoading}
                        selectedRegionPsgc={props.selectedRegionPsgc}
                        onRegionChange={props.onRegionChange}
                        selectedProvincePsgc={props.selectedProvincePsgc}
                        onProvinceChange={props.onProvinceChange}
                        selectedMunicityPsgc={props.selectedMunicityPsgc}
                        onMunicityChange={props.onMunicityChange}
                        selectedBarangayPsgc={props.selectedBarangayPsgc}
                        onBarangayChange={props.onBarangayChange}
                        regionFilterPsgc={props.regionFilterPsgc}
                        onRegionFilterChange={props.onRegionFilterChange}
                        provinceFilterPsgc={props.provinceFilterPsgc}
                        onProvinceFilterChange={props.onProvinceFilterChange}
                        exportKind={props.exportKind}
                        onExportKindChange={props.onExportKindChange}
                        onDownload={props.onDownload}
                        downloading={props.downloading}
                        error={props.error}
                    />
                )}

                {tab === "info" && (
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">
                        <InfoPanel place={selectedPlace} />
                    </div>
                )}

                {tab === "compare" && (
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">
                        <ComparePanel
                            country={props.country}
                            regions={props.regions}
                            provinces={props.provinces}
                            municities={props.municities}
                            municityMeta={props.municityMeta}
                            currentSelection={currentSelection}
                            currentSelectionName={selectedPlace?.name ?? null}
                            activeOverlay={props.activeOverlay}
                        />
                    </div>
                )}

                {tab === "custom" && (
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">
                        <CustomPanel
                            mapLevel={props.level}
                            activeOverlay={props.activeOverlay}
                            onOverlayChange={props.onOverlayChange}
                            overlayView={props.overlayView}
                            onOverlayViewChange={props.onOverlayViewChange}
                            selectedPlace={selectedPlace}
                            knownPsgcs={props.knownPsgcs}
                            psgcLevels={props.psgcLevels}
                            psgcLevelsByTier={props.psgcLevelsByTier}
                        />
                    </div>
                )}
            </div>

            {tab === "custom" && (
                <CollapsibleSources>
                    <p>
                        2022 presidential results: Commission on Elections (COMELEC) — 2022 National &amp; Local Elections,{" "}
                        <a
                            href="https://2022electionresults.comelec.gov.ph/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            transparency (mirror) results
                        </a>
                        .
                    </p>
                </CollapsibleSources>
            )}

            {(tab === "info" || tab === "compare") && (
                <CollapsibleSources>
                    <p>
                        Population: Philippine Statistics Authority —{" "}
                        <a
                            href="https://psa.gov.ph/classification/psgc/node/1684083211"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            PSGC
                        </a>{" "}
                        &amp;{" "}
                        <a
                            href="https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            2024 census
                        </a>
                    </p>
                    <p>
                        Age &amp; sex distribution:{" "}
                        <a
                            href="https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            PSA 2020 Census of Population and Housing
                        </a>
                    </p>
                    <p>
                        GDP:{" "}
                        <a
                            href="https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2B__GP__RG__GRD/0012B5CPGD1.px/?rxid=9ba3cb75-b9b1-46d6-b436-46cbcc201f7f"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            PSA Subnational Economic Accounts (constant 2018 prices)
                        </a>
                    </p>
                    <p>
                        Total assets:{" "}
                        <a
                            href="https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            Commission on Audit (CY 2024 AFR, Local Government)
                        </a>
                    </p>
                    <p>Area &amp; density: derived by Mapa from PSA boundary geometry (approximate).</p>
                </CollapsibleSources>
            )}
        </aside>
    );
}
