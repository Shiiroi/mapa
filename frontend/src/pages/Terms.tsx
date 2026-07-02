export default function Terms() {
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
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary lg:text-4xl">Terms of Service</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted lg:text-base lg:leading-7">
                        By using Mapa you agree to these terms. The service is provided by volunteers and contributors.
                    </p>
                </header>

                <div className="mt-6 grid gap-4">
                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">The service</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Mapa helps users explore administrative boundaries, download datasets, and view basic charts derived from public sources.
                            The service is provided "as is" without guaranteed uptime, accuracy, or completeness.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Not official</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Mapa is a community project and is not affiliated with or endorsed by government agencies. Do not rely on Mapa as your
                            only source for official decisions.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Data accuracy</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Datasets are crowd-maintained and imported from public sources. They may be wrong, stale, or incomplete. Always verify
                            critical information with official publications.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Contributing and editing</h2>
                        <ul className="mt-2 list-inside list-disc text-sm leading-6 text-muted">
                            <li>
                                <strong>In-app contributions:</strong> Use contributor tools to suggest edits. Do not submit malicious or false data.
                            </li>
                            <li>
                                <strong>Review:</strong> Volunteer editors may approve, reject, or request changes to proposals.
                            </li>
                            <li>
                                <strong>Editor accounts:</strong> Accounts are issued at maintainer discretion and may be deactivated for misuse.
                            </li>
                            <li>
                                <strong>License:</strong> By submitting content you grant Mapa a license to display and distribute approved edits as
                                part of the project.
                            </li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Acceptable use</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            You agree not to attempt to break, scrape, or overload the service; bypass authentication; tamper with other users' edits;
                            or upload illegal or harassing content.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">
                            Disclaimer of warranties &amp; limitation of liability
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. To the fullest extent permitted by law, contributors and
                            maintainers are not liable for indirect, incidental, or consequential damages arising from your use of Mapa.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-border-light bg-white/85 p-5 shadow-soft lg:p-6">
                        <h2 className="text-sm font-semibold tracking-tight text-primary lg:text-base">Changes</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            We may modify these terms or discontinue features. Continued use after changes are posted constitutes acceptance of the
                            updated terms.
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
