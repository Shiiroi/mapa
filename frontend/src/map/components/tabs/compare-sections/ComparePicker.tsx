import type { MapLevel } from "../../../constants";
import type { BarangayGeoJSON, ProvinceGeoJSON, Region, MunicityMeta } from "../../../types";
import { type CompareSelection, emptySelection } from "./types";

interface ComparePickerProps {
    label: string;
    selection: CompareSelection;
    onChange: (next: CompareSelection) => void;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    onUseMapSelection?: () => void;
    mapSelectionName: string | null;
}

export function ComparePicker({
    label,
    selection,
    onChange,
    regions,
    provinces,
    municityMeta,
    barangays,
    onUseMapSelection,
    mapSelectionName,
}: ComparePickerProps) {
    const levels: MapLevel[] = ["country", "region", "province", "municipality", "barangay"];
    const filteredMunis = selection.provincePsgc
        ? municityMeta.filter((m) => m.province_psgc === selection.provincePsgc)
        : municityMeta;

    return (
        <div className="space-y-2 rounded-lg border border-border-light bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                {onUseMapSelection && (
                    <button
                        type="button"
                        onClick={onUseMapSelection}
                        disabled={!mapSelectionName}
                        title={mapSelectionName ? `Use ${mapSelectionName}` : "Select a place on the map first"}
                        className="rounded-md border border-accent/40 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {mapSelectionName ? `Use map: ${mapSelectionName}` : "Use map selection"}
                    </button>
                )}
            </div>
            <select
                value={selection.level}
                onChange={(e) => onChange(emptySelection(e.target.value as MapLevel))}
                className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
            >
                {levels.map((l) => (
                    <option key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                    </option>
                ))}
            </select>
            {selection.level === "region" && (
                <select
                    value={selection.regionPsgc ?? ""}
                    onChange={(e) => onChange({ ...selection, regionPsgc: e.target.value || null })}
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">Select region…</option>
                    {regions.map((r) => (
                        <option key={r.psgc} value={r.psgc}>
                            {r.name.trim()}
                        </option>
                    ))}
                </select>
            )}
            {selection.level === "province" && (
                <select
                    value={selection.provincePsgc ?? ""}
                    onChange={(e) => onChange({ ...selection, provincePsgc: e.target.value || null })}
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">Select province…</option>
                    {provinces.map((p) => (
                        <option key={p.psgc} value={p.psgc}>
                            {p.name.trim()}
                        </option>
                    ))}
                </select>
            )}
            {(selection.level === "municipality" || selection.level === "barangay") && (
                <select
                    value={selection.municityPsgc ?? ""}
                    onChange={(e) =>
                        onChange({ ...selection, municityPsgc: e.target.value || null, barangayPsgc: null })
                    }
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">Select municipality…</option>
                    {filteredMunis.map((m) => (
                        <option key={m.psgc} value={m.psgc}>
                            {m.name.trim()}
                        </option>
                    ))}
                </select>
            )}
            {selection.level === "barangay" && (
                <select
                    value={selection.barangayPsgc ?? ""}
                    onChange={(e) => onChange({ ...selection, barangayPsgc: e.target.value || null })}
                    disabled={!selection.municityPsgc}
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                >
                    <option value="">Select barangay…</option>
                    {barangays.map((b) => (
                        <option key={b.psgc} value={b.psgc}>
                            {b.name.trim()}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
}
