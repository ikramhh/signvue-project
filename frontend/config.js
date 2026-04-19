/**
 * Base URL du backend (Render, Docker, etc.).
 * Surcharges possibles :
 * 1) Balise <meta name="signvue-api-base" content="https://...">
 * 2) window.__SIGNVUE_API_BASE__ défini avant ce fichier
 */
(function () {
    if (typeof window.__SIGNVUE_API_BASE__ === "string" && window.__SIGNVUE_API_BASE__.trim()) {
        return;
    }
    var m = document.querySelector('meta[name="signvue-api-base"]');
    if (m && m.getAttribute("content")) {
        window.__SIGNVUE_API_BASE__ = m.getAttribute("content").trim();
    } else {
        window.__SIGNVUE_API_BASE__ = "https://signvue-api.onrender.com";
    }
})();

/**
 * Supabase client pour l'authentification
 */
(function () {
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Remplacez par votre URL Supabase
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Remplacez par votre clé anon
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
