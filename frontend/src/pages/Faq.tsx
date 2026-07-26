import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const faqs = [
    {
        question: "How do I download a GeoJSON file for a Philippine province or barangay?",
        answer: "Pick an administrative level on the map (region down to barangay), select a place, and export it in standards-compliant RFC 7946 / WGS 84 format from the Download tab.",
    },
    {
        question: "Where can I find Philippines population and GDP data by city or municipality?",
        answer: "Lens overlays official PSA population, GDP, and LGU total asset data directly on the map at every administrative level, viewable per place or side-by-side.",
    },
    {
        question: "Can I visualize my own data on a map of the Philippines?",
        answer: "Yes — upload a CSV keyed by standard PSGC code and Lens will render it as a custom choropleth map alongside the built-in datasets.",
    },
    {
        question: "What administrative levels are available for GeoJSON export in Lens?",
        answer: "Lens supports boundary downloads for 17 Regions, 82 Provinces, 1,600+ Cities and Municipalities, and 42,000+ Barangays across the Philippines, all aligned to PSGC standards.",
    },
    {
        question: "Is Lens affiliated with the Philippine Statistics Authority (PSA)?",
        answer: "No. Lens is an independent, open-source project. While it visualizes public data published by the PSA and government agencies, it is not affiliated with or endorsed by any government entity.",
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

export default function Faq() {
    return (
        <div className="h-full overflow-y-auto">
            <Helmet>
                <title>Frequently Asked Questions — Lens (MapaPH)</title>
                <meta
                    name="description"
                    content="Find answers to common questions about downloading Philippine GeoJSON boundaries, PSGC alignment, custom CSV data overlay, and census datasets in Lens."
                />
                <link rel="canonical" href="https://lens.mapaph.com/faq" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://lens.mapaph.com/faq" />
                <meta property="og:title" content="Frequently Asked Questions — Lens (MapaPH)" />
                <meta
                    property="og:description"
                    content="Find answers to common questions about downloading Philippine GeoJSON boundaries, PSGC alignment, custom CSV data overlay, and census datasets in Lens."
                />
                <meta property="og:image" content="https://lens.mapaph.com/og-image.png" />
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:url" content="https://lens.mapaph.com/faq" />
                <meta property="twitter:title" content="Frequently Asked Questions — Lens (MapaPH)" />
                <meta
                    property="twitter:description"
                    content="Find answers to common questions about downloading Philippine GeoJSON boundaries, PSGC alignment, custom CSV data overlay, and census datasets in Lens."
                />
                <meta property="twitter:image" content="https://lens.mapaph.com/og-image.png" />
                <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
            </Helmet>

            <noscript>
                <h1>Frequently Asked Questions — Lens (MapaPH)</h1>
                <dl>
                    {faqs.map((faq) => (
                        <div key={faq.question}>
                            <dt>{faq.question}</dt>
                            <dd>{faq.answer}</dd>
                        </div>
                    ))}
                </dl>
            </noscript>

            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 lg:px-8 lg:py-12">
                <div className="mb-6 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em] text-muted">
                    <Link to="/" className="text-muted transition-colors hover:text-primary">
                        Back to map
                    </Link>
                    <span className="text-muted">HELP &amp; DOCS</span>
                </div>

                <header className="rounded-[1.75rem] border border-border-light bg-surface/70 p-6 shadow-soft lg:p-8">
                    <h1 className="text-3xl font-semibold tracking-tight text-primary lg:text-4xl">Frequently Asked Questions</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted lg:text-base lg:leading-7">
                        Learn how to navigate Lens, visualize custom CSV data, and export standards-compliant Philippine GeoJSON boundaries.
                    </p>
                </header>

                <div className="mt-6 grid gap-4">
                    {faqs.map((faq) => (
                        <section key={faq.question} className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                            <h2 className="text-base font-semibold tracking-tight text-primary lg:text-lg">{faq.question}</h2>
                            <p className="mt-2 text-sm leading-6 text-muted lg:text-base">{faq.answer}</p>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
