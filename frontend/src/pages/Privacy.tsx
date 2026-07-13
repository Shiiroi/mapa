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
                    <p className="text-xs text-muted">Last updated: June 29, 2026</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">Privacy Policy</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted lg:text-base lg:leading-7">
                        Lens is a volunteer-maintained geospatial visualization project. This policy explains what we collect and why.
                    </p>
                </header>

                <div className="mt-6 grid gap-4">
                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">What Lens is</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Lens provides administrative boundary visualizations, simple charts, and data downloads derived from public sources. It is
                            not an official government service; data are community-maintained and may be incomplete or out of date.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Information we process</h2>

                        <h3 className="mt-3 text-sm font-semibold">Browsing the map (no account)</h3>
                        <ul className="mt-2 list-inside list-disc text-sm leading-6 text-muted">
                            <li>
                                <strong>Usage analytics:</strong> We collect lightweight analytics (page views, referrers) to understand traffic. We
                                do not intentionally collect names or identifiers through analytics.
                            </li>
                            <li>
                                <strong>Device storage:</strong> The app caches geo and derived data in the browser (IndexedDB/localStorage) and
                                stores preferences such as recent downloads or UI settings.
                            </li>
                            <li>
                                <strong>Location (optional):</strong> If you grant location permission, coordinates are used locally to show your
                                position. We do not persist live GPS tracks on our servers.
                            </li>
                        </ul>

                        <h3 className="mt-3 text-sm font-semibold">Contributors and editors (signed in)</h3>
                        <ul className="mt-2 list-inside list-disc text-sm leading-6 text-muted">
                            <li>
                                <strong>Account identifiers:</strong> For contributor accounts we store a username, hashed password, role, and
                                optional display name.
                            </li>
                            <li>
                                <strong>Edit history:</strong> Suggestions and approved edits record who submitted or approved them for audit
                                purposes.
                            </li>
                            <li>
                                <strong>Session cookies:</strong> Signed-in sessions use httpOnly cookies scoped to this site.
                            </li>
                        </ul>

                        <h3 className="mt-3 text-sm font-semibold">Server and hosting</h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Public data and uploads are stored in our Postgres database (Supabase) and object storage when configured. Hosting logs
                            are retained by our hosting provider. These third parties have their own privacy policies.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">What we do not do</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            We do not sell personal information. We do not run third‑party ad networks that sell profiling data.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Your choices</h2>
                        <ul className="mt-2 list-inside list-disc text-sm leading-6 text-muted">
                            <li>Clear site data in your browser to remove local caches.</li>
                            <li>Sign out of contributor sessions on shared devices.</li>
                            <li>Contact a maintainer to deactivate an account you no longer need.</li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Changes</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            We may update this policy as the project evolves. Material changes will be reflected on this page with an updated date.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Contact: <a href="mailto:vrsmagwili@gmail.com">vrsmagwili@gmail.com</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
