import { useMemo } from "react";
import { cn } from "../../../../lib/cn";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table";
import {
    changeToneClass,
    formatPctChange,
    formatGdp,
    formatPesoPerCapita,
} from "../../../utils/formatStats";
import type { ResolvedPlace } from "../../../utils/resolvePlace";

// Helper for percent change
function totalPctChange(from: number | null, to: number | null): number | null {
    if (from == null || to == null || from === 0) return null;
    return ((to - from) / from) * 100;
}

interface GdpTableProps {
    displayPlace: ResolvedPlace;
    gdpPerCapita: number | null;
}

export function GdpTable({ displayPlace, gdpPerCapita }: GdpTableProps) {
    const data = useMemo(() => {
        const change2023 = totalPctChange(displayPlace.gdp_2022, displayPlace.gdp_2023);
        const change2024 = totalPctChange(displayPlace.gdp_2023, displayPlace.gdp_2024);

        return [
            {
                metric: "GDP (Constant 2018 Prices)",
                y2022: formatGdp(displayPlace.gdp_2022),
                y2023: formatGdp(displayPlace.gdp_2023),
                y2024: formatGdp(displayPlace.gdp_2024),
                classes: { y2022: "text-primary font-medium", y2023: "text-primary font-medium", y2024: "text-primary font-medium" },
            },
            {
                metric: "Real GDP Growth",
                y2022: "—",
                y2023: formatPctChange(change2023),
                y2024: formatPctChange(change2024),
                classes: {
                    y2022: "text-muted font-normal",
                    y2023: cn("font-semibold", changeToneClass(change2023)),
                    y2024: cn("font-semibold", changeToneClass(change2024)),
                },
            },
        ];
    }, [displayPlace]);

    const columns = useMemo(() => [
        { accessorKey: "metric", header: "GDP METRIC" },
        { accessorKey: "y2022", header: "2022" },
        { accessorKey: "y2023", header: "2023" },
        { accessorKey: "y2024", header: "2024" },
    ], []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="space-y-2">
            <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
                <colgroup>
                    <col className="w-1/3" />
                    <col className="w-2/3" />
                </colgroup>
                <tbody>
                    <tr className="border-b border-border bg-slate-50/50">
                        <td className="py-1.5 px-2 text-left text-muted font-medium">GDP PER CAPITA (2024)</td>
                        <td className="py-1.5 px-2 text-right font-semibold text-primary">{formatPesoPerCapita(gdpPerCapita)}</td>
                    </tr>
                </tbody>
            </table>
            <div className="w-full overflow-x-auto border border-border bg-white text-xs tabular-nums">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border font-semibold uppercase">
                            {table.getFlatHeaders().map((header, idx) => (
                                <th
                                    key={header.id}
                                    className={cn("py-1.5 px-2", idx === 0 ? "text-left" : "text-right")}
                                >
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-b border-border last:border-b-0">
                                <td className="py-1.5 px-2 text-left text-muted font-medium w-1/3">
                                    {row.original.metric}
                                </td>
                                <td className={cn("py-1.5 px-2 text-right w-[22.2%]", row.original.classes.y2022)}>
                                    {row.original.y2022}
                                </td>
                                <td className={cn("py-1.5 px-2 text-right w-[22.2%]", row.original.classes.y2023)}>
                                    {row.original.y2023}
                                </td>
                                <td className={cn("py-1.5 px-2 text-right w-[22.2%]", row.original.classes.y2024)}>
                                    {row.original.y2024}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
