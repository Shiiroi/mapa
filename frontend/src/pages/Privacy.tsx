import { Helmet } from "react-helmet-async";

export default function Privacy() {
    return (
        <div className="h-full overflow-y-auto">
            <Helmet>
                <title>Privacy Policy &amp; Data Protection | Lens (MapaPH)</title>
                <meta
                    name="description"
                    content="Privacy Policy for Lens (MapaPH). Explains client-side map processing, browser caching, Google AdSense partner disclosures, and RA 10173 compliance."
                />
                <link rel="canonical" href="https://lens.mapaph.com/privacy" />
            </Helmet>
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 lg:px-8 lg:py-12">
                <div className="mb-6 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em] text-muted">
                    <a href="/" className="text-muted transition-colors hover:text-primary">
                        Back to map
                    </a>
                    <a href="https://www.mapaph.com/privacy" className="text-muted transition-colors hover:text-primary">
                        MAPAPH HUB POLICY
                    </a>
                </div>

                <header className="rounded-[1.75rem] border border-border-light bg-surface/70 p-6 shadow-soft lg:p-8">
                    <p className="text-xs text-muted">Last updated: November 2026</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">Privacy Policy</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted lg:text-base lg:leading-7">
                        Lens (<a href="https://lens.mapaph.com" className="underline">lens.mapaph.com</a>) is an open-source geospatial visualization utility in the mapaPH ecosystem. This policy explains what technical information is processed when you inspect maps, upload custom spreadsheets, or export GeoJSON boundaries.
                    </p>
                </header>

                <div className="mt-6 grid gap-4">
                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">1. Zero User Accounts &amp; Client-Side CSV Processing</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Lens does not operate user registration systems, login portals, or server-side file upload databases. Anyone can browse administrative boundaries and download IETF RFC 7946 GeoJSON datasets without providing personally identifiable information (PII). When you upload a custom CSV file to render a choropleth map, your spreadsheet is parsed and joined against Philippine Standard Geographic Code (PSGC) polygons entirely inside your browser's memory and is never transmitted to our servers.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">2. Information We Process &amp; Browser Storage</h2>
                        <ul className="mt-2 list-inside list-disc space-y-2 text-sm leading-6 text-muted">
                            <li>
                                <strong>Local Browser Storage (IndexedDB &amp; localStorage):</strong> To minimize redundant network transfers when switching between regional, provincial, municipal, and barangay tiers, Lens caches downloaded GeoJSON vector geometries in your browser's IndexedDB and stores interface state preferences in localStorage.
                            </li>
                            <li>
                                <strong>Aggregate Web Analytics:</strong> We use Vercel Web Analytics to record aggregate, non-identifying traffic metrics (such as page views, viewport dimensions, and referrer URLs) and Google Search Console to monitor search indexing health.
                            </li>
                            <li>
                                <strong>Optional Geolocation Centering:</strong> If you explicitly trigger browser location services, your device coordinates are used solely client-side to pan the map canvas and are never logged or transmitted to any backend server.
                            </li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">3. Google AdSense &amp; Third-Party Advertising Disclosures</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Across the <code>mapaph.com</code> domain and its subdomains, we partner with third-party advertising networks, including <strong>Google AdSense</strong>, to support our open-source hosting infrastructure. In accordance with Google Publisher Policies:
                        </p>
                        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-6 text-muted">
                            <li>
                                Third-party vendors, including Google, use cookies (such as the DoubleClick DART cookie, <code>__gads</code>, and <code>__gpi</code>) to serve ads based on a visitor's prior visits to <code>mapaph.com</code> or other sites on the Internet.
                            </li>
                            <li>
                                Users may opt out of personalized advertising by visiting{" "}
                                <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">
                                    Google Ads Settings
                                </a>{" "}
                                or{" "}
                                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">
                                    www.aboutads.info/choices/
                                </a>.
                            </li>
                            <li>
                                For complete details on how Google processes data on partner websites, consult{" "}
                                <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">
                                    How Google uses information from sites or apps that use our services
                                </a>.
                            </li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">4. Edge Infrastructure &amp; Public-Domain Datasets</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Pre-compiled administrative boundary vectors and public statistical tables (sourced from the Philippine Statistics Authority, Commission on Audit, and Commission on Elections under Executive Order No. 2, s. 2016 and Republic Act No. 8293 Section 176) are delivered via Cloudflare R2 edge storage, Supabase read-only endpoints, and Vercel's global CDN. Standard edge server logs are rotated automatically for network security and DDoS mitigation.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">5. Philippine Data Privacy Act (RA 10173) Rights &amp; Contact</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            We align our data protection practices with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>. All census, GDP, electoral, and municipal financial metrics displayed in Lens consist exclusively of aggregated public-domain government statistics exempt under Section 4(e) of RA 10173. For privacy inquiries, data correction reports, or questions regarding our central hub policy (<a href="https://www.mapaph.com/privacy" className="text-accent underline hover:text-accent-dark">www.mapaph.com/privacy</a>), contact us at{" "}
                            <a href="mailto:mapaph.1030@gmail.com" className="text-accent underline hover:text-accent-dark">
                                mapaph.1030@gmail.com
                            </a>{" "}
                            or via our public repository at{" "}
                            <a href="https://github.com/Shiiroi/mapa" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">
                                github.com/Shiiroi/mapa
                            </a>.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
