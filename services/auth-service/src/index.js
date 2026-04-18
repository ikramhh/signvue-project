/**
 * Service d'authentification SignVue — PostgreSQL, JWT, refresh tokens, rôles USER / ADMIN.
 */
const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, migrate, waitForDb } = require("./db");

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
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "up", service: SERVICE_NAME, db: true });
    } catch {
        res.status(503).json({ status: "degraded", service: SERVICE_NAME, db: false });
    }
});

app.post("/register", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || String(password).length < 6) {
        return res.status(400).json({ message: "E-mail et mot de passe (6 caractères min.) requis." });
    }
    const e = String(email).trim().toLowerCase();
    const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM users`);
    const role = cnt[0].n === 0 ? "ADMIN" : "USER";
    const hash = await bcrypt.hash(String(password), 10);
    let user;
    try {
        const ins = await pool.query(
            `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
             RETURNING id, email, role`,
            [e, hash, role]
        );
        user = ins.rows[0];
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ message: "Cet e-mail est déjà utilisé." });
        }
        throw err;
    }
    const token = signAccess(user);
    const refreshToken = await issueRefresh(user.id);
    res.status(201).json({ token, refreshToken, user: { id: user.id, email: user.email, role: user.role } });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const { rows } = await pool.query(`SELECT id, email, password_hash, role FROM users WHERE email = $1`, [e]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(String(password || ""), u.password_hash))) {
        return res.status(401).json({ message: "E-mail ou mot de passe incorrect." });
    }
    const user = { id: u.id, email: u.email, role: u.role };
    const token = signAccess(user);
    const refreshToken = await issueRefresh(u.id);
    res.json({ token, refreshToken, user });
});

app.post("/refresh", async (req, res) => {
    const raw = (req.body && req.body.refreshToken) || "";
    if (!raw) return res.status(400).json({ message: "refreshToken requis." });
    const user = await consumeRefresh(String(raw));
    if (!user) return res.status(401).json({ message: "Session invalide ou expirée." });
    const token = signAccess(user);
    const refreshToken = await issueRefresh(user.id);
    res.json({ token, refreshToken, user: { id: user.id, email: user.email, role: user.role } });
});

app.post("/logout", async (req, res) => {
    const raw = (req.body && req.body.refreshToken) || "";
    if (raw) await revokeRefresh(String(raw));
    res.status(204).send();
});

app.get("/me", (req, res) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Non authentifié." });
    }
    try {
        const p = jwt.verify(h.slice(7), JWT_SECRET);
        res.json({ id: p.uid, email: p.sub, role: p.role });
    } catch {
        res.status(401).json({ message: "Token invalide ou expiré." });
    }
});

function authMiddleware(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentification requise." });
    }
    try {
        req.auth = jwt.verify(h.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: "Token invalide ou expiré." });
    }
}

function requireAdmin(req, res, next) {
    if (req.auth?.role !== "ADMIN") {
        return res.status(403).json({ message: "Réservé aux administrateurs." });
    }
    next();
}

app.get("/admin/users", authMiddleware, requireAdmin, async (_req, res) => {
    const { rows } = await pool.query(
        `SELECT id, email, role, created_at FROM users ORDER BY id ASC`
    );
    res.json(rows);
});

app.patch("/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { role } = req.body || {};
    if (!id || !role || !["USER", "ADMIN"].includes(String(role))) {
        return res.status(400).json({ message: "Rôle USER ou ADMIN requis." });
    }
    if (id === req.auth.uid && String(role) !== "ADMIN") {
        const { rows: admins } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN'`
        );
        if (admins[0].n <= 1) {
            return res.status(400).json({ message: "Impossible de retirer le dernier administrateur." });
        }
    }
    const up = await pool.query(
        `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, created_at`,
        [String(role), id]
    );
    if (!up.rows.length) return res.status(404).json({ message: "Utilisateur introuvable." });
    res.json(up.rows[0]);
});

app.delete("/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID invalide." });
    if (id === req.auth.uid) {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte." });
    }
    const { rows: admins } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN'`
    );
    const target = await pool.query(`SELECT role FROM users WHERE id = $1`, [id]);
    if (!target.rows.length) return res.status(404).json({ message: "Utilisateur introuvable." });
    if (target.rows[0].role === "ADMIN" && admins[0].n <= 1) {
        return res.status(400).json({ message: "Impossible de supprimer le dernier administrateur." });
    }
    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    res.status(204).send();
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

async function main() {
    await waitForDb();
    await migrate();
    app.listen(PORT, () => {
        console.log(`[auth-service] écoute sur :${PORT}`);
        registerConsul();
    });
}

main().catch((err) => {
    console.error("[auth-service]", err);
    process.exit(1);
});
