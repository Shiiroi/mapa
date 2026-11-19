// Place detail tab aggregator: population, area, density, and downloadable stats (no geometry).

import { useMemo } from "react";
import { downloadJsonFile, downloadTextFile, slugifyFilename } from "../../../lib/downloadFile";
import { slugify } from "../../../lib/slugUtils";
import { useDivisionStats } from "../../hooks/useDivisionStats";
import { formatGdp } from "../../utils/formatStats";
import { broadAgeGroups } from "../../utils/ageSex";
import { mergePlaceStats } from "../../utils/mergePlaceStats";
import type { ResolvedPlace } from "../../utils/resolvePlace";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../../types";
import type { MapLevel } from "../../constants";
import { SubLevelDataTable } from "./info-sections/SubLevelDataTable";
import { TopDistributionBar } from "./info-sections/TopDistributionBar";
import { PopulationTrend } from "./info-sections/PopulationTrend";
import { SexDistribution } from "./info-sections/SexDistribution";
import { AgeStructure } from "./info-sections/AgeStructure";
import { AgeSexPyramid } from "./info-sections/AgeSexPyramid";
import { KeyStatsTable, CensusHistoryTable, GdpTable, SexDistributionTable, AgeStructureTable, type MetricRank, type PlaceRanks } from "./info-sections/InfoTables";

function computeEntityRank<T extends { psgc: string }>(
    psgc: string,
    items: T[],
    getValue: (item: T) => number | null | undefined,
): MetricRank | undefined {
    const valid = items
        .map((item) => ({ psgc: item.psgc, val: getValue(item) }))
        .filter((x): x is { psgc: string; val: number } => typeof x.val === "number" && Number.isFinite(x.val))
        .sort((a, b) => b.val - a.val);
    const idx = valid.findIndex((x) => x.psgc === psgc);
    if (idx < 0) return undefined;
    return { rank: idx + 1, total: valid.length };
}

function buildRanksForPeers<T extends { psgc: string; pop_2024?: number | null; density_2024?: number | null; area_km2?: number | null; assets_2024?: number | null }>(
    psgc: string,
    peers: T[],
    scope: string,
): PlaceRanks {
    return {
        scope,
        pop: computeEntityRank(psgc, peers, (item) => item.pop_2024),
        density: computeEntityRank(psgc, peers, (item) => item.density_2024),
        area: computeEntityRank(psgc, peers, (item) => item.area_km2),
        assets: computeEntityRank(psgc, peers, (item) => item.assets_2024),
    };
}

export interface InfoTabProps {
    place: ResolvedPlace | null;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    onRegionChange: (psgc: string | null) => void;
    onProvinceChange: (psgc: string | null) => void;
    onMunicityChange: (psgc: string | null) => void;
    onBarangayChange?: (psgc: string | null) => void;
    onLevelChange?: (level: MapLevel) => void;
}

const PSA_PSGC_URL = "https://psa.gov.ph/classification/psgc/";
const PSA_AGESEX_URL = "https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing";
const PSA_AGESEX_FILE_URL =
    "https://psa.gov.ph/system/files/phcd/2022-12/4_Household%2520Population%2520by%2520Age%2520Group%2520and%2520Sex_Philippines_2020%2520CPH_rev.xlsx";
const PSA_GDP_URL = "https://openstat.psa.gov.ph/Database/Gross-Regional-Domestic-Product";

const POP_HISTORY: { year: number; key: "pop_2010" | "pop_2015" | "pop_2020" | "pop_2024" }[] = [
    { year: 2010, key: "pop_2010" },
    { year: 2015, key: "pop_2015" },
    { year: 2020, key: "pop_2020" },
    { year: 2024, key: "pop_2024" },
];

const GDP_HISTORY: { year: number; key: "gdp_2022" | "gdp_2023" | "gdp_2024" }[] = [
    { year: 2022, key: "gdp_2022" },
    { year: 2023, key: "gdp_2023" },
    { year: 2024, key: "gdp_2024" },
];

