export default function Privacy() {
    return (
        <div className="h-full overflow-y-auto">
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
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">Privacy Policy</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted lg:text-base lg:leading-7">
                        Lens is an open-source, volunteer-maintained geospatial visualization tool. This policy explains what information is processed when you use our map.
                    </p>
                </header>

                <div className="mt-6 grid gap-4">
                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">No User Accounts</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Lens does not have user registration, logins, or accounts. Anyone can browse the map and download GeoJSON datasets freely without providing any personal information. We do not store hashed passwords, usernames, or user profiles.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Information We Process</h2>

                        <h3 className="mt-3 text-sm font-semibold">Browsing the Map</h3>
                        <ul className="mt-2 list-inside list-disc text-sm leading-6 text-muted">
                            <li>
                                <strong>Usage Analytics:</strong> We use lightweight web analytics (such as Vercel Analytics) to collect basic traffic statistics (page views, referrer URLs, and aggregate device types). This tracking does not collect, link, or associate any personally identifiable information (PII).
                            </li>
                            <li>
                                <strong>Local Browser Storage:</strong> To speed up loading times and improve performance, the app caches geographic boundary data inside your browser (IndexedDB and localStorage) and saves minor interface preferences (like your selected map levels).
                            </li>
                            <li>
                                <strong>Location Services (Optional):</strong> If you explicitly grant permission to access your browser's location services, Lens uses your coordinates locally on your device to center the map and display your position. Your coordinates are processed entirely client-side and are <strong>never</strong> transmitted to or stored on our servers.
                            </li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Data Storage and Hosting</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Our geographic boundaries and metadata are hosted on Supabase and served directly to your browser. Standard web server logs are retained by our hosting provider (Vercel) to protect against malicious behavior and ensure service reliability.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">What We Do Not Do</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            We do not collect names, email addresses, or phone numbers. We do not sell or monetize personal information. We do not run third-party advertising tracking scripts or behavioral profiling systems.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Data Corrections & Feedback</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Because Lens has no user accounts or database write access in the client app, you cannot submit data changes or report errors directly within the website. If you spot a boundary issue, incorrect label, or outdated census statistic, you can submit reports and coordinate corrections via our public GitHub repository: <a href="https://github.com/Shiiroi/mapa" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">https://github.com/Shiiroi/mapa</a>.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Governing Law</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            This Privacy Policy and your use of Lens are governed by the laws of the Republic of the Philippines.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Contact</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            If you have questions about this policy, please reach out to: <a href="mailto:vrsmagwili@gmail.com">vrsmagwili@gmail.com</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
