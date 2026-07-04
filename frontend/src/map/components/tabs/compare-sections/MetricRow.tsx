import { cn } from "../../../../lib/cn";

type RowMode = "higher" | "none";

interface MetricRowProps {
    label: string;
    a: number | null;
    b: number | null;
    format: (n: number | null) => string;
    mode?: RowMode;
}

export function MetricRow({
    label,
    a,
    b,
    format,
    mode = "higher",
}: MetricRowProps) {
    const aWins = mode === "higher" && a != null && b != null && a > b;
    const bWins = mode === "higher" && a != null && b != null && b > a;

    const cellClass = (wins: boolean) =>
        wins ? "text-xs font-bold text-accent tabular-nums" : "text-xs font-medium text-primary tabular-nums";

    return (
        <tr className="border-b border-border-light hover:bg-slate-50/50">
            <td className="py-1.5 px-2 text-left text-muted font-medium">{label}</td>
            <td className={cn("py-1.5 px-2 text-right", cellClass(aWins))}>{format(a)}</td>
            <td className={cn("py-1.5 px-2 text-right", cellClass(bWins))}>{format(b)}</td>
        </tr>
    );
}
