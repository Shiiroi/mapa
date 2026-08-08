import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { track } from "@vercel/analytics";
import { MapDashboard } from "../map/components/Index";
import type { SidebarTab } from "../map/components/Sidebar";
import { useBarangays } from "../map/hooks/useBarangays";
import { useMapDownload } from "../map/hooks/useMapDownload";
import { useUrlToStateSync } from "../map/hooks/useUrlToStateSync";
import { useStateToUrlSync } from "../map/hooks/useStateToUrlSync";
import { useMapLayers } from "../map/hooks/useMapLayers";
import type { MapLevel } from "../map/constants";
import type { CustomOverlay, SeriesViewState } from "../map/types";
import { defaultSeriesViewState } from "../map/utils/seriesScale";
import { slugify } from "../lib/slugUtils";

const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Lens",
    "url": "https://lens.mapaph.com/",
    "applicationCategory": "GeographicInformationSystem",
    "operatingSystem": "All",
    "description": "Interactive Philippines map for visualizing census, economic, and election data, and downloading standards-compliant GeoJSON boundaries.",
};

export default function MainPage() {
    const download = useMapDownload();

    const [activeOverlay, setActiveOverlay] = useState<CustomOverlay | null>(null);
    const [overlayView, setOverlayView] = useState<SeriesViewState>({ mode: "lead" });
    const [mapLevel, setMapLevel] = useState<MapLevel>("country");
    const [activeTab, setActiveTab] = useState<SidebarTab>("geojson");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 0));
    const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
    );
    const mobileDrawerMinHeightPx = 88;
    const mobileDrawerMaxHeightPx = useMemo(() => Math.max(mobileDrawerMinHeightPx, Math.round(viewportHeight * 0.65)), [viewportHeight]);
    const [mobileDrawerHeightPx, setMobileDrawerHeightPx] = useState(mobileDrawerMinHeightPx);

    const { provinces, municities, municityMeta, regions, country, loading, municitiesLoading, error } = useMapLayers({
        loadMunicitiesGeometry: mapLevel === "municipality",
        selectedRegionPsgc: download.selectedRegionPsgc,
        selectedProvincePsgc: download.selectedProvincePsgc,
    });

    useEffect(() => {
        if (activeOverlay?.kind === "series") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOverlayView(defaultSeriesViewState(activeOverlay));
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOverlayView({ mode: "lead" });
        }
    }, [activeOverlay]);

    useEffect(() => {
        const onResize = () => {
            setViewportHeight(window.innerHeight);
            setIsDesktopViewport(window.matchMedia("(min-width: 1024px)").matches);
        };

        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // download is now initialized at the top to resolve circular dependency

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMapLevel(download.level);
    }, [download.level]);

    const knownPsgcs = useMemo(() => {
        const set = new Set<string>();
        if (country) set.add(country.psgc);
        for (const r of regions) set.add(r.psgc);
        for (const p of provinces) set.add(p.psgc);
        for (const m of municityMeta) set.add(m.psgc);
        return set;
    }, [country, regions, provinces, municityMeta]);

    // True level per PSGC
    const psgcLevels = useMemo(() => {
        const map = new Map<string, MapLevel>();
        if (country) map.set(country.psgc, "country");
        for (const r of regions) map.set(r.psgc, "region");
        for (const p of provinces) map.set(p.psgc, "province");
        for (const m of municityMeta) map.set(m.psgc, "municipality");
        return map;
    }, [country, regions, provinces, municityMeta]);

    const psgcLevelsByTier = useMemo(
        (): Partial<Record<MapLevel, ReadonlySet<string>>> => ({
            region: new Set(regions.map((r) => r.psgc)),
            province: new Set(provinces.map((p) => p.psgc)),
            municipality: new Set(municityMeta.map((m) => m.psgc)),
        }),
        [regions, provinces, municityMeta],
    );

    const barangaysQuery = useBarangays(
        download.selectedMunicityPsgc,
        download.level === "barangay"
    );

    const barangays = barangaysQuery.data ?? [];

    // Sync URL to state on direct page load
    useUrlToStateSync({
        regions,
        provinces,
        municityMeta,
        barangays,
        onSetRegion: download.setSelectedRegionPsgc,
        onSetProvince: download.setSelectedProvincePsgc,
        onSetMunicity: download.setSelectedMunicityPsgc,
        onSetBarangay: download.setSelectedBarangayPsgc,
        onSetLevel: download.setLevel,
    });

    // Sync state to URL when user selects location tiers
    useStateToUrlSync({
        regions,
        provinces,
        municityMeta,
        barangays,
        selectedRegionPsgc: download.selectedRegionPsgc,
        selectedProvincePsgc: download.selectedProvincePsgc,
        selectedMunicityPsgc: download.selectedMunicityPsgc,
        selectedBarangayPsgc: download.selectedBarangayPsgc,
        level: download.level,
    });
    const mapLoading =
        loading || (download.level === "municipality" && municitiesLoading) || (download.level === "barangay" && barangaysQuery.isLoading);

    const mapLoadingMessage = useMemo(() => {
        if (loading) {
            return "Loading base map layers…";
        }
        if (download.level === "municipality" && municitiesLoading) {
            return "Loading municipal boundaries… (this may take a few seconds)";
        }
        if (download.level === "barangay" && barangaysQuery.isLoading) {
            const muniName = download.selectedMunicityPsgc
                ? municityMeta.find((m) => m.psgc === download.selectedMunicityPsgc)?.name || "municipality"
                : "municipality";
            return `Loading barangay outlines for ${muniName}…`;
        }
        return "";
    }, [loading, download.level, download.selectedMunicityPsgc, municitiesLoading, barangaysQuery.isLoading, municityMeta]);

    const activePsgc = useMemo(() => {
        return (
            download.selectedBarangayPsgc ||
            download.selectedMunicityPsgc ||
            download.selectedProvincePsgc ||
            download.selectedRegionPsgc ||
            (country?.psgc ?? null)
        );
    }, [download.selectedBarangayPsgc, download.selectedMunicityPsgc, download.selectedProvincePsgc, download.selectedRegionPsgc, country]);

    const handleFeatureClick = useCallback(
        (entityPsgc: string, mode: MapLevel) => {
            track("select_shape", { psgc: entityPsgc, level: mode });
            download.setSelectionFromMap(mode, entityPsgc, { provinces, municities, municityMeta });
            // On mobile: expand info tab so user sees details.
            if (activeTab === "info") {
                setIsSidebarCollapsed(false);
            }
        },
        [download, activeTab, provinces, municities, municityMeta],
    );

    const handleLevelChange = useCallback(
        (level: MapLevel) => {
            track("toggle_map_view_mode", { level });
            download.setLevel(level);
        },
        [download],
    );

    const handleTabChange = useCallback((tab: SidebarTab) => {
        track("switch_sidebar_tab", { tab });
        setActiveTab(tab);
    }, []);

    const handleDrawerExpand = useCallback(() => {
        setIsSidebarCollapsed(false);
        setMobileDrawerHeightPx(mobileDrawerMaxHeightPx);
    }, [mobileDrawerMaxHeightPx]);

    const handleDrawerCollapse = useCallback(() => {
        setIsSidebarCollapsed(true);
        setMobileDrawerHeightPx(mobileDrawerMinHeightPx);
    }, []);

    const handleDrawerHeightChange = useCallback((heightPx: number) => {
        setMobileDrawerHeightPx(heightPx);
    }, []);

    const handleDrawerToggle = useCallback(() => {
        setIsSidebarCollapsed((prev) => {
            const nextCollapsed = !prev;
            setMobileDrawerHeightPx(nextCollapsed ? mobileDrawerMinHeightPx : mobileDrawerMaxHeightPx);
            return nextCollapsed;
        });
    }, [mobileDrawerMaxHeightPx]);

    const pageMeta = useMemo(() => {
        const baseUrl = "https://lens.mapaph.com";
        const selectedMuni = download.selectedMunicityPsgc
            ? municityMeta.find((m) => m.psgc === download.selectedMunicityPsgc)
            : null;
        const selectedProv = download.selectedProvincePsgc
            ? provinces.find((p) => p.psgc === download.selectedProvincePsgc)
            : null;
        const selectedReg = download.selectedRegionPsgc
            ? regions.find((r) => r.psgc === download.selectedRegionPsgc)
            : null;

        if (selectedMuni) {
            const prov = selectedMuni.province_psgc
                ? provinces.find((p) => p.psgc === selectedMuni.province_psgc)
                : null;
            const reg = selectedMuni.region_psgc
                ? regions.find((r) => r.psgc === selectedMuni.region_psgc)
                : null;
            const locationStr = prov ? `${selectedMuni.name}, ${prov.name}` : selectedMuni.name;
            const muniSlug = slugify(selectedMuni.name);
            const provSlug = prov ? slugify(prov.name) : "";
            const regSlug = reg ? slugify(reg.name) : "";
            const canonical = `${baseUrl}/municipality/${muniSlug}`;

            const popStr = selectedMuni.pop_2024 ? Math.round(selectedMuni.pop_2024).toLocaleString("en-US") : "N/A";
            const areaStr = selectedMuni.area_km2 ? selectedMuni.area_km2.toFixed(1) : "N/A";
            const densityStr = selectedMuni.density_2024 ? Math.round(selectedMuni.density_2024).toLocaleString("en-US") : "N/A";

            const breadcrumbs: Record<string, unknown>[] = [
                { "@type": "ListItem", position: 1, name: "Philippines", item: `${baseUrl}/` },
            ];
            if (reg && regSlug) {
                breadcrumbs.push({ "@type": "ListItem", position: 2, name: reg.name, item: `${baseUrl}/region/${regSlug}` });
            }
            if (prov && provSlug) {
                breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: prov.name, item: `${baseUrl}/province/${provSlug}` });
            }
            breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: selectedMuni.name, item: canonical });

            return {
                title: `${locationStr} — Boundary Map & GeoJSON Data | Lens PH`,
                description: `Download GeoJSON boundaries, view population density (${densityStr}/sq km), area (${areaStr} sq km), and barangay map data for ${locationStr}, Philippines.`,
                keywords: `${selectedMuni.name.toLowerCase()} geojson, ${selectedMuni.name.toLowerCase()} boundary map, ${locationStr.toLowerCase()} map, psgc ${selectedMuni.psgc}`,
                canonical,
                schemas: [
                    {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: breadcrumbs,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "AdministrativeArea",
                        name: selectedMuni.name,
                        alternateName: `PSGC ${selectedMuni.psgc}`,
                        description: `${selectedMuni.name} is a ${selectedMuni.geo_lvl === "City" ? "city" : "municipality"} in ${prov ? prov.name : "the Philippines"} with a 2024 population of ${popStr} and an area of ${areaStr} sq km.`,
                        url: canonical,
                        containedInPlace: prov
                            ? { "@type": "AdministrativeArea", name: prov.name, url: `${baseUrl}/province/${provSlug}` }
                            : undefined,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Dataset",
                        name: `${selectedMuni.name} GeoJSON Boundary Dataset`,
                        description: `GeoJSON administrative boundary vector data and barangay metrics for ${locationStr}, Philippines.`,
                        url: canonical,
                        spatialCoverage: { "@type": "Place", name: locationStr },
                    },
                ],
            };
        }

        if (selectedProv) {
            const reg = selectedProv.region_psgc
                ? regions.find((r) => r.psgc === selectedProv.region_psgc)
                : null;
            const provSlug = slugify(selectedProv.name);
            const regSlug = reg ? slugify(reg.name) : "";
            const canonical = `${baseUrl}/province/${provSlug}`;

            const popStr = selectedProv.pop_2024 ? Math.round(selectedProv.pop_2024).toLocaleString("en-US") : "N/A";
            const areaStr = selectedProv.area_km2 ? selectedProv.area_km2.toFixed(1) : "N/A";

            const breadcrumbs: Record<string, unknown>[] = [
                { "@type": "ListItem", position: 1, name: "Philippines", item: `${baseUrl}/` },
            ];
            if (reg && regSlug) {
                breadcrumbs.push({ "@type": "ListItem", position: 2, name: reg.name, item: `${baseUrl}/region/${regSlug}` });
            }
            breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: selectedProv.name, item: canonical });

            return {
                title: `${selectedProv.name} GeoJSON Map, Population & Boundaries | Lens PH`,
                description: `Download GeoJSON boundaries and view population (${popStr}), area (${areaStr} sq km), and municipal map data for ${selectedProv.name}, ${reg ? reg.name : "Philippines"}.`,
                keywords: `${selectedProv.name.toLowerCase()} geojson, ${selectedProv.name.toLowerCase()} map, ${selectedProv.name.toLowerCase()} province boundaries, psgc ${selectedProv.psgc}`,
                canonical,
                schemas: [
                    {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: breadcrumbs,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "AdministrativeArea",
                        name: selectedProv.name,
                        alternateName: `PSGC ${selectedProv.psgc}`,
                        description: `${selectedProv.name} is a province in ${reg ? reg.name : "the Philippines"} with a 2024 population of ${popStr} and an area of ${areaStr} sq km.`,
                        url: canonical,
                        containedInPlace: reg
                            ? { "@type": "AdministrativeArea", name: reg.name, url: `${baseUrl}/region/${regSlug}` }
                            : undefined,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Dataset",
                        name: `${selectedProv.name} GeoJSON Boundary Dataset`,
                        description: `GeoJSON administrative boundary vector data and municipal metrics for ${selectedProv.name}, Philippines.`,
                        url: canonical,
                        spatialCoverage: { "@type": "Place", name: selectedProv.name },
                    },
                ],
            };
        }

        if (selectedReg) {
            const regSlug = slugify(selectedReg.name);
            const canonical = `${baseUrl}/region/${regSlug}`;

            const popStr = selectedReg.pop_2024 ? Math.round(selectedReg.pop_2024).toLocaleString("en-US") : "N/A";
            const areaStr = selectedReg.area_km2 ? selectedReg.area_km2.toFixed(1) : "N/A";

            return {
                title: `${selectedReg.name} GeoJSON Map & Geographic Data | Lens PH`,
                description: `Explore ${selectedReg.name}, Philippines boundary map, GeoJSON download, population (${popStr}), land area (${areaStr} sq km), and density statistics.`,
                keywords: `${selectedReg.name.toLowerCase()} geojson, ${selectedReg.name.toLowerCase()} map, philippine regions, psgc ${selectedReg.psgc}`,
                canonical,
                schemas: [
                    {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            { "@type": "ListItem", position: 1, name: "Philippines", item: `${baseUrl}/` },
                            { "@type": "ListItem", position: 2, name: selectedReg.name, item: canonical },
                        ],
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "AdministrativeArea",
                        name: selectedReg.name,
                        alternateName: `PSGC ${selectedReg.psgc}`,
                        description: `${selectedReg.name} is an administrative region in the Philippines with a 2024 population of ${popStr} and an area of ${areaStr} sq km.`,
                        url: canonical,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Dataset",
                        name: `${selectedReg.name} GeoJSON Boundary Dataset`,
                        description: `GeoJSON administrative boundaries and census statistics for ${selectedReg.name}, Philippines.`,
                        url: canonical,
                        spatialCoverage: { "@type": "Place", name: selectedReg.name },
                    },
                ],
            };
        }

        // Homepage Default
        return {
            title: "Philippines GeoJSON Boundaries & Interactive Maps | Lens (MapaPH)",
            description: "Free GeoJSON administrative boundaries for every Philippine region, province, city, municipality, and barangay. Visualize population density, census metrics, GDP, and LGU data.",
            keywords: "philippines geojson, geojson philippines, ph map, philippines map, gis mapping philippines, population density map philippines, PSGC map, mapaph",
            canonical: `${baseUrl}/`,
            schemas: [webAppSchema],
        };
    }, [download.selectedMunicityPsgc, download.selectedProvincePsgc, download.selectedRegionPsgc, municityMeta, provinces, regions]);

    return (
        <>
            <Helmet>
                <title>{pageMeta.title}</title>
                <meta name="title" content={pageMeta.title} />
                <meta name="description" content={pageMeta.description} />
                <meta name="keywords" content={pageMeta.keywords} />
                <link rel="canonical" href={pageMeta.canonical} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={pageMeta.canonical} />
                <meta property="og:title" content={pageMeta.title} />
                <meta property="og:description" content={pageMeta.description} />
                <meta property="og:image" content="https://lens.mapaph.com/og-image.png" />
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:url" content={pageMeta.canonical} />
                <meta property="twitter:title" content={pageMeta.title} />
                <meta property="twitter:description" content={pageMeta.description} />
                <meta property="twitter:image" content="https://lens.mapaph.com/og-image.png" />
                {pageMeta.schemas.map((s, idx) => (
                    <script key={idx} type="application/ld+json">
                        {JSON.stringify(s)}
                    </script>
                ))}
            </Helmet>
            <MapDashboard
                level={download.level}
                regions={regions}
                provinces={provinces}
                municities={municities}
                municityMeta={municityMeta}
                country={country}
                barangays={barangays}
                barangaysLoading={barangaysQuery.isLoading}
                selectedRegionPsgc={download.selectedRegionPsgc}
                onRegionChange={download.setSelectedRegionPsgc}
                selectedProvincePsgc={download.selectedProvincePsgc}
                onProvinceChange={download.setSelectedProvincePsgc}
                selectedMunicityPsgc={download.selectedMunicityPsgc}
                onMunicityChange={download.setSelectedMunicityPsgc}
                selectedBarangayPsgc={download.selectedBarangayPsgc}
                onBarangayChange={download.setSelectedBarangayPsgc}
                regionFilterPsgc={download.regionFilterPsgc}
                onRegionFilterChange={download.setRegionFilterPsgc}
                provinceFilterPsgc={download.provinceFilterPsgc}
                onProvinceFilterChange={download.setProvinceFilterPsgc}
                exportKind={download.exportKind}
                onExportKindChange={download.setExportKind}
                onDownload={() => download.download({ regions, provinces, municities, municityMeta, country })}
                downloading={download.downloading}
                downloadError={download.error}
                activeOverlay={activeOverlay}
                onOverlayChange={setActiveOverlay}
                overlayView={overlayView}
                onOverlayViewChange={setOverlayView}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                isSidebarCollapsed={isSidebarCollapsed}
                isDesktopViewport={isDesktopViewport}
                onToggleCollapse={handleDrawerToggle}
                onExpand={handleDrawerExpand}
                onCollapse={handleDrawerCollapse}
                drawerHeightPx={mobileDrawerHeightPx}
                drawerMinHeightPx={mobileDrawerMinHeightPx}
                drawerMaxHeightPx={mobileDrawerMaxHeightPx}
                onDrawerHeightChange={handleDrawerHeightChange}
                onLevelChange={handleLevelChange}
                mapLoading={mapLoading}
                mapLoadingMessage={mapLoadingMessage}
                mapError={error ?? (barangaysQuery.error as Error | null)}
                activePsgc={activePsgc}
                onFeatureClick={handleFeatureClick}
                knownPsgcs={knownPsgcs}
                psgcLevels={psgcLevels}
                psgcLevelsByTier={psgcLevelsByTier}
            />
        </>
    );
}
