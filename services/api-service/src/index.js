/**
 * API métier SignVue — routes publiques (santé, enregistrement traductions), données en PostgreSQL.
 */
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const amqp = require("amqplib");
const { pool, migrate, waitForDb } = require("./db");

const PORT = Number(process.env.PORT) || 3002;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "signvue.interpretation";
const SERVICE_NAME = "api-service";
const SERVICE_ID = `${SERVICE_NAME}-${process.env.HOSTNAME || "1"}`;

let mqChannel = null;

async function initMq() {
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(QUEUE_NAME, { durable: true });
    mqChannel = ch;
    conn.on("error", (err) => console.error("[api-service] RabbitMQ", err.message));
    console.log("[api-service] connecté à RabbitMQ, file:", QUEUE_NAME);
}

async function authMiddleware(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentification requise." });
    }
    try {
        const response = await fetch('http://auth-service:3001/verify', {
            headers: { Authorization: h }
        });
        if (!response.ok) {
            return res.status(response.status).json({ message: "Token invalide." });
        }
        req.user = await response.json();
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(500).json({ message: "Erreur d'authentification." });
    }
}

/** JWT optionnel : sans en-tête, accès anonyme ; avec Bearer, token doit être valide. */
async function optionalAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        req.user = null;
        return next();
    }
    try {
        const response = await fetch('http://auth-service:3001/verify', {
            headers: { Authorization: h }
        });
        if (!response.ok) {
            return res.status(response.status).json({ message: "Token invalide." });
        }
        req.user = await response.json();
        next();
    } catch (err) {
        console.error('Optional auth error:', err);
        res.status(500).json({ message: "Erreur d'authentification." });
    }
}

async function resolveUserId(req) {
    if (!req.user) return null;
    if (req.user.uid != null) return Number(req.user.uid);
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [req.user.sub]);
    return rows[0]?.id ?? null;
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ message: "Réservé aux administrateurs." });
    }
    next();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "up", service: SERVICE_NAME, queue: QUEUE_NAME, db: true });
    } catch {
        res.status(503).json({ status: "degraded", service: SERVICE_NAME, db: false });
    }
});

/** Public : enregistrer une traduction (liée au compte si JWT valide, sinon anonyme). */
app.post("/translations", optionalAuth, async (req, res) => {
    const { sourceText, targetText, langFrom, langTo } = req.body || {};
    const userId = await resolveUserId(req);
    const id = uuidv4();
    await pool.query(
        `INSERT INTO translations (id, user_id, source_text, target_text, lang_from, lang_to)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            id,
            userId,
            String(sourceText || "").slice(0, 10000),
            String(targetText || "").slice(0, 10000),
            String(langFrom || "").slice(0, 32),
            String(langTo || "").slice(0, 32),
        ]
    );
    res.status(201).json({
        id,
        userId,
        sourceText: String(sourceText || ""),
        targetText: String(targetText || ""),
        langFrom: String(langFrom || ""),
        langTo: String(langTo || ""),
        createdAt: new Date().toISOString(),
    });
});

/** Historique : utilisateur connecté voit les siennes ; ADMIN voit tout. */
app.get("/translations", authMiddleware, async (req, res) => {
    const userId = await resolveUserId(req);
    if (req.user.role === "ADMIN") {
        const { rows } = await pool.query(
            `SELECT t.id, t.user_id AS "userId", t.source_text AS "sourceText",
                    t.target_text AS "targetText", t.lang_from AS "langFrom",
                    t.lang_to AS "langTo", t.created_at AS "createdAt",
                    u.email AS "userEmail"
             FROM translations t
             LEFT JOIN users u ON u.id = t.user_id
             ORDER BY t.created_at DESC
             LIMIT 500`
        );
        return res.json(rows);
    }
    if (!userId) {
        return res.json([]);
    }
    const { rows } = await pool.query(
        `SELECT id, user_id AS "userId", source_text AS "sourceText",
                target_text AS "targetText", lang_from AS "langFrom",
                lang_to AS "langTo", created_at AS "createdAt"
         FROM translations
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 500`,
        [userId]
    );
    res.json(rows);
});

app.get("/sessions", authMiddleware, async (req, res) => {
    const uid = req.user.sub;
    const role = req.user.role;
    let rows;
    if (role === "ADMIN") {
        const r = await pool.query(
            `SELECT id, user_email AS "userId", title, notes, created_at AS "createdAt"
             FROM interpretation_sessions ORDER BY created_at DESC`
        );
        rows = r.rows;
    } else {
        const r = await pool.query(
            `SELECT id, user_email AS "userId", title, notes, created_at AS "createdAt"
             FROM interpretation_sessions WHERE user_email = $1 ORDER BY created_at DESC`,
            [uid]
        );
        rows = r.rows;
    }
    res.json(rows);
});

app.post("/sessions", authMiddleware, async (req, res) => {
    const { title, notes } = req.body || {};
    const id = uuidv4();
    const row = {
        id,
        userId: req.user.sub,
        title: String(title || "Session sans titre").slice(0, 200),
        notes: String(notes || "").slice(0, 2000),
        createdAt: new Date().toISOString(),
    };
    await pool.query(
        `INSERT INTO interpretation_sessions (id, user_email, title, notes, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.id, row.userId, row.title, row.notes, row.createdAt]
    );
    res.status(201).json(row);
});

