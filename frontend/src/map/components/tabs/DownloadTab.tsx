// Sidebar: scope pickers, download trigger, and attribution. View level is
// chosen on the map overlay (MapPanel).

import { cn } from "../../../lib/cn";
import type { MapLevel } from "../../constants";
import type { ExportKind } from "../../hooks/useMapDownload";
import type { BarangayGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../../types";

// Import extracted sub-component
import { SelectField } from "./download-sections/SelectField";

interface DownloadTabProps {
    level: MapLevel;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
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
}

// Per level: export target options.
const EXPORT_OPTIONS: Partial<Record<MapLevel, { kind: ExportKind; label: string }[]>> = {
    region: [
        { kind: "self", label: "Region outline" },
        { kind: "provinces", label: "All provinces" },
        { kind: "municipalities", label: "All municipalities" },
    ],
    province: [
        { kind: "self", label: "Province outline" },
        { kind: "municipalities", label: "All municipalities" },
    ],
    municipality: [
        { kind: "self", label: "This municipality" },
        { kind: "barangays", label: "All barangays" },
    ],
};

export function DownloadTab({
    level,
    regions,
    provinces,
    municityMeta,
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
    error,
}: DownloadTabProps) {
    const filteredProvinces = regionFilterPsgc ? provinces.filter((p) => p.region_psgc === regionFilterPsgc) : provinces;

    const filteredMunis = provinceFilterPsgc ? municityMeta.filter((m) => m.province_psgc === provinceFilterPsgc) : municityMeta;

    // --- Scope Sub-Renderers ---

    const renderCountryScope = () => <p className="text-sm text-primary">Whole Philippines administrative boundary as a single GeoJSON shape</p>;

    const renderRegionScope = () => (
        <SelectField
            label="Region"
            value={selectedRegionPsgc}
            onChange={onRegionChange}
            options={regions.map((r) => ({ value: r.psgc, label: r.name }))}
            placeholder="Select a region…"
        />
    );

    const renderProvinceScope = () => (
        <>
            <SelectField
                label="Filter by region (optional)"
                value={regionFilterPsgc}
                onChange={(psgc) => {
                    onRegionFilterChange(psgc);
                    onProvinceChange(null);
                }}
                options={regions.map((r) => ({ value: r.psgc, label: r.name }))}
                placeholder="All regions"
                allowEmpty
            />
            <SelectField
                label="Province"
                value={selectedProvincePsgc}
                onChange={onProvinceChange}
                options={filteredProvinces.map((p) => ({ value: p.psgc, label: p.name }))}
                placeholder="Select a province…"
            />
        </>
    );

    const renderMunicipalityScope = () => (
        <>
            <SelectField
                label="Filter by province"
                value={provinceFilterPsgc}
                onChange={(psgc) => {
                    onProvinceFilterChange(psgc);
                    onMunicityChange(null);
                }}
                options={provinces.map((p) => ({ value: p.psgc, label: p.name }))}
                placeholder="Select a province…"
            />
            <SelectField
                label="Municipality / City"
                value={selectedMunicityPsgc}
                onChange={onMunicityChange}
                options={filteredMunis.map((m) => ({ value: m.psgc, label: m.name }))}
                placeholder="Select a municipality…"
            />
        </>
    );

    const renderBarangayScope = () => (
        <>
            <SelectField
                label="Filter by province"
                value={provinceFilterPsgc}
                onChange={(psgc) => {
                    onProvinceFilterChange(psgc);
                    onMunicityChange(null);
                }}
                options={provinces.map((p) => ({ value: p.psgc, label: p.name }))}
                placeholder="Select a province…"
            />
            <SelectField
                label="Municipality / City"
                value={selectedMunicityPsgc}
                onChange={onMunicityChange}
                options={filteredMunis.map((m) => ({ value: m.psgc, label: m.name }))}
                placeholder="Select a municipality…"
            />
            <SelectField
                label="Barangay"
                value={selectedBarangayPsgc}
                onChange={onBarangayChange}
                options={barangays.map((b) => ({ value: b.psgc, label: b.name }))}
                placeholder={barangaysLoading ? "Loading barangays…" : "Select a barangay…"}
                disabled={barangaysLoading || !selectedMunicityPsgc}
            />
        </>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <section className="space-y-3">
                    <label className="block text-xs font-medium uppercase tracking-wide text-muted">Scope</label>
                    <p className="text-xs text-muted">
                        Download PSGC-aligned GeoJSON boundaries for the Philippines. Select your scope: country-wide outline, regions, provinces,
                        municipalities, or barangays. All data follows Philippine administrative shapefiles standards.
                    </p>

                    {level === "country" && renderCountryScope()}
                    {level === "region" && renderRegionScope()}
                    {level === "province" && renderProvinceScope()}
                    {level === "municipality" && renderMunicipalityScope()}
                    {level === "barangay" && renderBarangayScope()}

                    {EXPORT_OPTIONS[level] && (
                        <div>
                            <label className="mb-1 block text-sm text-primary">Download as</label>
                            <div className="flex gap-1 rounded-lg border border-border-light bg-surface p-1">
                                {EXPORT_OPTIONS[level]!.map((opt) => (
                                    <button
                                        key={opt.kind}
                                        type="button"
                                        onClick={() => onExportKindChange(opt.kind)}
                                        className={cn(
                                            "flex-1 rounded-md px-3 py-1.5 text-center text-sm transition-colors",
                                            exportKind === opt.kind ? "bg-accent font-medium text-white" : "text-primary hover:bg-white",
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <div className="border-t border-border-light px-5 py-4">
                {error && (
                    <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                        {error}
                    </p>
                )}
                <button
                    type="button"
                    onClick={onDownload}
                    disabled={downloading}
                    className={cn(
                        "w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity",
                        downloading && "opacity-60",
                    )}
                >
                    {downloading ? "Preparing…" : "Download"}
                </button>
            </div>
        </div>
    );
}
