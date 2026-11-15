// Client-side router; code-splits map workspace and reference/legal routes.

import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

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

function App() {
    return (
        <BrowserRouter>
            <main className="h-dvh overflow-hidden bg-parchment text-primary">
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/directory" element={<Directory />} />
                        <Route path="/faq" element={<Faq />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/*" element={<MainPage />} />
                    </Routes>
                </Suspense>
            </main>
        </BrowserRouter>
    );
}

export default App;