app.get("/sessions/:id", authMiddleware, async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id, user_email AS "userId", title, notes, created_at AS "createdAt"
         FROM interpretation_sessions WHERE id = $1`,
        [req.params.id]
    );
    const s = rows[0];
    if (!s) return res.status(404).json({ message: "Session introuvable." });
    if (req.user.role !== "ADMIN" && s.userId !== req.user.sub) {
        return res.status(403).json({ message: "Accès refusé." });
    }
    res.json(s);
});

app.put("/sessions/:id", authMiddleware, async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id, user_email AS "userId", title, notes FROM interpretation_sessions WHERE id = $1`,
        [req.params.id]
    );
    const s = rows[0];
    if (!s) return res.status(404).json({ message: "Session introuvable." });
    if (req.user.role !== "ADMIN" && s.userId !== req.user.sub) {
        return res.status(403).json({ message: "Accès refusé." });
    }
    const { title, notes } = req.body || {};
    const newTitle = title != null ? String(title).slice(0, 200) : s.title;
    const newNotes = notes != null ? String(notes).slice(0, 2000) : s.notes;
    await pool.query(
        `UPDATE interpretation_sessions SET title = $1, notes = $2 WHERE id = $3`,
        [newTitle, newNotes, req.params.id]
    );
    const { rows: out } = await pool.query(
        `SELECT id, user_email AS "userId", title, notes, created_at AS "createdAt"
         FROM interpretation_sessions WHERE id = $1`,
        [req.params.id]
    );
    res.json(out[0]);
});

app.delete("/sessions/:id", authMiddleware, async (req, res) => {
    const { rows } = await pool.query(
        `SELECT user_email AS "userId" FROM interpretation_sessions WHERE id = $1`,
        [req.params.id]
    );
    const s = rows[0];
    if (!s) return res.status(404).json({ message: "Session introuvable." });
    if (req.user.role !== "ADMIN" && s.userId !== req.user.sub) {
        return res.status(403).json({ message: "Accès refusé." });
    }
    await pool.query(`DELETE FROM interpretation_sessions WHERE id = $1`, [req.params.id]);
    res.status(204).send();
});

app.post("/interpretation-requests", authMiddleware, (req, res) => {
    if (!mqChannel) {
        return res.status(503).json({ message: "File de messages indisponible." });
    }
    const jobId = uuidv4();
    const payload = {
        jobId,
        userId: req.user.sub,
        role: req.user.role,
        source: (req.body && req.body.source) || "api",
        sessionId: req.body?.sessionId || null,
        requestedAt: new Date().toISOString(),
    };
    const buf = Buffer.from(JSON.stringify(payload));
    mqChannel.sendToQueue(QUEUE_NAME, buf, { persistent: true });
    res.status(202).json({
        status: "queued",
        jobId,
        message: "Demande acceptée — traitement asynchrone via RabbitMQ.",
    });
});

app.get("/stats/sessions", authMiddleware, requireAdmin, async (_req, res) => {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM interpretation_sessions`);
    res.json({ totalSessions: rows[0].n });
});

async function registerConsul() {
    const address = "api-service";
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
        else console.log("[api-service] enregistré dans Consul:", SERVICE_ID);
    } catch (err) {
        console.warn("[api-service] Consul indisponible:", err.message);
    }
}

async function main() {
    await waitForDb();
    await migrate();
    await initMq();
    app.listen(PORT, () => {
        console.log(`[api-service] écoute sur :${PORT}`);
        registerConsul();
    });
}

main().catch((err) => {
    console.error("[api-service]", err);
    process.exit(1);
});
