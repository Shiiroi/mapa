import { LEGACY_ROUTES } from "./legacy-routes.js";

export default function handler(req, res) {
    const url = new URL(req.url || "/", "https://lens.mapaph.com");
    const type = (url.searchParams.get("type") || "").toLowerCase();
    const rawSlug = (url.searchParams.get("slug") || "").toLowerCase().replace(/^\/+|\/+$/g, "");
    const bucket =
        type === "province"
            ? LEGACY_ROUTES.province
            : type === "municipality"
              ? LEGACY_ROUTES.municipality
              : null;
    const target = (bucket && bucket[rawSlug]) || "/";
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.writeHead(308, { Location: target });
    res.end();
}
