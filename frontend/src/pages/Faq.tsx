import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { PageIndex, PageSection, PageShell } from "../components/PageShell";

const faqs = [
    {
        question: "How do I download a GeoJSON boundary file for a Philippine region, province, city, or barangay?",
        answer: "Select your target administrative level in the Lens sidebar (Country, Region, Province, Municipality/City, or Barangay), filter or click the target jurisdiction on the map canvas, and export the vector layer from the Download tab. Every exported file conforms to the IETF RFC 7946 GeoJSON specification using World Geodetic System 1984 (WGS 84 / EPSG:4326) decimal degree coordinates and right-hand polygon winding rules.",
    },
    {
        question: "How are administrative divisions keyed and aligned with the Philippine Standard Geographic Code (PSGC)?",
        answer: "Every polygon feature and statistical record in Lens is indexed by its official 10-digit Philippine Standard Geographic Code (PSGC) published by the Philippine Statistics Authority (PSA). Our boundary registry incorporates recent statutory reorganizations, including the 18-region structure with the Negros Island Region (NIR / RA 12000), the 82-province baseline including Maguindanao del Norte and Maguindanao del Sur, and the jurisdictional transfer of the 10 EMBO barangays from Makati City to Taguig City.",
    },
    {
        question: "Where do the population, land area, GDP, and LGU financial asset figures come from?",
        answer: "Demographic counts originate from the 2024 Census of Population (POPCEN) proclaimed by the Philippine Statistics Authority (PSA). Regional Gross Domestic Product (GDP) series are compiled from PSA Provincial Product Accounts and Regional Accounts releases. Local Government Unit (LGU) asset, liability, and equity metrics are extracted from the Annual Financial Reports (AFR) published by the Commission on Audit (COA), while historical presidential election tallies originate from public Commission on Elections (COMELEC) returns.",
    },
    {
        question: "Why can PSA official land area figures differ slightly from GIS-computed polygon areas?",
        answer: "Official land area figures published by the PSA and the Land Management Bureau (DENR-LMB) reflect statutory charter descriptions and historical cadastral proclamations, some of which remain subject to inter-LGU boundary disputes. When Lens or desktop GIS tools compute surface area directly from vector geometry, they evaluate geodesic spherical excess on the WGS 84 ellipsoid. Both metrics are documented clearly so researchers can distinguish statutory land area from geometric polygon area.",
    },
    {
        question: "How can I upload and visualize my own CSV dataset on the Philippine map?",
        answer: "Open the Custom Data tab in the sidebar and select any UTF-8 CSV spreadsheet from your device. Your CSV should include one column containing either standard 9-digit/10-digit PSGC codes or administrative division names, alongside one or more numeric metric columns. Lens matches your rows against the active boundary tier entirely inside your browser's memory and renders sequential or bivariate choropleth color scales without uploading your spreadsheet to any external server.",
    },
    {
        question: "What geometric simplification tolerance is applied to the web boundary vectors?",
        answer: "To render all 1,642 cities and municipalities or 42,011 barangays smoothly at 60 frames per second on mobile and desktop browsers, web display layers use topology-preserving simplification (~0.0001 decimal degrees, or roughly 11 meters at the equator). These boundaries are engineered for thematic choropleth cartography, statistical aggregation, and spatial planning, and are not a substitute for parcel-level cadastral relocation surveys conducted by a licensed Geodetic Engineer under Republic Act No. 8560.",
    },
    {
        question: "Can I use Lens GeoJSON files and source code in academic theses or commercial applications?",
        answer: "Yes. The Lens web application source code is licensed under the permissive MIT License, and underlying Philippine government census and administrative datasets are in the public domain pursuant to Republic Act No. 8293 (Intellectual Property Code of the Philippines), Section 176. Standard attribution to Lens (mapaPH) and the originating government agency (PSA, NAMRIA, COA, or COMELEC) is recommended for academic citations.",
    },
    {
        question: "Is Lens affiliated with the Philippine Statistics Authority (PSA) or NAMRIA?",
        answer: "No. Lens and the broader mapaPH hub are independent, community-maintained open-source civic technology projects. While our tools standardize and visualize public government releases under the Freedom of Information framework (Executive Order No. 2, s. 2016), we are not affiliated with, endorsed by, or representative of the PSA, NAMRIA, COMELEC, COA, or any Philippine government agency.",
    },
];

const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer,
        },
    })),
};

const INDEXED_FAQS = faqs.map((faq, idx) => ({
    ...faq,
    id: `faq-${String(idx + 1).padStart(2, "0")}`,
    index: `Q${String(idx + 1).padStart(2, "0")}`,
}));

