// Mapa - interactive choropleth map of the Philippines.
// Explore population, economy, and household statistics by region, province,
// city/municipality, and barangay; overlay your own CSV datasets and built-in
// COMELEC 2022 election results; and compare any two places side by side.
//
// Author: Vince Roi S. Magwili
// Date: June 28, 2026
//
// Application entry; mounts React, QueryClient, and global styles.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 2,
        },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <App />
                <Analytics />
            </QueryClientProvider>
        </HelmetProvider>
    </StrictMode>,
);
