/**
 * Service d'authentification SignVue — JWT, rôles USER / ADMIN.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const SERVICE_NAME = "auth-service";
const SERVICE_ID = `${SERVICE_NAME}-${process.env.HOSTNAME || "1"}`;

/** @type {Map<string, { hash: string, role: string }>} */
const users = new Map();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "up", service: SERVICE_NAME });
});

app.post("/register", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || String(password).length < 6) {
        return res.status(400).json({ message: "E-mail et mot de passe (6 caractères min.) requis." });
    }
    const e = String(email).trim().toLowerCase();
    if (users.has(e)) {
        return res.status(409).json({ message: "Cet e-mail est déjà utilisé." });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const role = users.size === 0 ? "ADMIN" : "USER";
    users.set(e, { hash, role });
    const token = jwt.sign({ sub: e, role }, JWT_SECRET, { expiresIn: "8h" });
    res.status(201).json({ token, user: { email: e, role } });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const u = users.get(e);
    if (!u || !(await bcrypt.compare(String(password || ""), u.hash))) {
        return res.status(401).json({ message: "E-mail ou mot de passe incorrect." });
    }
    const token = jwt.sign({ sub: e, role: u.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { email: e, role: u.role } });
});

app.get("/me", (req, res) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Non authentifié." });
    }
    try {
        const p = jwt.verify(h.slice(7), JWT_SECRET);
        res.json({ email: p.sub, role: p.role });
    } catch {
        res.status(401).json({ message: "Token invalide ou expiré." });
    }
});

async function registerConsul() {
    const address = "auth-service";
    const body = {
        ID: SERVICE_ID,
        Name: SERVICE_NAME,
        Address: address,
        Port: PORT,
        Check: {
            HTTP: `http://${address}:${PORT}/health`,
            Interval: "10s",
            Timeout: "3s",
        },
    };
    try {
        const r = await fetch(`http://${CONSUL_HOST}:8500/v1/agent/service/register`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) console.warn("Consul register HTTP", r.status);
        else console.log("[auth-service] enregistré dans Consul:", SERVICE_ID);
    } catch (err) {
        console.warn("[auth-service] Consul indisponible:", err.message);
    }
}

app.listen(PORT, () => {
    console.log(`[auth-service] écoute sur :${PORT}`);
    registerConsul();
});
