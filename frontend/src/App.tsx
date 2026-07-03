// Client-side router; serves the main page and compliance placeholders.

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainPage from "./pages/MainPage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

function App() {
    return (
        <BrowserRouter>
            <main className="h-dvh overflow-hidden bg-parchment text-primary">
                <Routes>
                    <Route path="/" element={<MainPage />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/:region" element={<MainPage />} />
                    <Route path="/:region/:province" element={<MainPage />} />
                    <Route path="/:region/:province/:municipality" element={<MainPage />} />
                    <Route path="/:region/:province/:municipality/:barangay" element={<MainPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
