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

/** PSA census reference dates (used for exact intercensal growth rates). */
export const CENSUS_DATES: Record<number, string> = {
    2010: "2010-05-01",
    2015: "2015-08-01",
    2020: "2020-05-01",
    2024: "2024-07-01",
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * PSA-style average annual population growth rate (compound), computed over the
 * exact time between two census reference dates so it matches the official PSA
 * "Population Growth Rate": PGR = (P_t / P_0)^(1/t) − 1.
 */
export function compoundAnnualGrowthRate(
    from: number | null | undefined,
    to: number | null | undefined,
    fromYear: number,
    toYear: number,
): number | null {
    if (from == null || to == null || from <= 0 || to <= 0) return null;
    const fromDate = CENSUS_DATES[fromYear];
    const toDate = CENSUS_DATES[toYear];
    if (!fromDate || !toDate) return null;
    const t = (Date.parse(toDate) - Date.parse(fromDate)) / MS_PER_YEAR;
    if (!(t > 0)) return null;
    return (Math.pow(to / from, 1 / t) - 1) * 100;
}

// Compound annual growth rate for a whole-year gap (for annual series like GDP).
export function annualGrowthRate(
    from: number | null | undefined,
    to: number | null | undefined,
    years: number,
): number | null {
    if (from == null || to == null || from <= 0 || to <= 0 || years <= 0) return null;
    return (Math.pow(to / from, 1 / years) - 1) * 100;
}

export function formatGrowthRate(pgr: number | null): string {
    if (pgr == null) return "—";
    const sign = pgr > 0 ? "+" : "";
    return `${sign}${pgr.toFixed(2)}%`;
}

export function formatAnnualizedChange(pgr: number | null): string | null {
    if (pgr == null) return null;
    const sign = pgr > 0 ? "+" : "";
    return `${sign}${pgr.toFixed(2)}% per year (PSA growth rate)`;
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

// Formats PSA GDP totals (same compact peso style as assets).
export function formatGdp(n: number | null | undefined): string {
    return formatAssets(n);
}

// Formats a per-capita peso figure with grouped digits, e.g. ₱608,500.
export function formatPesoPerCapita(n: number | null | undefined): string {
    if (n == null) return "—";
    return `₱${Math.round(n).toLocaleString("en-PH")}`;
}
