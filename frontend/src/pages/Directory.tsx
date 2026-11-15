import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useMapLayers } from "../map/hooks/useMapLayers";
import { slugify } from "../lib/slugUtils";

type DirectoryTier = "region" | "province" | "municipality";
type SortMetric = "pop_2024" | "density_2024" | "area_km2" | "pct_change_2020_2024" | "assets_2024" | "gdp_2024";

interface DirectoryRow {
    psgc: string;
    correspondence: string | null;
    name: string;
    subtitle: string;
    urlPath: string;
    geoLvl: string;
    pop_2024: number | null;
    density_2024: number | null;
    area_km2: number | null;
    pct_change_2020_2024: number | null;
    assets_2024: number | null;
    gdp_2024: number | null;
}

const PAGE_SIZE = 100;

const METRIC_OPTIONS: { id: SortMetric; label: string }[] = [
    { id: "pop_2024", label: "Population (2024)" },
    { id: "density_2024", label: "Density (/km²)" },
    { id: "area_km2", label: "Land Area (km²)" },
    { id: "pct_change_2020_2024", label: "Growth 2020–24 (%)" },
    { id: "assets_2024", label: "COA Assets (2024)" },
    { id: "gdp_2024", label: "GDP (2024)" },
];

const directorySchema = [
    {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Philippines", item: "https://lens.mapaph.com/" },
            { "@type": "ListItem", position: 2, name: "Geographic Directory", item: "https://lens.mapaph.com/directory" },
        ],
    },
    {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Philippine Geographic Directory, PSGC Codes & Statistical Rankings",
        description:
            "Searchable directory and rankings of all 18 Philippine regions, 84 provinces, and 1,642 cities and municipalities by 2024 census population, density, land area, GDP, COA assets, and RFC 7946 GeoJSON downloads.",
        url: "https://lens.mapaph.com/directory",
        spatialCoverage: { "@type": "Place", name: "Philippines" },
    },
];

function formatInt(val: number | null): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "—";
    return Math.round(val).toLocaleString("en-US");
}

