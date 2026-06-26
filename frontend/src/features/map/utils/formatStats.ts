// Number formatting for population, area, and density display.

export function formatPopulation(n: number | null | undefined): string {
    if (n == null) return "—";
    return n.toLocaleString("en-PH");
}

export function formatAreaKm2(n: number | null | undefined): string {
    if (n == null) return "—";
    return n.toLocaleString("en-PH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatDensity(n: number | null | undefined): string {
    if (n == null) return "—";
    return Math.round(n).toLocaleString("en-PH");
}

export function formatPctChange(n: number | null | undefined): string {
    if (n == null) return "—";
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
}

export function formatAnnualizedChange(totalPct: number | null): string | null {
    if (totalPct == null) return null;
    const annual = totalPct / 4;
    const sign = annual > 0 ? "+" : "";
    return `${sign}${annual.toFixed(2)}% per year (2020 → 2024)`;
}

/** Compact peso display for COA AFR total assets (actual pesos). */
export function formatAssets(n: number | null | undefined): string {
    if (n == null) return "—";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000_000_000) return `${sign}₱${(abs / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(0)}K`;
    return `${sign}₱${abs.toLocaleString("en-PH")}`;
}
