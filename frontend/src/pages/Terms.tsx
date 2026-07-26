import { Helmet } from "react-helmet-async";

export default function Terms() {
    return (
        <div className="h-full overflow-y-auto">
            <Helmet>
                <title>Terms of Service — Lens (MapaPH)</title>
                <meta
                    name="description"
                    content="Terms of Service for Lens (MapaPH). Details open-source licensing, acceptable use, and disclaimer of warranties."
                />
                <link rel="canonical" href="https://lens.mapaph.com/terms" />
            </Helmet>
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 lg:px-8 lg:py-12">
                <div className="mb-6 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em] text-muted">
                    <a href="/" className="text-muted transition-colors hover:text-primary">
                        Back to map
                    </a>
                    <a href="/" className="text-muted transition-colors hover:text-primary">
                        LEGAL
                    </a>
                </div>

                <header className="rounded-[1.75rem] border border-border-light bg-surface/70 p-6 shadow-soft lg:p-8">
                    <p className="text-xs text-muted">Last updated: July 15, 2026</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">Terms of Service</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted lg:text-base lg:leading-7">
                        By using Lens, you agree to these terms. The service is provided by open-source volunteers and community contributors.
                    </p>
                </header>

                <div className="mt-6 grid gap-4">
                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">The Service</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Lens is an interactive map and geospatial visualization utility designed to help users explore Philippine administrative divisions and download derived GeoJSON files. The service is provided "as is" and "as available" without any guarantees of accuracy, completeness, or uptime.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Not an Official Source</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Lens is a community-driven open-source project and is <strong>not affiliated with, endorsed by, or representing</strong> the Philippine Statistics Authority (PSA), the Commission on Elections (COMELEC), the Commission on Audit (COA), or any other Philippine government agency. All statistics and boundaries are for informational and visualization purposes only. Do not rely on Lens for critical legal, land-dispute, or official zoning decisions.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Data Accuracy and Corrections</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            The boundary shapes and statistics shown on the map are compiled from public datasets. They may contain mistakes, inaccuracies, outdated boundaries, or typing errors. 
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            If you spot errors, corrections and issues are welcome. Because Lens does not support user accounts or direct in-app editing, reports and data fixes must be submitted via our public GitHub repository at <a href="https://github.com/Shiiroi/mapa" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">https://github.com/Shiiroi/mapa</a>.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Licenses and Contributions</h2>
                        <ul className="mt-2 list-inside list-disc text-sm leading-6 text-muted">
                            <li>
                                <strong>Source Code:</strong> The web application code is licensed under the permissive MIT License.
                            </li>
                            <li>
                                <strong>Geospatial Data:</strong> Boundaries are derived from community and public sources. Any redistribution of the downloaded boundaries is subject to the licenses and attributions detailed in the project's source repository notices.
                            </li>
                            <li>
                                <strong>GitHub Contributions:</strong> By submitting data corrections, code, or pull requests via GitHub, you agree that your contributions will be licensed under the project's MIT License.
                            </li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Acceptable Use</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            You agree not to exploit or abuse the service's API endpoints, attempt to overload the servers (DDoS), scrape the site excessively in a way that exhausts server bandwidth, or interfere with other users' access to the platform.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">
                            Disclaimer of Warranties &amp; Limitation of Liability
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, THE MAINTAINERS AND CONTRIBUTORS ARE NOT LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES (INCLUDING DATA LOSS OR FINANCIAL LOSS) ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Indemnification</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            You agree to indemnify, defend, and hold harmless the volunteers, maintainers, and contributors of Lens from and against any claims, liabilities, damages, losses, and expenses (including legal fees) arising out of or in any way connected with your access to or use of the service.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Severability</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            If any provision of these Terms of Service is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision shall be modified to the minimum extent necessary, and the remaining provisions of these Terms shall remain in full force and effect.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Governing Law</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            These Terms of Service and your use of Lens are governed by the laws of the Republic of the Philippines.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Contact</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            If you have questions about these terms, please contact: <a href="mailto:vrsmagwili@gmail.com">vrsmagwili@gmail.com</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
