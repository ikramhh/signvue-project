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
    const SUPABASE_URL = "https://castbrkpjiyfmtbrlccd.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhc3Ricmtwaml5Zm10YnJsY2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzQ5MDksImV4cCI6MjA5MjExMDkwOX0.JTDCiNJD8JPaEGpJ5cH9j11k9uJetw5UtHUt0JMUU2o";
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
