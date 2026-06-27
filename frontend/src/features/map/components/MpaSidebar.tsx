// Sidebar shell: GeoJSON | Info | Compare tabs, attribution footer.

import { useState } from "react";
import { cn } from "../../../lib/cn";
import type { MpaLevel } from "../constants";
import type { ExportKind } from "../hooks/useMpaDownload";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";
import { resolveSelectedPlace } from "../utils/resolvePlace";
import { MpaComparePanel, type CompareSelection } from "./MpaComparePanel";
import { MpaCustomPanel } from "./MpaCustomPanel";
import { MpaDownloadPanel } from "./MpaDownloadPanel";
import { MpaInfoPanel } from "./MpaInfoPanel";
import type { CustomOverlay } from "../types";

export type SidebarTab = "geojson" | "info" | "compare" | "custom";

interface MpaSidebarProps {
    level: MpaLevel;
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
    knownPsgcs: Set<string>;
}

const TABS: { id: SidebarTab; label: string }[] = [
    { id: "geojson", label: "GeoJSON" },
    { id: "info", label: "Info" },
    { id: "compare", label: "Compare" },
    { id: "custom", label: "Custom" },
];

export function MpaSidebar(props: MpaSidebarProps) {
    const [tab, setTab] = useState<SidebarTab>("geojson");

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
        <aside className="flex h-full flex-col border-l border-border bg-white">
            <header className="border-b border-border-light px-5 py-4">
                <h1 className="text-2xl font-semibold tracking-tight text-primary">Mapa</h1>
                <div className="mt-3 flex gap-1 rounded-lg border border-border-light bg-surface p-1">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "flex-1 rounded-md px-2 py-1.5 text-center text-sm transition-colors",
                                tab === t.id
                                    ? "bg-accent font-medium text-white"
                                    : "text-primary hover:bg-white",
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
                {tab === "geojson" && (
                    <MpaDownloadPanel
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
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                        <MpaInfoPanel place={selectedPlace} />
                    </div>
                )}

                {tab === "compare" && (
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                        <MpaComparePanel
                            country={props.country}
                            regions={props.regions}
                            provinces={props.provinces}
                            municities={props.municities}
                            municityMeta={props.municityMeta}
                            currentSelection={currentSelection}
                            currentSelectionName={selectedPlace?.name ?? null}
                        />
                    </div>
                )}

                {tab === "custom" && (
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                        <MpaCustomPanel
                            mapLevel={props.level}
                            activeOverlay={props.activeOverlay}
                            onOverlayChange={props.onOverlayChange}
                            selectedPlace={selectedPlace}
                            knownPsgcs={props.knownPsgcs}
                        />
                    </div>
                )}
            </div>

            {tab !== "geojson" && (
                <footer className="space-y-3 border-t border-border-light px-5 py-4 text-xs leading-relaxed text-muted">
                    <p>
                        Population:{" "}
                        <a
                            href="https://psa.gov.ph/classification/psgc/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            Philippine Statistics Authority (PSGC &amp; 2010–2024 censuses)
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
                            href="https://psa.gov.ph/statistics/nap-account"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            PSA Subnational Economic Accounts (current prices)
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
                    <p>
                        Custom maps (elections):{" "}
                        <a
                            href="https://github.com/AstroMC98/GMA-Eleksyon-2022-Data"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            GMA Eleksyon 2022 (MIT, unofficial partial count)
                        </a>
                        ; official results from{" "}
                        <a
                            href="https://comelec.gov.ph/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            COMELEC
                        </a>
                        .
                    </p>
                    <p>
                        POI counts:{" "}
                        <a
                            href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            OpenStreetMap contributors
                        </a>{" "}
                        (ODbL).
                    </p>
                </footer>
            )}
        </aside>
    );
}