function formatArea(val: number | null): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "—";
    return val.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPct(val: number | null): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "—";
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(2)}%`;
}

function formatPhp(val: number | null, unitMillions = false): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "—";
    const full = unitMillions ? val * 1_000_000 : val;
    if (full >= 1_000_000_000_000) return `₱${(full / 1_000_000_000_000).toFixed(2)}T`;
    if (full >= 1_000_000_000) return `₱${(full / 1_000_000_000).toFixed(2)}B`;
    if (full >= 1_000_000) return `₱${(full / 1_000_000).toFixed(1)}M`;
    return `₱${Math.round(full).toLocaleString("en-US")}`;
}

function formatMetricValue(row: DirectoryRow, metric: SortMetric): string {
    switch (metric) {
        case "pop_2024":
            return formatInt(row.pop_2024);
        case "density_2024":
            return row.density_2024 != null ? `${formatInt(row.density_2024)} /km²` : "—";
        case "area_km2":
            return row.area_km2 != null ? `${formatArea(row.area_km2)} km²` : "—";
        case "pct_change_2020_2024":
            return formatPct(row.pct_change_2020_2024);
        case "assets_2024":
            return formatPhp(row.assets_2024);
        case "gdp_2024":
            return formatPhp(row.gdp_2024);
    }
}

export default function Directory() {
    const { regions, provinces, municityMeta, loading, error } = useMapLayers();
    const [tier, setTier] = useState<DirectoryTier>("province");
    const [metric, setMetric] = useState<SortMetric>("pop_2024");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);

    const regionByPsgc = useMemo(() => new Map(regions.map((r) => [r.psgc, r])), [regions]);
    const provinceByPsgc = useMemo(() => new Map(provinces.map((p) => [p.psgc, p])), [provinces]);

    const nationalPop = useMemo(
        () => regions.reduce((sum, r) => sum + (typeof r.pop_2024 === "number" ? r.pop_2024 : 0), 0),
        [regions],
    );

    const rows = useMemo<DirectoryRow[]>(() => {
        if (tier === "region") {
            return regions.map((r) => ({
                psgc: r.psgc,
                correspondence: r.correspondence,
                name: r.name,
                subtitle: "Administrative Region",
                urlPath: `/${slugify(r.name)}`,
                geoLvl: "Region",
                pop_2024: r.pop_2024,
                density_2024: r.density_2024,
                area_km2: r.area_km2,
                pct_change_2020_2024: r.pct_change_2020_2024,
                assets_2024: r.assets_2024,
                gdp_2024: r.gdp_2024,
            }));
        }

        if (tier === "province") {
            return provinces.map((p) => {
                const reg = regionByPsgc.get(p.region_psgc);
                const regSlug = reg ? slugify(reg.name) : "";
                const provSlug = slugify(p.name);
                return {
                    psgc: p.psgc,
                    correspondence: p.correspondence,
                    name: p.name,
                    subtitle: reg ? reg.name : "Philippines",
                    urlPath: regSlug ? `/${regSlug}/${provSlug}` : `/${provSlug}`,
                    geoLvl: "Province",
                    pop_2024: p.pop_2024,
                    density_2024: p.density_2024,
                    area_km2: p.area_km2,
                    pct_change_2020_2024: p.pct_change_2020_2024,
                    assets_2024: p.assets_2024,
                    gdp_2024: p.gdp_2024,
                };
            });
        }

        return municityMeta.map((m) => {
            const reg = m.region_psgc ? regionByPsgc.get(m.region_psgc) : null;
            const prov = m.province_psgc ? provinceByPsgc.get(m.province_psgc) : null;
            const regSlug = reg ? slugify(reg.name) : "";
            const provSlug = prov ? slugify(prov.name) : "";
            const muniSlug = slugify(m.name);
            return {
                psgc: m.psgc,
                correspondence: m.correspondence,
                name: m.name,
                subtitle: prov ? `${prov.name}${reg ? ` · ${reg.name}` : ""}` : reg?.name ?? "Philippines",
                urlPath:
                    regSlug && provSlug
                        ? `/${regSlug}/${provSlug}/${muniSlug}`
                        : regSlug
                          ? `/${regSlug}/${muniSlug}`
                          : `/${muniSlug}`,
                geoLvl: m.city_lvl ? `${m.geo_lvl} (${m.city_lvl})` : m.geo_lvl,
                pop_2024: m.pop_2024,
                density_2024: m.density_2024,
                area_km2: m.area_km2,
                pct_change_2020_2024: m.pct_change_2020_2024,
                assets_2024: m.assets_2024,
                gdp_2024: m.gdp_2024,
            };
        });
    }, [tier, regions, provinces, municityMeta, regionByPsgc, provinceByPsgc]);

    const sortedAndFiltered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? rows.filter(
                  (r) =>
                      r.name.toLowerCase().includes(q) ||
                      r.subtitle.toLowerCase().includes(q) ||
                      r.psgc.includes(q) ||
                      (r.correspondence?.includes(q) ?? false),
              )
            : rows;

        return [...filtered].sort((a, b) => {
            const va = a[metric] ?? -Infinity;
            const vb = b[metric] ?? -Infinity;
            if (vb !== va) return vb - va;
            return a.name.localeCompare(b.name);
        });
    }, [rows, query, metric]);

    const maxMetricValue = useMemo(() => {
        let max = 0;
        for (const r of sortedAndFiltered) {
            const v = r[metric];
            if (typeof v === "number" && v > max) max = v;
        }
        return max;
    }, [sortedAndFiltered, metric]);

    const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedAndFiltered.slice(start, start + PAGE_SIZE);
    }, [sortedAndFiltered, currentPage]);

    const handleTierChange = (nextTier: DirectoryTier) => {
        setTier(nextTier);
        setPage(1);
    };

    const handleMetricChange = (nextMetric: SortMetric) => {
        setMetric(nextMetric);
        setPage(1);
    };

    const handleQueryChange = (nextQuery: string) => {
        setQuery(nextQuery);
        setPage(1);
    };

    return (
        <>
            <Helmet>
                <title>Philippines Geographic Directory, PSGC Codes, Population &amp; GeoJSON Index | Lens</title>
                <meta
                    name="description"
                    content="Rankings and searchable PSGC index for all 18 Philippine regions, 84 provinces, and 1,642 cities &amp; municipalities: 2024 census population, density, GDP, COA assets, and RFC 7946 GeoJSON downloads."
                />
                <link rel="canonical" href="https://lens.mapaph.com/directory" />
                <meta name="robots" content="index, follow" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://lens.mapaph.com/directory" />
                <meta
                    property="og:title"
                    content="Philippines Geographic Directory, PSGC Codes, Population & GeoJSON Index | Lens"
                />
                <meta
                    property="og:description"
                    content="Search and rank all 18 Philippine regions, 84 provinces, and 1,642 cities & municipalities with 2024 census data, COA financial assets, GDP, and GeoJSON downloads."
                />
                {directorySchema.map((schema, idx) => (
                    <script key={idx} type="application/ld+json">
                        {JSON.stringify(schema)}
                    </script>
                ))}
            </Helmet>

            <PageShell
                breadcrumb="Directory"
                eyebrow="Philippine Geospatial Reference"
                meta="POPCEN 2024 · COA AFR · PSA GDP · PSGC 1Q 2026"
                title="Geographic Directory & Statistical Rankings"
                description="Browse, filter, and rank every administrative tier in the Philippines by 2024 census population, density, land area, GDP, and COA LGU assets. Open any jurisdiction in the interactive map or export RFC 7946 GeoJSON boundaries."
                headerLink={{
                    href: "https://www.mapaph.com/docs/psgc",
                    label: "PSGC Standard Guide",
                }}
            >
                {/* National Baseline Summary */}
                <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4 rounded-none">
                    <div className="bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">2024 Population</div>
                        <div className="mt-1 font-mono text-lg font-bold text-primary">
                            {nationalPop > 0 ? Math.round(nationalPop).toLocaleString("en-US") : "112,729,484"}
                        </div>
                    </div>
                    <div className="bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Regions</div>
                        <div className="mt-1 font-mono text-lg font-bold text-primary">{regions.length || 18}</div>
                    </div>
                    <div className="bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Provinces / NCR</div>
                        <div className="mt-1 font-mono text-lg font-bold text-primary">{provinces.length || 84}</div>
                    </div>
                    <div className="bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Cities &amp; Munis</div>
                        <div className="mt-1 font-mono text-lg font-bold text-primary">
                            {(municityMeta.length || 1642).toLocaleString("en-US")}
                        </div>
                    </div>
                </div>

                {/* Filter & Leaderboard Controls */}
                <section className="border border-border bg-white rounded-none">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light bg-surface px-4 py-3 lg:px-5">
                        <div
                            role="tablist"
                            aria-label="Administrative tier"
                            className="flex items-stretch border border-border bg-white p-0.5 rounded-none"
                        >
                            {(
                                [
                                    { id: "region", label: `Regions (${regions.length || 18})` },
                                    { id: "province", label: `Provinces (${provinces.length || 84})` },
                                    { id: "municipality", label: `Cities & Munis (${municityMeta.length || 1642})` },
                                ] as const
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tier === item.id}
                                    onClick={() => handleTierChange(item.id)}
                                    className={`cursor-pointer px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-none transition-colors ${
                                        tier === item.id
                                            ? "bg-accent text-white"
                                            : "text-primary hover:bg-surface"
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <label htmlFor="directory-sort" className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                Rank by
                            </label>
                            <select
                                id="directory-sort"
                                value={metric}
                                onChange={(e) => handleMetricChange(e.target.value as SortMetric)}
                                className="border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-primary outline-none focus:border-accent rounded-none"
                            >
                                {METRIC_OPTIONS.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light bg-white px-4 py-3 lg:px-5">
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            placeholder="Search by jurisdiction name, 10-digit PSGC, legacy 9-digit PSGC, or parent province/region..."
                            aria-label="Filter Philippine administrative divisions"
                            className="min-w-60 flex-1 border border-border bg-white px-3 py-2 text-xs text-primary placeholder:text-muted outline-none transition-colors focus:border-accent rounded-none"
                        />
                        <span className="font-mono text-[11px] text-muted">
                            {sortedAndFiltered.length.toLocaleString("en-US")} matches
                        </span>
                    </div>

                    {error && (
                        <div className="border-b border-red-300 bg-red-50 px-5 py-3 text-xs text-red-800">
                            Failed to load geospatial registry: {error.message}
                        </div>
                    )}

                    {loading && rows.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted">Loading Philippine administrative registry…</div>
                    ) : pagedRows.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted">
                            No matching administrative divisions found for <span className="font-mono font-semibold text-primary">"{query}"</span>.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border bg-surface text-[10px] font-bold uppercase tracking-wider text-muted">
                                        <th className="w-12 px-4 py-2.5 text-right">#</th>
                                        <th className="px-4 py-2.5">Jurisdiction</th>
                                        <th className="hidden px-4 py-2.5 md:table-cell">PSGC (10-digit)</th>
                                        <th className="px-4 py-2.5">
                                            {METRIC_OPTIONS.find((m) => m.id === metric)?.label}
                                        </th>
                                        <th className="hidden px-4 py-2.5 text-right sm:table-cell">Area (km²)</th>
                                        <th className="px-4 py-2.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light bg-white">
                                    {pagedRows.map((row, idx) => {
                                        const rank = (currentPage - 1) * PAGE_SIZE + idx + 1;
                                        const rawVal = row[metric];
                                        const pctBar =
                                            maxMetricValue > 0 && typeof rawVal === "number" && rawVal > 0
                                                ? Math.min(100, (rawVal / maxMetricValue) * 100)
                                                : 0;

                                        return (
                                            <tr key={row.psgc} className="transition-colors hover:bg-surface/60">
                                                <td className="px-4 py-2.5 text-right font-mono text-[11px] text-muted">
                                                    {rank}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <Link
                                                        to={row.urlPath}
                                                        className="font-semibold text-accent hover:text-accent-dark hover:underline"
                                                    >
                                                        {row.name}
                                                    </Link>
                                                    <div className="mt-0.5 text-[11px] text-muted">{row.subtitle}</div>
                                                </td>
                                                <td className="hidden px-4 py-2.5 font-mono text-[11px] text-muted md:table-cell">
                                                    <div>{row.psgc}</div>
                                                    {row.correspondence && row.correspondence !== row.psgc && (
                                                        <div className="text-[10px] text-muted/75">
                                                            9d: {row.correspondence}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="min-w-36 px-4 py-2.5">
                                                    <div className="font-mono font-semibold text-primary">
                                                        {formatMetricValue(row, metric)}
                                                    </div>
                                                    <div className="mt-1 h-1.5 w-full bg-surface border border-border-light">
                                                        <div
                                                            className="h-full bg-accent"
                                                            style={{ width: `${pctBar}%` }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="hidden px-4 py-2.5 text-right font-mono text-[11px] text-muted sm:table-cell">
                                                    {formatArea(row.area_km2)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <Link
                                                            to={row.urlPath}
                                                            className="border border-border bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-surface rounded-none"
                                                        >
                                                            Data
                                                        </Link>
                                                        <Link
                                                            to={`${row.urlPath}?tab=geojson`}
                                                            className="border border-accent bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-accent-dark rounded-none"
                                                        >
                                                            GeoJSON
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-border-light bg-surface px-4 py-2.5 text-xs lg:px-5">
                            <span className="font-mono text-[11px] text-muted">
                                Page {currentPage} of {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={currentPage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="cursor-pointer border border-border bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface rounded-none"
                                >
                                    Prev
                                </button>
                                <button
                                    type="button"
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="cursor-pointer border border-border bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface rounded-none"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </PageShell>
        </>
    );
}
