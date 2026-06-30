// Sidebar: scope pickers, download trigger, and attribution. View level is
// chosen on the map overlay (MapMapPanel).

import { cn } from "../../../lib/cn";
import type { MapLevel } from "../constants";
import type { ExportKind } from "../hooks/useMapDownload";
import type { BarangayGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

interface MapDownloadPanelProps {
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

// Per level: the single sub-level a download can target ("self" = the unit's own
// boundary). Barangays are only exportable within a single municipality.
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

export function MapDownloadPanel({
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
}: MapDownloadPanelProps) {
    const filteredProvinces = regionFilterPsgc
        ? provinces.filter((p) => p.region_psgc === regionFilterPsgc)
        : provinces;

    const filteredMunis = provinceFilterPsgc
        ? municityMeta.filter((m) => m.province_psgc === provinceFilterPsgc)
        : municityMeta;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <section className="space-y-3">
                    <label className="block text-xs font-medium uppercase tracking-wide text-muted">Scope</label>
                    <p className="text-xs text-muted">
                        Switch the view level using the control on the map.
                    </p>

                    {level === "country" && (
                        <p className="text-sm text-primary">Whole Philippines outline (single shape)</p>
                    )}

                    {level === "region" && (
                        <SelectField
                            label="Region"
                            value={selectedRegionPsgc}
                            onChange={onRegionChange}
                            options={regions.map((r) => ({ value: r.psgc, label: r.name }))}
                            placeholder="Select a region…"
                        />
                    )}

                    {level === "province" && (
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
                    )}

                    {level === "municipality" && (
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
                    )}

                    {level === "barangay" && (
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
                    )}

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
                                            exportKind === opt.kind
                                                ? "bg-accent font-medium text-white"
                                                : "text-primary hover:bg-white",
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

            <footer className="space-y-3 border-t border-border-light px-5 py-4 text-xs leading-relaxed text-muted">
                <div>
                    <p className="font-medium text-primary">Attribution</p>
                    <p>
                        Boundaries:{" "}
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
                        © James Faeldon, MIT
                    </p>
                    <p>
                        PSGC codes/names:{" "}
                        <a
                            href="https://psa.gov.ph/classification/psgc/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            Philippine Statistics Authority
                        </a>
                    </p>
                </div>
            </footer>
        </div>
    );
}

interface SelectFieldProps {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    allowEmpty?: boolean;
    disabled?: boolean;
}

function SelectField({ label, value, onChange, options, placeholder, allowEmpty, disabled }: SelectFieldProps) {
    return (
        <div>
            <label className="mb-1 block text-sm text-primary">{label}</label>
            <select
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full rounded-md border border-border-light bg-white px-3 py-2 text-sm text-primary disabled:opacity-50"
            >
                {(allowEmpty || !value) && <option value="">{placeholder ?? "Select…"}</option>}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