export default function Faq() {
    const [query, setQuery] = useState("");

    const filteredFaqs = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return INDEXED_FAQS;
        return INDEXED_FAQS.filter(
            (faq) =>
                faq.question.toLowerCase().includes(normalized) ||
                faq.answer.toLowerCase().includes(normalized),
        );
    }, [query]);

    const tocItems = useMemo(
        () =>
            filteredFaqs.map((faq) => ({
                id: faq.id,
                index: faq.index,
                label: faq.question,
            })),
        [filteredFaqs],
    );

    return (
        <>
            <Helmet>
                <title>Frequently Asked Questions &amp; Technical Methodology | Lens (MapaPH)</title>
                <meta
                    name="description"
                    content="Find answers to common questions about downloading Philippine GeoJSON boundaries, 10-digit PSGC alignment, custom CSV data overlay, and PSA census datasets in Lens."
                />
                <link rel="canonical" href="https://lens.mapaph.com/faq" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://lens.mapaph.com/faq" />
                <meta property="og:title" content="Frequently Asked Questions & Technical Methodology | Lens (MapaPH)" />
                <meta
                    property="og:description"
                    content="Find answers to common questions about downloading Philippine GeoJSON boundaries, 10-digit PSGC alignment, custom CSV data overlay, and PSA census datasets in Lens."
                />
                <meta property="og:image" content="https://lens.mapaph.com/og-image.png" />
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:url" content="https://lens.mapaph.com/faq" />
                <meta property="twitter:title" content="Frequently Asked Questions & Technical Methodology | Lens (MapaPH)" />
                <meta
                    property="twitter:description"
                    content="Find answers to common questions about downloading Philippine GeoJSON boundaries, 10-digit PSGC alignment, custom CSV data overlay, and PSA census datasets in Lens."
                />
                <meta property="twitter:image" content="https://lens.mapaph.com/og-image.png" />
                <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
            </Helmet>

            <PageShell
                breadcrumb="FAQ"
                eyebrow="Technical Methodology"
                meta="RFC 7946 · PSGC 10-Digit · POPCEN 2024"
                title="Frequently Asked Questions & Cartographic Methodology"
                description="Technical reference covering Philippine GeoJSON boundary exports (RFC 7946 / EPSG:4326), 10-digit PSGC hierarchy rules, PSA census and COA financial overlays, and client-side CSV choropleth mapping."
                headerLink={{
                    href: "https://www.mapaph.com/docs/lens",
                    label: "Full Lens Documentation",
                }}
            >
                <PageIndex
                    title="Question Directory"
                    items={tocItems}
                    headerSlot={
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-muted">
                                {filteredFaqs.length} / {INDEXED_FAQS.length} topics
                            </span>
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery("")}
                                    className="cursor-pointer font-mono text-[11px] font-bold uppercase text-accent hover:text-accent-dark"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    }
                    toolbarSlot={
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter questions (e.g. GeoJSON, PSGC, CSV, COA, PSA)..."
                            aria-label="Filter frequently asked questions"
                            className="w-full border border-border bg-white px-3 py-2 text-xs text-primary placeholder:text-muted outline-none transition-colors focus:border-accent rounded-none"
                        />
                    }
                />

                {filteredFaqs.length > 0 ? (
                    <div className="grid gap-4">
                        {filteredFaqs.map((faq) => (
                            <PageSection key={faq.question} id={faq.id} index={faq.index} title={faq.question}>
                                <p>{faq.answer}</p>
                            </PageSection>
                        ))}
                    </div>
                ) : (
                    <div className="border border-border bg-white p-6 text-center rounded-none">
                        <p className="text-sm text-muted">
                            No FAQ entries match <span className="font-mono font-semibold text-primary">"{query}"</span>.
                        </p>
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="mt-3 cursor-pointer border border-border bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-white rounded-none"
                        >
                            Reset Filter
                        </button>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 border border-border border-l-4 border-l-accent bg-white p-5 rounded-none">
                    <div className="space-y-1">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                            Explore Philippine Boundaries &amp; Datasets
                        </h2>
                        <p className="text-xs leading-5 text-muted">
                            Inspect region, province, city/municipality, and barangay vectors directly in Lens or consult the full developer guide.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to="/"
                            className="bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-accent-dark rounded-none"
                        >
                            Open Interactive Map &rarr;
                        </Link>
                        <a
                            href="https://www.mapaph.com/docs/lens"
                            className="border border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-white rounded-none"
                        >
                            Documentation &rarr;
                        </a>
                    </div>
                </div>
            </PageShell>
        </>
    );
}
