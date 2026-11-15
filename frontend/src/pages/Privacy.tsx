import { Helmet } from "react-helmet-async";
import {
    INLINE_CODE_CLASS,
    INLINE_LINK_CLASS,
    PageIndex,
    PageSection,
    PageShell,
} from "../components/PageShell";

const PRIVACY_TOC = [
    { id: "zero-accounts", index: "01", label: "Zero User Accounts & Client-Side CSV Processing" },
    { id: "browser-storage", index: "02", label: "Information We Process & Browser Storage" },
    { id: "adsense", index: "03", label: "Google AdSense & Third-Party Advertising Disclosures" },
    { id: "edge-infrastructure", index: "04", label: "Edge Infrastructure & Public-Domain Datasets" },
    { id: "ra-10173", index: "05", label: "Philippine Data Privacy Act (RA 10173) Rights & Contact" },
];

export default function Privacy() {
    return (
        <>
            <Helmet>
                <title>Privacy Policy &amp; Data Protection | Lens (MapaPH)</title>
                <meta
                    name="description"
                    content="Privacy Policy for Lens (MapaPH). Explains client-side map processing, browser caching, Google AdSense partner disclosures, and RA 10173 compliance."
                />
                <link rel="canonical" href="https://lens.mapaph.com/privacy" />
            </Helmet>

            <PageShell
                breadcrumb="Privacy Policy"
                eyebrow="Privacy & Data Protection"
                meta="Last updated: November 2026"
                title="Privacy Policy"
                description={
                    <>
                        Lens (
                        <a href="https://lens.mapaph.com" className={INLINE_LINK_CLASS}>
                            lens.mapaph.com
                        </a>
                        ) is an open-source geospatial visualization utility in the mapaPH ecosystem. This policy
                        explains what technical information is processed when you inspect maps, upload custom
                        spreadsheets, or export GeoJSON boundaries.
                    </>
                }
                headerLink={{
                    href: "https://www.mapaph.com/privacy",
                    label: "mapaPH Hub Policy",
                }}
            >
                <PageIndex title="Policy Sections" items={PRIVACY_TOC} />

                <div className="grid gap-4">
                    <PageSection id="zero-accounts" index="01" title="1. Zero User Accounts & Client-Side CSV Processing">
                        <p>
                            Lens does not operate user registration systems, login portals, or server-side file upload databases. Anyone can browse administrative boundaries and download IETF RFC 7946 GeoJSON datasets without providing personally identifiable information (PII). When you upload a custom CSV file to render a choropleth map, your spreadsheet is parsed and joined against Philippine Standard Geographic Code (PSGC) polygons entirely inside your browser's memory and is never transmitted to our servers.
                        </p>
                    </PageSection>

                    <PageSection id="browser-storage" index="02" title="2. Information We Process & Browser Storage">
                        <ul className="list-disc space-y-2 pl-5 marker:text-accent">
                            <li>
                                <strong className="text-primary">Local Browser Storage (IndexedDB &amp; localStorage):</strong> To minimize redundant network transfers when switching between regional, provincial, municipal, and barangay tiers, Lens caches downloaded GeoJSON vector geometries in your browser's IndexedDB and stores interface state preferences in localStorage.
                            </li>
                            <li>
                                <strong className="text-primary">Aggregate Web Analytics:</strong> We use Vercel Web Analytics to record aggregate, non-identifying traffic metrics (such as page views, viewport dimensions, and referrer URLs) and Google Search Console to monitor search indexing health.
                            </li>
                            <li>
                                <strong className="text-primary">Optional Geolocation Centering:</strong> If you explicitly trigger browser location services, your device coordinates are used solely client-side to pan the map canvas and are never logged or transmitted to any backend server.
                            </li>
                        </ul>
                    </PageSection>

                    <PageSection id="adsense" index="03" title="3. Google AdSense & Third-Party Advertising Disclosures">
                        <p>
                            Across the <code className={INLINE_CODE_CLASS}>mapaph.com</code> domain and its subdomains, we partner with third-party advertising networks, including <strong className="text-primary">Google AdSense</strong>, to support our open-source hosting infrastructure. In accordance with Google Publisher Policies:
                        </p>
                        <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-accent">
                            <li>
                                Third-party vendors, including Google, use cookies (such as the DoubleClick DART cookie, <code className={INLINE_CODE_CLASS}>__gads</code>, and <code className={INLINE_CODE_CLASS}>__gpi</code>) to serve ads based on a visitor's prior visits to <code className={INLINE_CODE_CLASS}>mapaph.com</code> or other sites on the Internet.
                            </li>
                            <li>
                                Users may opt out of personalized advertising by visiting{" "}
                                <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className={INLINE_LINK_CLASS}>
                                    Google Ads Settings
                                </a>{" "}
                                or{" "}
                                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className={INLINE_LINK_CLASS}>
                                    www.aboutads.info/choices/
                                </a>.
                            </li>
                            <li>
                                For complete details on how Google processes data on partner websites, consult{" "}
                                <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className={INLINE_LINK_CLASS}>
                                    How Google uses information from sites or apps that use our services
                                </a>.
                            </li>
                        </ul>
                    </PageSection>

                    <PageSection id="edge-infrastructure" index="04" title="4. Edge Infrastructure & Public-Domain Datasets">
                        <p>
                            Pre-compiled administrative boundary vectors and public statistical tables (sourced from the Philippine Statistics Authority, Commission on Audit, and Commission on Elections under Executive Order No. 2, s. 2016 and Republic Act No. 8293 Section 176) are delivered via Cloudflare R2 edge storage, Supabase read-only endpoints, and Vercel's global CDN. Standard edge server logs are rotated automatically for network security and DDoS mitigation.
                        </p>
                    </PageSection>

                    <PageSection id="ra-10173" index="05" title="5. Philippine Data Privacy Act (RA 10173) Rights & Contact">
                        <p>
                            We align our data protection practices with the <strong className="text-primary">Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>. All census, GDP, electoral, and municipal financial metrics displayed in Lens consist exclusively of aggregated public-domain government statistics exempt under Section 4(e) of RA 10173. For privacy inquiries, data correction reports, or questions regarding our central hub policy (
                            <a href="https://www.mapaph.com/privacy" className={INLINE_LINK_CLASS}>
                                www.mapaph.com/privacy
                            </a>
                            ), contact us at{" "}
                            <a href="mailto:mapaph.1030@gmail.com" className={INLINE_LINK_CLASS}>
                                mapaph.1030@gmail.com
                            </a>{" "}
                            or via our public repository at{" "}
                            <a href="https://github.com/Shiiroi/mapa" target="_blank" rel="noopener noreferrer" className={INLINE_LINK_CLASS}>
                                github.com/Shiiroi/mapa
                            </a>.
                        </p>
                    </PageSection>
                </div>
            </PageShell>
        </>
    );
}
