// Sidebar: view switcher, scope pickers, download trigger, and attribution.

import { cn } from "../../../lib/cn";
import type { MpaLevel } from "../constants";
import type { DownloadMode } from "../hooks/useMpaDownload";
import type { BarangayGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

interface MpaDownloadPanelProps {
    level: MpaLevel;
    onLevelChange: (level: MpaLevel) => void;
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
    downloadMode: DownloadMode;
    onDownloadModeChange: (mode: DownloadMode) => void;
    onDownload: () => void;
    downloading: boolean;
    error: string | null;
}

const BASE_LEVELS: MpaLevel[] = ["country", "region", "province", "municipality"];

const LEVEL_LABELS: Record<MpaLevel, string> = {
    country: "Country",
    region: "Region",
    province: "Province",
    municipality: "Municipality",
    barangay: "Barangay",
};

export function MpaDownloadPanel({
    level,
    onLevelChange,
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
    downloadMode,
    onDownloadModeChange,
    onDownload,
    downloading,
    error,
}: MpaDownloadPanelProps) {
    const levels: MpaLevel[] = selectedMunicityPsgc
        ? [...BASE_LEVELS, "barangay"]
        : BASE_LEVELS;

    const filteredProvinces = regionFilterPsgc
        ? provinces.filter((p) => p.region_psgc === regionFilterPsgc)
        : provinces;

    const filteredMunis = provinceFilterPsgc
        ? municityMeta.filter((m) => m.province_psgc === provinceFilterPsgc)
        : municityMeta;

    return (
        <aside className="flex h-full flex-col border-l border-border bg-white">
            <header className="border-b border-border-light px-5 py-4">
                <h1 className="text-2xl font-semibold tracking-tight text-primary">Mapa</h1>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <section>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">View</label>
                    <div className="grid grid-cols-3 gap-1 rounded-lg border border-border-light bg-surface p-1">
                        {levels.map((l) => (
                            <button
                                key={l}
                                type="button"
                                onClick={() => onLevelChange(l)}
                                className={cn(
                                    "truncate rounded-md px-2 py-1.5 text-center text-sm transition-colors",
                                    level === l
                                        ? "bg-accent font-medium text-white"
                                        : "text-primary hover:bg-white",
                                )}
                            >
                                {LEVEL_LABELS[l]}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <label className="block text-xs font-medium uppercase tracking-wide text-muted">Scope</label>

                    {level === "country" && (
                        <p className="text-sm text-primary">Whole Philippines boundary</p>
                    )}

                    {level === "region" && (
                        <>
                            <SelectField
                                label="Region"
                                value={selectedRegionPsgc}
                                onChange={onRegionChange}
                                options={regions.map((r) => ({ value: r.psgc, label: r.name }))}
                                placeholder="Select a region…"
                            />
                            <label className="flex items-center gap-2 text-sm text-primary">
                                <input
                                    type="checkbox"
                                    checked={downloadMode === "subdivisions"}
                                    onChange={(e) =>
                                        onDownloadModeChange(e.target.checked ? "subdivisions" : "single")
                                    }
                                    className="rounded border-border"
                                />
                                Include provinces in region (instead of region boundary)
                            </label>
                        </>
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
                            <label className="flex items-center gap-2 text-sm text-primary">
                                <input
                                    type="checkbox"
                                    checked={downloadMode === "subdivisions"}
                                    onChange={(e) =>
                                        onDownloadModeChange(e.target.checked ? "subdivisions" : "single")
                                    }
                                    className="rounded border-border"
                                />
                                All municipalities in selected region
                            </label>
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
                                disabled={downloadMode === "allMunisInProvince"}
                            />
                            <label className="flex items-center gap-2 text-sm text-primary">
                                <input
                                    type="checkbox"
                                    checked={downloadMode === "allMunisInProvince"}
                                    onChange={(e) =>
                                        onDownloadModeChange(e.target.checked ? "allMunisInProvince" : "single")
                                    }
                                    className="rounded border-border"
                                />
                                All municipalities in province
                            </label>
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
                                disabled={downloadMode === "allBgysInMunicity" || barangaysLoading || !selectedMunicityPsgc}
                            />
                            <label className="flex items-center gap-2 text-sm text-primary">
                                <input
                                    type="checkbox"
                                    checked={downloadMode === "allBgysInMunicity"}
                                    onChange={(e) =>
                                        onDownloadModeChange(e.target.checked ? "allBgysInMunicity" : "single")
                                    }
                                    className="rounded border-border"
                                    disabled={!selectedMunicityPsgc}
                                />
                                All barangays in municipality
                            </label>
                        </>
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
                <p>
                    Part of{" "}
                    <a href="https://shhiroi.me" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        shhiroi.me
                    </a>
                </p>
            </footer>
        </aside>
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
