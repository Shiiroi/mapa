import type { ReactNode } from "react";

interface CompareSectionProps {
    title: string;
    nameA: string;
    nameB: string;
    children: ReactNode;
}

export function CompareSection({
    title,
    nameA,
    nameB,
    children,
}: CompareSectionProps) {
    return (
        <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-1">{title}</h3>
            <table className="w-full border-collapse border border-border text-xs bg-white">
                <thead>
                    <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border">
                        <th className="py-1.5 px-2 text-left font-semibold">METRIC</th>
                        <th className="py-1.5 px-2 text-right font-semibold">{nameA}</th>
                        <th className="py-1.5 px-2 text-right font-semibold">{nameB}</th>
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}
