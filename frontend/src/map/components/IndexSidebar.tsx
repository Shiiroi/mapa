import { useState, useEffect } from "react";
import { cn } from "../../lib/cn";
import type { MapLevel } from "../constants";
import type { Region, ProvinceGeoJSON, MunicityMeta } from "../types";

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

    // Auto-expand region if it gets selected
    useEffect(() => {
        if (selectedRegionPsgc) {
            setExpandedRegions((prev) => {
                if (prev.has(selectedRegionPsgc)) return prev;
                const next = new Set(prev);
                next.add(selectedRegionPsgc);
                return next;
            });
        }
    }, [selectedRegionPsgc]);

    const toggleRegion = (psgc: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Avoid triggering region selection
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

    // Sort regions by name
    const sortedRegions = [...regions].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <aside className="flex h-full w-full flex-col border-r border-border bg-surface select-none font-sans text-xs">
            <div className="shrink-0 border-b border-border px-4 py-3 bg-white">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Geographic Index</h2>
                <p className="text-[10px] text-muted mt-0.5">Jump directly to any administrative division.</p>
            </div>

            <div className="flex-1 overflow-y-auto">
                <ul className="divide-y divide-border-light">
                    {/* Country level row */}
                    <li className="bg-white">
                        <button
                            type="button"
                            onClick={handleSelectCountry}
                            className={cn(
                                "flex w-full items-center justify-between px-4 py-2.5 text-left font-semibold transition-colors hover:bg-slate-100 cursor-pointer",
                                level === "country" ? "text-accent bg-accent/5 border-l-2 border-accent" : "text-primary"
                            )}
                        >
                            <span>Philippines (All Regions)</span>
                            <span className="text-[10px] text-muted tabular-nums">17 Regions</span>
                        </button>
                    </li>

                    {/* Region rows */}
                    {sortedRegions.map((region) => {
                        const isRegionSelected = selectedRegionPsgc === region.psgc && level === "region";
                        const isRegionActive = selectedRegionPsgc === region.psgc;
                        const isExpanded = expandedRegions.has(region.psgc);
                        const regionProvinces = provinces.filter((p) => p.region_psgc === region.psgc);
                        const sortedProvinces = [...regionProvinces].sort((a, b) => a.name.localeCompare(b.name));

                        return (
                            <li key={region.psgc} className="flex flex-col bg-white">
                                <div
                                    className={cn(
                                        "flex w-full items-stretch justify-between transition-colors hover:bg-slate-100",
                                        isRegionSelected ? "bg-accent/5 border-l-2 border-accent text-accent font-semibold" : "text-primary",
                                        isRegionActive && !isRegionSelected ? "bg-slate-50/50" : ""
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

                                {/* Province sub-list */}
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
                                                                isProvSelected ? "text-accent font-semibold bg-accent/5" : "text-primary"
                                                            )}
                                                        >
                                                            {province.name}
                                                        </button>

                                                        {/* Municipality sub-sub-list, only show if province is actively selected */}
                                                        {isProvActive && sortedMunis.length > 0 && (
                                                            <ul className="bg-slate-100/20 divide-y divide-border-light/20 border-t border-border-light/40">
                                                                {sortedMunis.map((muni) => {
                                                                    const isMuniSelected = selectedMunicityPsgc === muni.psgc && level === "municipality";
                                                                    return (
                                                                        <li key={muni.psgc}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSelectMunicity(muni)}
                                                                                className={cn(
                                                                                    "w-full py-1 pl-12 pr-4 text-left font-normal transition-colors text-[11px] cursor-pointer hover:bg-slate-100",
                                                                                    isMuniSelected ? "text-accent font-medium bg-accent/5" : "text-slate-600"
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
