import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Log the current mode – helpful for debugging
if (supabaseUrl?.includes("localhost")) {
    console.log("🐳 Using Docker Supabase (local)");
} else {
    console.log("☁️ Using Cloud Supabase");
}

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY env vars");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
