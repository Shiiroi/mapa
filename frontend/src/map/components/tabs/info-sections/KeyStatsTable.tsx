// Key statistics table for a selected place: population, density, area, economy.
import { useMemo } from "react";
import { cn } from "../../../../lib/cn";
import { formatPctChange, formatPopulation, formatDensity, formatAreaKm2, formatAssets, formatGdp } from "../../../utils/formatStats";
import type { ResolvedPlace } from "../../../utils/resolvePlace";

interface KeyStatsTableProps {
    displayPlace: ResolvedPlace;
}

interface KeyStatsRow {
    metric: string;
    value: string;
    className?: string;
    note?: string | null;
}

function unwrapNumber(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object") {
        const record = value as { value?: unknown; amount?: unknown; raw?: unknown; number?: unknown };
        return unwrapNumber(record.value ?? record.amount ?? record.raw ?? record.number);
    }
    return null;
}

export function KeyStatsTable({ displayPlace }: KeyStatsTableProps) {
    const pop2020 = unwrapNumber(displayPlace.pop_2020);
    const pop2024 = unwrapNumber(displayPlace.pop_2024);
    const areaKm2 = unwrapNumber(displayPlace.area_km2);
    const density2024 = unwrapNumber(displayPlace.density_2024);
    const assets2024 = unwrapNumber(displayPlace.assets_2024);
    const gdp2024 = unwrapNumber(displayPlace.gdp_2024);

    const populationChange2020To2024 = useMemo(() => {
        if (pop2020 == null || pop2024 == null || pop2020 === 0) {
            return null;
        }

        return ((pop2024 - pop2020) / pop2020) * 100;
    }, [pop2020, pop2024]);

    const data = useMemo(
        (): KeyStatsRow[] => [
            {
                metric: "POPULATION (2024)",
                value: formatPopulation(pop2024),
                className: "font-medium text-primary",
            },
            {
                metric: "CHANGE (2020 → 2024)",
                value: formatPctChange(populationChange2020To2024),
                className: "font-bold",
            },
            {
                metric: "POPULATION DENSITY",
                value: density2024 != null ? `${formatDensity(density2024)}/km²` : "—",
                className: "font-medium text-primary",
            },
            {
                metric: "OFFICIAL LAND AREA",
                value: areaKm2 != null ? `${formatAreaKm2(areaKm2)} km²` : "—",
                className: "font-medium text-primary",
            },
            {
                metric: "TOTAL ASSETS (2024)",
                value: formatAssets(assets2024),
                className: "font-medium text-primary",
            },
            {
                metric: "GROSS REGIONAL GDP (2024)",
                value: gdp2024 != null ? formatGdp(gdp2024) : "—",
                className: "font-medium text-primary",
                note: gdp2024 == null ? "Not published at this level" : null,
            },
        ],
        [areaKm2, assets2024, density2024, gdp2024, pop2024, populationChange2020To2024],
    );

    return (
        <div className="w-full overflow-x-auto border border-border bg-white text-xs tabular-nums text-primary">
            <table className="w-full border-collapse">
                <tbody>
                    {data.map((row, index) => (
                        <tr key={row.metric} className={cn("border-b border-border last:border-b-0", index % 2 === 0 ? "bg-slate-50/30" : "")}>
                            <td className="py-2 px-3 font-semibold text-muted text-left w-1/3 uppercase">{row.metric}</td>
                            <td className={cn("py-2 px-3 text-right w-2/3", row.className)}>
                                {row.note ? (
                                    <div className="flex flex-col items-end">
                                        <span>{row.value}</span>
                                        <span className="block text-[9px] text-muted font-normal mt-0.5 leading-none text-left">{row.note}</span>
                                    </div>
                                ) : (
                                    row.value
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
