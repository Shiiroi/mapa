import { useMemo } from "react";
import { cn } from "../../../../lib/cn";
import {
    useReactTable,
    getCoreRowModel,
} from "@tanstack/react-table";
import { formatPopulation } from "../../../utils/formatStats";

interface SexDistributionTableProps {
    male: number;
    female: number;
}

export function SexDistributionTable({ male, female }: SexDistributionTableProps) {
    const data = useMemo(() => [
        {
            sex: "MALE",
            value: formatPopulation(male),
            className: "text-sky-600",
        },
        {
            sex: "FEMALE",
            value: formatPopulation(female),
            className: "text-rose-600",
        },
    ], [male, female]);

    const columns = useMemo(() => [
        { accessorKey: "sex", header: "Sex" },
        { accessorKey: "value", header: "Population" },
    ], []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
            <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
            </colgroup>
            <tbody>
                {table.getRowModel().rows.map((row, idx) => (
                    <tr
                        key={row.id}
                        className={cn(
                            "border-b border-border last:border-b-0",
                            idx === 0 ? "bg-slate-50/30" : ""
                        )}
                    >
                        <td className="py-2 px-2.5 font-semibold text-muted text-left">
                            {row.original.sex}
                        </td>
                        <td className={cn("py-2 px-2.5 text-right font-bold", row.original.className)}>
                            {row.original.value}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
