import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
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

export function Sidebar(props: SidebarProps) {
    const tab = props.activeTab;
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
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

    const complianceLinks = [
        { to: "/privacy", label: "Privacy Policy" },
        { to: "/terms", label: "Terms of Service" },
    ];

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
                            onOpenNotesModal={() => setIsNotesModalOpen(true)}
                        />
                    </div>
                )}
            </div>

            <footer
                className={cn(
                    "shrink-0 border-t border-border-light bg-white px-4 py-2.5 flex flex-col items-center gap-1.5 select-none outline-none focus:outline-none lg:px-5",
                    isEffectivelyCollapsed ? "hidden lg:flex" : "",
                )}
            >
                <button
                    type="button"
                    onClick={() => setIsNotesModalOpen(true)}
                    className="text-xs font-medium text-muted hover:text-accent transition-colors outline-none focus:outline-none cursor-pointer"
                >
                    Sources and Notes
                </button>
                <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.8rem] leading-none text-muted opacity-50">
                    {complianceLinks.map((link, index) => (
                        <span key={link.to} className="inline-flex items-center gap-x-2">
                            {index > 0 && <span aria-hidden="true">•</span>}
                            <NavLink to={link.to} className="transition-colors hover:text-primary hover:opacity-100">
                                {link.label}
                            </NavLink>
                        </span>
                    ))}
                </nav>
            </footer>

            {isNotesModalOpen && (
                <div
                    onClick={() => setIsNotesModalOpen(false)}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-text"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative flex flex-col w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden border border-border"
                    >
                        <header className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-surface/30">
                            <h2 className="text-base font-bold text-primary">Sources and Notes</h2>
                            <button
                                type="button"
                                onClick={() => setIsNotesModalOpen(false)}
                                className="text-muted hover:text-primary transition-colors text-lg font-medium p-1 [-webkit-tap-highlight-color:transparent] cursor-pointer"
                                aria-label="Close modal"
                            >
                                ✕
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm text-muted leading-relaxed">
                            <section className="space-y-2.5">
                                <h3 className="font-bold text-primary text-xs uppercase tracking-wider border-b border-border-light pb-1.5">
                                    Data Attributions
                                </h3>
                                <ul className="space-y-2 text-xs list-none pl-0">
                                    <li>
                                        <strong>Geospatial Boundaries:</strong> Derived from open-source repositories{" "}
                                        <a
                                            href="https://github.com/altcoder/philippines-psgc-shapefiles"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            philippines-psgc-shapefiles
                                        </a>{" "}
                                        and{" "}
                                        <a
                                            href="https://github.com/faeldon/philippines-json-maps"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            philippines-json-maps
                                        </a>{" "}
                                        © James Faeldon, MIT License.
                                    </li>
                                    <li>
                                        <strong>PSGC Codes and Names:</strong> Sourced from the{" "}
                                        <a
                                            href="https://psa.gov.ph/classification/psgc/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Philippine Statistics Authority (PSA)
                                        </a>
                                        .
                                    </li>
                                    <li>
                                        <strong>Administrative Boundaries and Spatial Codes:</strong>{" "}
                                        <a
                                            href="https://psa.gov.ph/classification/psgc/node/1684083211"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Philippine Statistics Authority (PSA). PSGC 1Q 2026 Publication Datafile.
                                        </a>
                                    </li>
                                    <li>
                                        <strong>Population Statistics Baseline:</strong>{" "}
                                        <a
                                            href="https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Philippine Statistics Authority (PSA). 2024 Census of Population (2024 POPCEN) Population Counts Declared
                                            Official by the President.
                                        </a>
                                    </li>
                                    <li>
                                        <strong>Demographic Distributions:</strong>{" "}
                                        <a
                                            href="https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Philippine Statistics Authority (PSA). PSA 2020 Census of Population and Housing: Age and Sex
                                            Distribution.
                                        </a>
                                    </li>
                                    <li>
                                        <strong>Socioeconomic Baseline Matrix:</strong>{" "}
                                        <a
                                            href="https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2A__PPA__2025/?tablelist=true&rxid=bdf9d8da-96f1-4100-ae09-18cb3eaeb313"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Philippine Statistics Authority (PSA). Gross Domestic Product, by Province and HUCs (Constant 2018
                                            Prices).
                                        </a>
                                    </li>
                                    <li>
                                        <strong>Local Government Financial Profiles:</strong>{" "}
                                        <a
                                            href="https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Commission on Audit (COA). 2024 Annual Financial Report for the Local Government, Including Bangsamoro
                                            Government (Volume I).
                                        </a>
                                    </li>
                                    <li>
                                        <strong>Electoral Overlays:</strong>{" "}
                                        <a
                                            href="https://2022electionresults.comelec.gov.ph/#/dashboard"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Commission on Elections (COMELEC). 2022 National and Local Elections Results Transparency Portal.
                                        </a>
                                    </li>
                                    <li>
                                        <strong>Geospatial Baseline Area &amp; Density Metric Spine:</strong>{" "}
                                        <a
                                            href="https://psa.gov.ph/system/files/phcd/2022-12/2010-2015-2020%2520Population%2520Density_Table%2520A_Using%25202013%2520Land%2520Areas_12%2520July%25202021.pdf"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            Philippine Statistics Authority (PSA). Population, Land Area, Population Density, and Percent Change in
                                            Population Density of the Philippines by Region, Province/Highly Urbanized City, and City/Municipality:
                                            2010, 2015, and 2020.
                                        </a>
                                    </li>
                                </ul>
                            </section>

                            <section className="space-y-2.5">
                                <h3 className="font-bold text-primary text-xs uppercase tracking-wider border-b border-border-light pb-1.5">
                                    Administrative Structure &amp; Download Notes
                                </h3>
                                <ul className="space-y-2.5 text-xs list-none pl-0">
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>National Capital Region Configuration:</strong>{" "}
                                        <span>
                                            Following the official PSGC hierarchy, the National Capital Region (NCR) has no province or district tier.
                                            All component units attach directly to the region. Consequently, selecting NCR at the Region level and
                                            choosing "All Provinces" for data downloads will yield an empty file—users must select "All
                                            Municipalities" instead.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Land Area Sourcing:</strong>{" "}
                                        <span>
                                            Land area data for Country, Region, Province, and City/Municipality levels utilizes the exact statutory
                                            values explicitly stated in the official PSA Table A publication to ensure density metric integrity. No
                                            approximations are performed on these tiers. If an area calculation for an upper tier is unmapped or
                                            missing in the official dataset, the system automatically triggers a computational geometric fallback.
                                        </span>
                                    </li>
                                </ul>
                            </section>

                            <section className="space-y-2.5">
                                <h3 className="font-bold text-primary text-xs uppercase tracking-wider border-b border-border-light pb-1.5">
                                    Detailed Boundary Geometry &amp; Shapefile Corrections Log
                                </h3>
                                <p className="text-xs">
                                    Upstream shapefile boundary joins from open-source repositories are normalized via deterministic processing rules
                                    to resolve code anomalies. The following structural modifications have been programmatically committed to the
                                    dataset:
                                </p>
                                <ul className="space-y-2.5 text-xs list-none pl-0">
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Correspondence Digit-Swap:</strong>{" "}
                                        <span>
                                            For approximately 1,293 barangays in NIR-renumbered regions, the shapefile correspondence codes encode
                                            with the first two digits inverted (e.g., shapefile 604502001 maps to CSV correspondence 064502001). A
                                            digit-swap transformation is applied to achieve 1:1 name verification within parent municipalities.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Manila Sub-Municipal Roll-up:</strong>{" "}
                                        <span>
                                            Shapefile features for the City of Manila utilize localized sub-municipal districts (such as Tondo or
                                            Sampaloc) which are absent in standard municipality statistical sets. These records are programmatically
                                            rolled up into the uniform canonical parent code for the City of Manila (1380600000).
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Bacolod City Administrative Override:</strong>{" "}
                                        <span>
                                            Outdated administrative codes assigned to 61 component barangays in Bacolod City are forcefully remapped
                                            to the official PSGC canonical target (1830200000) followed by strict text-string name matches within the
                                            corrected boundary grouping.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Sulu Regional Remap:</strong>{" "}
                                        <span>
                                            Shapefile features covering all 19 Sulu municipalities incorrectly carry the historical BARMM region-19
                                            prefix. These 410 barangay entities are automatically remapped to the canonical region-09 geographic
                                            tracking prefix to match actual database indexes.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>SGA Unique-Name Recovery:</strong>{" "}
                                        <span>
                                            Specific barangays (Panicupan, Macabual, and Dunguan) assigned to mismatched municipal codes are salvaged
                                            via a global unique-name matching routine across the entire PSGC reference table.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Calaca Boundary Merger:</strong>{" "}
                                        <span>
                                            Following the Supreme Court ruling upheld in April 2025, the abolished territory of Barangay San Rafael is
                                            programmatically dissolved, and its spatial polygon layer is unioned directly into the adjacent bounds of
                                            Barangay Dacanlao (0401007019) in Calaca, Batangas.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Caloocan Synthetic Layout:</strong>{" "}
                                        <span>
                                            Due to complex GIS parsing constraints, the single boundary polygon for Caloocan Barangay 176 is
                                            maintained as a unified synthetic record rather than being split into its newly declared statutory
                                            sub-units (176-A through 176-F).
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Special Non-Residential Enclaves:</strong>{" "}
                                        <span>
                                            Non-residential commercial and structural plots omitting explicit census counts (Tutuban Mall and Manila
                                            North Cemetery) are retained as special active map parcels with sentinel codes (1380601901 and 1380605901)
                                            to prevent blank structural gaps across the city layout.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>2022 Presidential Election Data Audits:</strong>{" "}
                                        <span>
                                            The country-level view uses a hardcoded injection of the certified Congressional canvass proclamation
                                            (53,815,469 total valid votes) to achieve an exact match with official results. Sub-national breakdowns
                                            represent live transmission logs compiled from the COMELEC transparency server (53,639,140 valid votes).
                                            The variance of 176,329 votes is legal and expected, driven by centrally audited Local Absentee Voting
                                            (LAV), Detention Prisoner Voting (DPV), and untransmitted Overseas Absentee Voting (OAV) logs that bypass
                                            media routers.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Omitted Special Geographic Area (SGA) Municipalities:</strong>{" "}
                                        <span>
                                            The 8 municipalities inside the Special Geographic Area of BARMM (Pabalik, Kadayangan, Kapalawan, Tugunan,
                                            Ligawasan, Malidegao, Nuling, and SGA-8) were legally created in April 2024. For historical tracking
                                            accuracy, their 2022 election values are left blank because their constituent barangays were still
                                            tabulated under Cotabato province parent municipalities at the time of the vote.
                                        </span>
                                    </li>
                                    <li className="flex flex-col sm:flex-row gap-1">
                                        <strong>Highly Urbanized Cities (HUCs):</strong>{" "}
                                        <span>
                                            Highly Urbanized Cities are administratively independent of their geographical provinces. To maintain
                                            clear spatial visualization layouts, the data pipeline rolls up independent city metrics under their
                                            geographical provincial bounds.
                                        </span>
                                    </li>
                                </ul>
                                <p className="mt-3.5 pt-3 border-t border-border-light text-xs text-muted leading-relaxed">
                                    For the exhaustive technical repository log of all geographic adjustments, view the version control file directly
                                    at:{" "}
                                    <a
                                        href="https://github.com/Shiiroi/mapa/blob/main/DATA_CORRECTIONS.md"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent underline"
                                    >
                                        https://github.com/Shiiroi/mapa/blob/main/DATA_CORRECTIONS.md
                                    </a>
                                </p>
                            </section>
                        </div>

                        <footer className="flex justify-end px-6 py-3 border-t border-border-light bg-surface/30">
                            <button
                                type="button"
                                onClick={() => setIsNotesModalOpen(false)}
                                className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-surface transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </aside>
    );
}