export function InfoTab({
    place,
    regions,
    provinces,
    municityMeta,
    barangays,
    onRegionChange,
    onProvinceChange,
    onMunicityChange,
    onBarangayChange,
    onLevelChange,
}: InfoTabProps) {
    const handleSelectEntity = (psgc: string, subLevel: MapLevel) => {
        if (subLevel === "region") {
            onRegionChange(psgc);
            onProvinceChange(null);
            onMunicityChange(null);
            onBarangayChange?.(null);
            onLevelChange?.("region");
        } else if (subLevel === "province") {
            const province = provinces.find((p) => p.psgc === psgc);
            if (province) {
                onRegionChange(province.region_psgc);
                onProvinceChange(psgc);
                onMunicityChange(null);
                onBarangayChange?.(null);
                onLevelChange?.("province");
            }
        } else if (subLevel === "municipality") {
            const muni = municityMeta.find((m) => m.psgc === psgc);
            if (muni) {
                onRegionChange(muni.region_psgc);
                onProvinceChange(muni.province_psgc);
                onMunicityChange(psgc);
                onBarangayChange?.(null);
                onLevelChange?.("municipality");
            }
        } else if (subLevel === "barangay") {
            const bgy = barangays.find((b) => b.psgc === psgc);
            if (bgy) {
                onRegionChange(bgy.region_psgc);
                onProvinceChange(bgy.province_psgc);
                onMunicityChange(bgy.municity_psgc);
                onBarangayChange?.(psgc);
                onLevelChange?.("barangay");
            }
        }
    };
    const statsQuery = useDivisionStats(place?.psgc ?? null);
    const displayPlace = useMemo(() => (place ? mergePlaceStats(place, statsQuery.data) : null), [place, statsQuery.data]);

    const placeRanks = useMemo((): PlaceRanks | null => {
        if (!displayPlace) return null;
        if (displayPlace.level === "region" && regions.length > 0) {
            return buildRanksForPeers(displayPlace.psgc, regions, "Philippines");
        }
        if (displayPlace.level === "province" && provinces.length > 0) {
            return buildRanksForPeers(displayPlace.psgc, provinces, "Philippines");
        }
        if (displayPlace.level === "municipality" && displayPlace.province_psgc) {
            const prov = provinces.find((p) => p.psgc === displayPlace.province_psgc);
            const peers = municityMeta.filter((m) => m.province_psgc === displayPlace.province_psgc);
            if (peers.length > 0) {
                return buildRanksForPeers(displayPlace.psgc, peers, prov?.name ?? "Province");
            }
        }
        if (displayPlace.level === "barangay" && barangays.length > 0) {
            const muni = municityMeta.find((m) => m.psgc === displayPlace.municity_psgc);
            const peers = barangays.filter((b) => b.municity_psgc === displayPlace.municity_psgc);
            if (peers.length > 0) {
                return buildRanksForPeers(displayPlace.psgc, peers, muni?.name ?? "Municipality");
            }
        }
        return null;
    }, [displayPlace, regions, provinces, municityMeta, barangays]);

    // Compute stable points for Population History chart
    const popHistoryPoints = useMemo(() => {
        if (!displayPlace) return [];
        return POP_HISTORY.map((row) => ({ year: row.year, value: displayPlace[row.key] })).filter(
            (p): p is { year: number; value: number } => p.value != null,
        );
    }, [displayPlace]);

    // Compute stable points for GDP history chart
    const gdpHistoryPoints = useMemo(() => {
        if (!displayPlace) return [];
        return GDP_HISTORY.map((row) => ({ year: row.year, value: displayPlace[row.key] })).filter(
            (p): p is { year: number; value: number } => p.value != null,
        );
    }, [displayPlace]);

    // Compute stable broad age group structures
    const ageGroups = useMemo(() => {
        if (!displayPlace?.age_sex_2020) return null;
        return broadAgeGroups(displayPlace.age_sex_2020);
    }, [displayPlace]);

    const gdpPerCapita = useMemo(() => {
        if (!displayPlace || displayPlace.gdp_2024 == null || displayPlace.pop_2024 == null || displayPlace.pop_2024 === 0) {
            return null;
        }
        return displayPlace.gdp_2024 / displayPlace.pop_2024;
    }, [displayPlace]);

    function handleDownloadJson() {
        if (!displayPlace) return;
        const date = new Date().toISOString().slice(0, 10);
        const payload = {
            psgc: displayPlace.psgc,
            name: displayPlace.name,
            level: displayPlace.level,
            geo_lvl: displayPlace.geo_lvl,
            breadcrumb: displayPlace.breadcrumb,
            population_2024: displayPlace.pop_2024,
            population_2020: displayPlace.pop_2020,
            population_2015: displayPlace.pop_2015,
            population_2010: displayPlace.pop_2010,
            pop_male_2020: displayPlace.pop_male_2020,
            pop_female_2020: displayPlace.pop_female_2020,
            age_sex_2020: displayPlace.age_sex_2020,
            area_km2: displayPlace.area_km2,
            density_2024_per_km2: displayPlace.density_2024,
            pct_change_2020_2024: displayPlace.pct_change_2020_2024,
            assets_2024: displayPlace.assets_2024,
            gdp_2022: displayPlace.gdp_2022,
            gdp_2023: displayPlace.gdp_2023,
            gdp_2024: displayPlace.gdp_2024,
            gdp_per_capita_2024: gdpPerCapita,
            source: "Population from the Philippine Statistics Authority (PSA) PSGC and 2010/2015/2020/2024 census tables; 2020 household age/sex and GDP (constant 2018 prices) from PSA; area and derived metrics (density, % change) computed by Mapa from PSA boundaries. Total assets from COA CY2024 AFR.",
            source_url: PSA_PSGC_URL,
            age_sex_source: "PSA 2020 Census — Age/Sex Distribution",
            age_sex_source_url: PSA_AGESEX_URL,
            age_sex_file_url: PSA_AGESEX_FILE_URL,
            gdp_source: "PSA GDP by Province/HUCs",
            gdp_source_url: PSA_GDP_URL,
            assets_source: "COA CY2024 AFR",
        };
        downloadJsonFile(payload, `mapa-info-${slugifyFilename(displayPlace.name)}-${date}.json`);
    }

    function handleDownloadCsv() {
        if (!displayPlace) return;
        const date = new Date().toISOString().slice(0, 10);
        const rows = [
            ["field", "value"],
            ["psgc", displayPlace.psgc],
            ["name", displayPlace.name],
            ["level", displayPlace.level],
            ["population_2024", String(displayPlace.pop_2024 ?? "")],
            ["population_2020", String(displayPlace.pop_2020 ?? "")],
            ["population_2015", String(displayPlace.pop_2015 ?? "")],
            ["population_2010", String(displayPlace.pop_2010 ?? "")],
            ["pop_male_2020", String(displayPlace.pop_male_2020 ?? "")],
            ["pop_female_2020", String(displayPlace.pop_female_2020 ?? "")],
            ["area_km2", String(displayPlace.area_km2 ?? "")],
            ["density_2024", String(displayPlace.density_2024 ?? "")],
            ["pct_change_2020_2024", String(displayPlace.pct_change_2020_2024 ?? "")],
            ["assets_2024", String(displayPlace.assets_2024 ?? "")],
            ["gdp_2022", String(displayPlace.gdp_2022 ?? "")],
            ["gdp_2023", String(displayPlace.gdp_2023 ?? "")],
            ["gdp_2024", String(displayPlace.gdp_2024 ?? "")],
            ["gdp_per_capita_2024", String(gdpPerCapita ?? "")],
            [
                "source",
                "Philippine Statistics Authority (PSA) PSGC and 2010–2024 censuses; 2020 CPH age/sex; GDP constant 2018 prices; area/density/change derived by Mapa; assets from COA CY2024 AFR",
            ],
            ["source_url", PSA_PSGC_URL],
            ["age_sex_source", "PSA 2020 Census of Population and Housing — Age and Sex Distribution"],
            ["age_sex_source_url", PSA_AGESEX_URL],
            ["age_sex_file_url", PSA_AGESEX_FILE_URL],
            ["gdp_source", "PSA Gross Domestic Product by Province and HUCs (constant 2018 prices)"],
            ["gdp_source_url", PSA_GDP_URL],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadTextFile(csv, `mapa-info-${slugifyFilename(displayPlace.name)}-${date}.csv`, "text/csv");
    }

    const renderInteractiveBreadcrumbs = () => {
        if (!displayPlace) return null;
        const breadcrumbs: { label: string; href: string; action: () => void }[] = [];

        breadcrumbs.push({
            label: "Philippines",
            href: "/",
            action: () => {
                onRegionChange(null);
                onProvinceChange(null);
                onMunicityChange(null);
                onBarangayChange?.(null);
                onLevelChange?.("country");
            },
        });

        const regPsgc = displayPlace.region_psgc || (displayPlace.level === "region" ? displayPlace.psgc : null);
        const regionObj = regPsgc ? regions.find((r) => r.psgc === regPsgc) : undefined;
        const regSlug = regionObj ? slugify(regionObj.name) : "";
        if (regPsgc && regionObj) {
            breadcrumbs.push({
                label: regionObj.name.trim(),
                href: `/${regSlug}`,
                action: () => {
                    onRegionChange(regPsgc);
                    onProvinceChange(null);
                    onMunicityChange(null);
                    onBarangayChange?.(null);
                    onLevelChange?.("region");
                },
            });
        }

        const provPsgc = displayPlace.province_psgc || (displayPlace.level === "province" ? displayPlace.psgc : null);
        const provinceObj = provPsgc && displayPlace.level !== "region" ? provinces.find((p) => p.psgc === provPsgc) : undefined;
        const provSlug = provinceObj ? slugify(provinceObj.name) : "";
        if (provPsgc && provinceObj) {
            breadcrumbs.push({
                label: provinceObj.name.trim(),
                href: regSlug ? `/${regSlug}/${provSlug}` : `/${provSlug}`,
                action: () => {
                    onRegionChange(provinceObj.region_psgc);
                    onProvinceChange(provPsgc);
                    onMunicityChange(null);
                    onBarangayChange?.(null);
                    onLevelChange?.("province");
                },
            });
        }

        const muniPsgc =
            displayPlace.level === "barangay" ? displayPlace.municity_psgc : displayPlace.level === "municipality" ? displayPlace.psgc : null;
        const muniObj =
            muniPsgc && (displayPlace.level === "municipality" || displayPlace.level === "barangay")
                ? municityMeta.find((m) => m.psgc === muniPsgc)
                : undefined;
        const muniSlug = muniObj ? slugify(muniObj.name) : "";
        if (muniPsgc && muniObj) {
            const muniHref = regSlug && provSlug ? `/${regSlug}/${provSlug}/${muniSlug}` : regSlug ? `/${regSlug}/${muniSlug}` : `/${muniSlug}`;
            breadcrumbs.push({
                label: muniObj.name.trim(),
                href: muniHref,
                action: () => {
                    onRegionChange(muniObj.region_psgc);
                    onProvinceChange(muniObj.province_psgc);
                    onMunicityChange(muniPsgc);
                    onBarangayChange?.(null);
                    onLevelChange?.("municipality");
                },
            });
        }

        if (displayPlace.level === "barangay") {
            const bgySlug = slugify(displayPlace.name);
            const bgyHref =
                regSlug && provSlug && muniSlug ? `/${regSlug}/${provSlug}/${muniSlug}/${bgySlug}` : "/";
            breadcrumbs.push({
                label: displayPlace.name.trim(),
                href: bgyHref,
                action: () => {},
            });
        }

        return (
            <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-sans font-bold text-muted uppercase tracking-wider mb-2 border border-border p-2 bg-slate-50/50">
                {breadcrumbs.map((b, i) => {
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                        <span key={i} className="flex items-center gap-x-1.5">
                            {i > 0 && <span className="text-slate-300 font-bold font-mono">›</span>}
                            {isLast ? (
                                <span className="text-primary font-bold">{b.label}</span>
                            ) : (
                                <a
                                    href={b.href}
                                    onClick={(e) => {
                                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                                            e.preventDefault();
                                            b.action();
                                        }
                                    }}
                                    className="text-accent hover:underline hover:text-accent-dark transition-colors cursor-pointer"
                                >
                                    {b.label}
                                </a>
                            )}
                        </span>
                    );
                })}
            </nav>
        );
    };

    if (!place) {
        return (
            <p className="text-xs text-muted font-medium italic">
                Select a place to explore Philippine demographic statistics including population distribution, census data from the Philippine
                Statistics Authority (PSA), economic indicators, and geographic data. This PhilStats-like tool provides comprehensive Philippine
                geographic and economic information down to the barangay level.
            </p>
        );
    }

    if (!displayPlace) return null;

    return (
        <div className="space-y-4">
            <div>
                {renderInteractiveBreadcrumbs()}
                <div className="flex items-baseline justify-between gap-2 mt-2">
                    <h2 className="text-lg font-bold text-primary tracking-tight">{displayPlace.name}</h2>
                    <span className="font-mono text-[10px] text-muted font-medium bg-slate-100 border border-border px-1.5 py-0.5">
                        PSGC {displayPlace.psgc}
                    </span>
                </div>
                {displayPlace.geo_lvl === "Special" && (
                    <div className="mt-2 border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 rounded-none">
                        Non-residential parcel — not a PSGC census unit; no official population.
                        {displayPlace.note ? ` ${displayPlace.note}` : ""}
                    </div>
                )}
            </div>

            {/* Key Statistics Grid Table */}
            <KeyStatsTable displayPlace={displayPlace} ranks={placeRanks} />

            {displayPlace.level === "barangay" && (
                <div className="text-[10px] text-amber-800 bg-amber-50/50 border border-amber-300 px-3 py-2 leading-normal">
                    <strong>Note:</strong> Barangay land area and population density metrics are computationally derived geographic approximations by
                    Mapa. Official PSA Table A breakdowns are unavailable at this resolution.
                </div>
            )}

            {(displayPlace.pop_2010 != null || displayPlace.pop_2015 != null || displayPlace.pop_2020 != null || displayPlace.pop_2024 != null) && (
                <section className="space-y-2 border-t border-border pt-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                        Population Census History
                    </p>
                    <CensusHistoryTable displayPlace={displayPlace} />
                    <PopulationTrend points={popHistoryPoints} />
                    <p className="text-[10px] leading-normal text-muted bg-slate-50 p-2 border border-border font-sans">
                        Change is the total percent change since the previous census. Growth/yr is the compound annual growth rate over the exact
                        period, matching PSA’s published methodology.
                    </p>
                </section>
            )}

            {displayPlace.gdp_2024 != null && (
                <section className="space-y-2 border-t border-border pt-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                        Gross domestic product (gdp)
                    </p>
                    <GdpTable displayPlace={displayPlace} gdpPerCapita={gdpPerCapita} />
                    <PopulationTrend points={gdpHistoryPoints} formatValue={formatGdp} ariaLabel="GDP over time" />
                </section>
            )}

            {displayPlace.age_sex_2020 != null && displayPlace.age_sex_2020.length > 0 && (
                <section className="space-y-4 border-t border-border pt-3.5">
                    {/* Sex distribution with donut chart */}
                    {displayPlace.pop_male_2020 != null && displayPlace.pop_female_2020 != null && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                                Sex Distribution (2020 CPH)
                            </p>
                            <div className="grid grid-cols-2 gap-3 items-center">
                                <SexDistributionTable male={displayPlace.pop_male_2020} female={displayPlace.pop_female_2020} />
                                <SexDistribution male={displayPlace.pop_male_2020} female={displayPlace.pop_female_2020} />
                            </div>
                        </div>
                    )}

                    {/* Broad Age groups with vertical bar chart */}
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                            Age Structure (2020 CPH)
                        </p>
                        <div className="grid grid-cols-[1.2fr_1fr] gap-3 items-center">
                            <AgeStructureTable ageSexBands={displayPlace.age_sex_2020} />
                            {ageGroups && <AgeStructure young={ageGroups.young} working={ageGroups.working} senior={ageGroups.senior} />}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                            Age &amp; Sex Pyramid
                        </p>
                        <AgeSexPyramid bands={displayPlace.age_sex_2020} />
                    </div>
                </section>
            )}

            <TopDistributionBar
                level={displayPlace.level}
                regions={regions}
                provinces={provinces}
                municityMeta={municityMeta}
                barangays={barangays}
                selectedRegionPsgc={displayPlace.region_psgc || (displayPlace.level === "region" ? displayPlace.psgc : null)}
                selectedProvincePsgc={displayPlace.province_psgc || (displayPlace.level === "province" ? displayPlace.psgc : null)}
                parentName={displayPlace.name}
            />

            <SubLevelDataTable
                level={displayPlace.level}
                regions={regions}
                provinces={provinces}
                municityMeta={municityMeta}
                barangays={barangays}
                selectedRegionPsgc={displayPlace.region_psgc || (displayPlace.level === "region" ? displayPlace.psgc : null)}
                selectedProvincePsgc={displayPlace.province_psgc || (displayPlace.level === "province" ? displayPlace.psgc : null)}
                selectedMunicityPsgc={displayPlace.municity_psgc || (displayPlace.level === "municipality" ? displayPlace.psgc : null)}
                onSelectEntity={handleSelectEntity}
            />

            <div className="flex gap-2 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="flex-1 border border-border bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-slate-50 transition-colors cursor-pointer rounded-none"
                >
                    Download info (JSON)
                </button>
                <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="flex-1 border border-border bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-slate-50 transition-colors cursor-pointer rounded-none"
                >
                    Download info (CSV)
                </button>
            </div>
        </div>
    );
}
