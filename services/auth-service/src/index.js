/**
 * Auth Service — Vérification JWT Supabase.
 */
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");

const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "8h";
const REFRESH_TTL_MS = Number(process.env.REFRESH_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const SERVICE_NAME = "auth-service";
const SERVICE_ID = `${SERVICE_NAME}-${process.env.HOSTNAME || "1"}`;

function hashRefresh(raw) {
    return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function newRefreshToken() {
    return crypto.randomBytes(48).toString("base64url");
}

function signAccess(user) {
    return jwt.sign(
        { sub: user.email, role: user.role, uid: user.id },
        JWT_SECRET,
        { expiresIn: ACCESS_TTL }
    );
}

async function issueRefresh(userId) {
    const raw = newRefreshToken();
    const tokenHash = hashRefresh(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );
    return raw;
}

async function consumeRefresh(raw) {
    const tokenHash = hashRefresh(raw);
    const { rows } = await pool.query(
        `SELECT rt.id AS rt_id, rt.user_id, u.email, u.role
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
        [tokenHash]
    );
    if (!rows.length) return null;
    await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [rows[0].rt_id]);
    return { id: rows[0].user_id, email: rows[0].email, role: rows[0].role };
}

async function revokeRefresh(raw) {
    const tokenHash = hashRefresh(raw);
    await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/verify", (req, res) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentification requise." });
    }
    try {
        const token = h.slice(7);
        const payload = jwt.decode(token);
        if (!payload || !payload.sub) throw new Error("Invalid token");
        res.json({
            id: payload.uid || payload.sub,
            email: payload.sub,
            role: payload.role || "USER"
        });
    } catch (err) {
        res.status(401).json({ message: "Token invalide." });
    }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

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
