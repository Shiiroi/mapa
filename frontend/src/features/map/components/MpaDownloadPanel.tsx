// Sidebar: view switcher, scope pickers, download trigger, and attribution.

import { cn } from "../../../lib/cn";
import type { MpaLevel } from "../constants";
import type { DownloadMode } from "../hooks/useMpaDownload";
import type { MunicityMeta, ProvinceGeoJSON, Region } from "../types";

interface MpaDownloadPanelProps {
    level: MpaLevel;
    onLevelChange: (level: MpaLevel) => void;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    selectedRegionId: number | null;
    onRegionChange: (id: number | null) => void;
    selectedProvinceId: number | null;
    onProvinceChange: (id: number | null) => void;
    selectedMunicityId: number | null;
    onMunicityChange: (id: number | null) => void;
    regionFilterId: number | null;
    onRegionFilterChange: (id: number | null) => void;
    provinceFilterId: number | null;
    onProvinceFilterChange: (id: number | null) => void;
    downloadMode: DownloadMode;
    onDownloadModeChange: (mode: DownloadMode) => void;
    onDownload: () => void;
    downloading: boolean;
    error: string | null;
}

const LEVELS: MpaLevel[] = ["region", "province", "municipality"];

export function MpaDownloadPanel({
    level,
    onLevelChange,
    regions,
    provinces,
    municityMeta,
    selectedRegionId,
    onRegionChange,
    selectedProvinceId,
    onProvinceChange,
    selectedMunicityId,
    onMunicityChange,
    regionFilterId,
    onRegionFilterChange,
    provinceFilterId,
    onProvinceFilterChange,
    downloadMode,
    onDownloadModeChange,
    onDownload,
    downloading,
    error,
}: MpaDownloadPanelProps) {
    const filteredProvinces = regionFilterId
        ? provinces.filter((p) => p.region_id === regionFilterId)
        : provinces;

    const filteredMunis = provinceFilterId
        ? municityMeta.filter((m) => m.province_id === provinceFilterId)
        : municityMeta;

    return (
        <aside className="flex h-full flex-col border-l border-border bg-white">
            <header className="border-b border-border-light px-5 py-4">
                <h1 className="text-2xl font-semibold tracking-tight text-primary">Mapa</h1>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <section>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">View</label>
                    <div className="flex gap-1 rounded-lg border border-border-light bg-surface p-1">
                        {LEVELS.map((l) => (
                            <button
                                key={l}
                                type="button"
                                onClick={() => onLevelChange(l)}
                                className={cn(
                                    "flex-1 rounded-md px-2 py-1.5 text-sm capitalize transition-colors",
                                    level === l
                                        ? "bg-accent font-medium text-white"
                                        : "text-primary hover:bg-white",
                                )}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <label className="block text-xs font-medium uppercase tracking-wide text-muted">Scope</label>

                    {level === "region" && (
                        <>
                            <SelectField
                                label="Region"
                                value={selectedRegionId}
                                onChange={onRegionChange}
                                options={regions.map((r) => ({ value: r.id, label: r.name }))}
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
                                value={regionFilterId}
                                onChange={(id) => {
                                    onRegionFilterChange(id);
                                    onProvinceChange(null);
                                }}
                                options={regions.map((r) => ({ value: r.id, label: r.name }))}
                                placeholder="All regions"
                                allowEmpty
                            />
                            <SelectField
                                label="Province"
                                value={selectedProvinceId}
                                onChange={onProvinceChange}
                                options={filteredProvinces.map((p) => ({ value: p.id, label: p.name }))}
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
                                value={provinceFilterId}
                                onChange={(id) => {
                                    onProvinceFilterChange(id);
                                    onMunicityChange(null);
                                }}
                                options={provinces.map((p) => ({ value: p.id, label: p.name }))}
                                placeholder="Select a province…"
                            />
                            <SelectField
                                label="Municipality / City"
                                value={selectedMunicityId}
                                onChange={onMunicityChange}
                                options={filteredMunis.map((m) => ({ value: m.id, label: m.name }))}
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
                </section>

                {error && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
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

            <footer className="mt-auto space-y-3 border-t border-border-light px-5 py-4 text-xs leading-relaxed text-muted">
                <div>
                    <p className="font-medium text-primary">Attribution</p>
                    <p>
                        Boundaries:{" "}
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
                    <p>PSGC codes/names: Philippine Statistics Authority</p>
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
    value: number | null;
    onChange: (value: number | null) => void;
    options: { value: number; label: string }[];
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
                onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
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
