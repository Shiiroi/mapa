import { Helmet } from "react-helmet-async";
import { INLINE_LINK_CLASS, PageIndex, PageSection, PageShell } from "../components/PageShell";

const TERMS_TOC = [
    { id: "service", index: "01", label: "The Service" },
    { id: "not-official", index: "02", label: "Not an Official Source" },
    { id: "data-accuracy", index: "03", label: "Data Accuracy and Corrections" },
    { id: "licenses", index: "04", label: "Licenses and Contributions" },
    { id: "acceptable-use", index: "05", label: "Acceptable Use" },
    { id: "disclaimer", index: "06", label: "Disclaimer of Warranties & Limitation of Liability" },
    { id: "indemnification", index: "07", label: "Indemnification" },
    { id: "severability", index: "08", label: "Severability" },
    { id: "governing-law", index: "09", label: "Governing Law" },
    { id: "contact", index: "10", label: "Contact" },
];

export default function Terms() {
    return (
        <>
            <Helmet>
                <title>Terms of Service — Lens (MapaPH)</title>
                <meta
                    name="description"
                    content="Terms of Service for Lens (MapaPH). Details open-source licensing, acceptable use, and disclaimer of warranties."
                />
                <link rel="canonical" href="https://lens.mapaph.com/terms" />
            </Helmet>

            <PageShell
                breadcrumb="Terms of Service"
                eyebrow="Legal & Open Data Licensing"
                meta="Last updated: July 15, 2026"
                title="Terms of Service"
                description="By using Lens, you agree to these terms. The service is provided by open-source volunteers and community contributors."
            >
                <PageIndex title="Terms Index" items={TERMS_TOC} />

                <div className="grid gap-4">
                    <PageSection id="service" index="01" title="The Service">
                        <p>
                            Lens is an interactive map and geospatial visualization utility designed to help users explore Philippine administrative divisions and download derived GeoJSON files. The service is provided "as is" and "as available" without any guarantees of accuracy, completeness, or uptime.
                        </p>
                    </PageSection>

                    <PageSection id="not-official" index="02" title="Not an Official Source">
                        <p>
                            Lens is a community-driven open-source project and is <strong className="text-primary">not affiliated with, endorsed by, or representing</strong> the Philippine Statistics Authority (PSA), the Commission on Elections (COMELEC), the Commission on Audit (COA), or any other Philippine government agency. All statistics and boundaries are for informational and visualization purposes only. Do not rely on Lens for critical legal, land-dispute, or official zoning decisions.
                        </p>
                    </PageSection>

                    <PageSection id="data-accuracy" index="03" title="Data Accuracy and Corrections">
                        <p>
                            The boundary shapes and statistics shown on the map are compiled from public datasets. They may contain mistakes, inaccuracies, outdated boundaries, or typing errors.
                        </p>
                        <p className="mt-3">
                            If you spot errors, corrections and issues are welcome. Because Lens does not support user accounts or direct in-app editing, reports and data fixes must be submitted via our public GitHub repository at{" "}
                            <a href="https://github.com/Shiiroi/mapa" target="_blank" rel="noopener noreferrer" className={INLINE_LINK_CLASS}>
                                https://github.com/Shiiroi/mapa
                            </a>.
                        </p>
                    </PageSection>

                    <PageSection id="licenses" index="04" title="Licenses and Contributions">
                        <ul className="list-disc space-y-2 pl-5 marker:text-accent">
                            <li>
                                <strong className="text-primary">Source Code:</strong> The web application code is licensed under the permissive MIT License.
                            </li>
                            <li>
                                <strong className="text-primary">Geospatial Data:</strong> Boundaries are derived from community and public sources. Any redistribution of the downloaded boundaries is subject to the licenses and attributions detailed in the project's source repository notices.
                            </li>
                            <li>
                                <strong className="text-primary">GitHub Contributions:</strong> By submitting data corrections, code, or pull requests via GitHub, you agree that your contributions will be licensed under the project's MIT License.
                            </li>
                        </ul>
                    </PageSection>

                    <PageSection id="acceptable-use" index="05" title="Acceptable Use">
                        <p>
                            You agree not to exploit or abuse the service's API endpoints, attempt to overload the servers (DDoS), scrape the site excessively in a way that exhausts server bandwidth, or interfere with other users' access to the platform.
                        </p>
                    </PageSection>

                    <PageSection
                        id="disclaimer"
                        index="06"
                        title="Disclaimer of Warranties & Limitation of Liability"
                    >
                        <p>
                            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, THE MAINTAINERS AND CONTRIBUTORS ARE NOT LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES (INCLUDING DATA LOSS OR FINANCIAL LOSS) ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM.
                        </p>
                    </PageSection>

                    <PageSection id="indemnification" index="07" title="Indemnification">
                        <p>
                            You agree to indemnify, defend, and hold harmless the volunteers, maintainers, and contributors of Lens from and against any claims, liabilities, damages, losses, and expenses (including legal fees) arising out of or in any way connected with your access to or use of the service.
                        </p>
                    </PageSection>

                    <PageSection id="severability" index="08" title="Severability">
                        <p>
                            If any provision of these Terms of Service is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision shall be modified to the minimum extent necessary, and the remaining provisions of these Terms shall remain in full force and effect.
                        </p>
                    </PageSection>

                    <PageSection id="governing-law" index="09" title="Governing Law">
                        <p>
                            These Terms of Service and your use of Lens are governed by the laws of the Republic of the Philippines.
                        </p>
                    </PageSection>

                    <PageSection id="contact" index="10" title="Contact">
                        <p>
                            If you have questions about these terms, please contact:{" "}
                            <a href="mailto:mapaph.1030@gmail.com" className={INLINE_LINK_CLASS}>
                                mapaph.1030@gmail.com
                            </a>
                        </p>
                    </PageSection>
                </div>
            </PageShell>
        </>
    );
}
