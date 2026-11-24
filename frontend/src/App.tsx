// Client-side router; code-splits map workspace and reference/legal routes.

import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { normalizeRoutePath } from "./lib/initialPlaceSeed";

const Directory = lazy(() => import("./pages/Directory"));
const Faq = lazy(() => import("./pages/Faq"));
const MainPage = lazy(() => import("./pages/MainPage"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

function RouteFallback() {
    return (
        <div className="flex h-full items-center justify-center bg-surface px-4 text-xs font-mono uppercase tracking-wider text-muted">
            Loading Lens…
        </div>
    );
}

function LayoutShell() {
    const location = useLocation();
    const dossierEl = typeof document !== "undefined" ? document.getElementById("lens-place-dossier") : null;
    const dossierRoute = dossierEl?.getAttribute("data-route-path") || "";
    const hasMatchingDossier = Boolean(
        dossierEl && dossierRoute && normalizeRoutePath(dossierRoute) === normalizeRoutePath(location.pathname),
    );

    useEffect(() => {
        if (dossierEl) {
            dossierEl.hidden = !hasMatchingDossier;
        }
    }, [dossierEl, hasMatchingDossier]);

    return (
        <main
            className={
                hasMatchingDossier
                    ? "flex h-[88dvh] min-h-[540px] flex-col overflow-hidden border-b border-border bg-parchment text-primary"
                    : "h-dvh overflow-hidden bg-parchment text-primary"
            }
        >
            <div className={hasMatchingDossier ? "min-h-0 flex-1 overflow-hidden" : "h-full"}>
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/directory" element={<Directory />} />
                        <Route path="/faq" element={<Faq />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/*" element={<MainPage />} />
                    </Routes>
                </Suspense>
            </div>
            {hasMatchingDossier && (
                <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-surface px-4 text-[11px] font-medium text-muted">
                    <a
                        href="#lens-place-dossier"
                        className="font-semibold text-accent hover:text-accent-dark hover:underline"
                    >
                        &darr; Full Place Profile, PHLPost ZIP Code, Barangays &amp; GeoJSON Specs Below
                    </a>
                    <span className="hidden font-mono text-[10px] uppercase tracking-wider sm:inline">
                        PSA 2024 · COA AFR · PHLPost · RFC 7946
                    </span>
                </div>
            )}
        </main>
    );
}

function App() {
    return (
        <BrowserRouter>
            <LayoutShell />
        </BrowserRouter>
    );
}

export default App;
