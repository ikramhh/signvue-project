const USE_LOCAL_AUTH = new URLSearchParams(window.location.search).get("local") === "1";

const STORAGE_SESSION = "signvue_session_v1";
const STORAGE_TOKEN = "signvue_jwt";

/* =========================
   API BASE
========================= */
function getApiBase() {
    const raw =
        (typeof window.__SIGNVUE_API_BASE__ === "string" && window.__SIGNVUE_API_BASE__.trim()) ||
        "";

    return (raw || "http://localhost:3001").replace(/\/$/, "");
}

function apiUrl(path) {
    return `${getApiBase()}${path}`;
}

/* =========================
   AUTH STORAGE
========================= */
function setToken(token) {
    localStorage.setItem(STORAGE_TOKEN, token);
}

function getToken() {
    return localStorage.getItem(STORAGE_TOKEN);
}

function setSession(email) {
    sessionStorage.setItem(STORAGE_SESSION, email);
}

function getSession() {
    return sessionStorage.getItem(STORAGE_SESSION);
}

function clearAuth() {
    localStorage.removeItem(STORAGE_TOKEN);
    sessionStorage.removeItem(STORAGE_SESSION);
}

function isLoggedIn() {
    return !!getToken();
}

/* =========================
   API CALL WRAPPER
========================= */
async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(apiUrl(path), {
        ...options,
        headers,
    });

    const data = await res.json().catch(() => ({}));
    return { res, data };
}

/* =========================
   REGISTER
========================= */
async function apiRegister(email, password) {
    console.log("[REGISTER] send:", email);

    const { res, data } = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

    console.log("[REGISTER] response:", res.status, data);

    if (!res.ok) {
        return { ok: false, message: data.message || "Erreur inscription" };
    }

    if (data.token) setToken(data.token);
    setSession(email);

    return { ok: true };
}

/* =========================
   LOGIN
========================= */
async function apiLogin(email, password) {
    console.log("[LOGIN] send:", email);

    const { res, data } = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

    console.log("[LOGIN] response:", res.status, data);

    if (!res.ok) {
        return { ok: false, message: data.message || "Erreur login" };
    }

    if (data.token) setToken(data.token);
    setSession(email);

    return { ok: true };
}

/* =========================
   VERIFY SESSION
========================= */
async function validateSessionWithServer() {
    const token = getToken();
    if (!token) return;

    try {
        const { res, data } = await apiRequest("/auth/me", {
            method: "GET",
        });

        if (!res.ok) {
            clearAuth();
            return;
        }

        setSession(data.email);
    } catch (e) {
        console.warn("verify failed");
    }
}