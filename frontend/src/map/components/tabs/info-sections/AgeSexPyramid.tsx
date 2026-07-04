// Age-sex pyramid visualization: vertical mirrored bars for male and female bands.
import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { AgeSexBand } from "../../../types";

function formatAgeBand(age: string): string {
    const m = age.match(/(\d+)\s*(?:years\s*and\s*over|and\s*over|\+)/i);
    return m ? `${m[1]}+` : age;
}

interface AgeSexPyramidProps {
    bands: AgeSexBand[];
}

export const AgeSexPyramid = React.memo(function AgeSexPyramid({ bands }: AgeSexPyramidProps) {
    const data = useMemo(() => {
        return [...bands].reverse().map((b) => ({
            age: formatAgeBand(b.age),
            Male: -b.male,
            Female: b.female,
            maleDisplay: b.male,
            femaleDisplay: b.female,
        }));
    }, [bands]);

    return (
        <div className="border border-border p-2 bg-slate-50/10 h-[280px] w-full font-sans">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                        type="number"
                        tickFormatter={(v) => Math.abs(v).toLocaleString()}
                        tick={{ fill: "#64748b", fontSize: 8, fontFamily: "monospace" }}
                        stroke="#cbd5e1"
                        tickLine={false}
                    />
                    <YAxis type="category" dataKey="age" tick={{ fill: "#64748b", fontSize: 8 }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                    <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [Math.abs(Number(value)).toLocaleString(), String(name)]}
                        contentStyle={{ fontSize: 9, padding: "4px 8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1" }}
                    />
                    <Bar dataKey="Male" fill="#0284c7" stackId="stack" name="Male" />
                    <Bar dataKey="Female" fill="#f43f5e" stackId="stack" name="Female" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
});
