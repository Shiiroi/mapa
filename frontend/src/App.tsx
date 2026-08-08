// Client-side router; serves the main page and compliance placeholders.

import { BrowserRouter, Route, Routes } from "react-router-dom";
import Faq from "./pages/Faq";
import MainPage from "./pages/MainPage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

function App() {
    return (
        <BrowserRouter>
            <main className="h-dvh overflow-hidden bg-parchment text-primary">
                <Routes>
                    <Route path="/faq" element={<Faq />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/*" element={<MainPage />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
