const cors = require("cors");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const amqp = require("amqplib");
const { pool, migrate, waitForDb } = require("./db");

const PORT = Number(process.env.PORT) || 3002;
const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

const QUEUE_NAME = "signvue.interpretation";
const SERVICE_NAME = "api-service";
const SERVICE_ID = `${SERVICE_NAME}-${process.env.HOSTNAME || "1"}`;

let mqChannel = null;

/* ---------------- MQ ---------------- */
async function initMq() {
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(QUEUE_NAME, { durable: true });
    mqChannel = ch;

    conn.on("error", (err) =>
        console.error("[api-service] RabbitMQ error:", err.message)
    );

    console.log("[api-service] RabbitMQ connecté");
}

/* ---------------- AUTH MIDDLEWARE (FIXED) ---------------- */
async function authMiddleware(req, res, next) {
    const h = req.headers.authorization;

    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentification requise." });
    }

    try {
        const response = await fetch("http://auth-service:3001/verify", {
            headers: { Authorization: h }
        });

        if (!response.ok) {
            return res.status(401).json({ message: "Token invalide." });
        }

        const data = await response.json();

        if (!data?.sub) {
            return res.status(401).json({ message: "Utilisateur invalide." });
        }

        req.user = data;
        next();

    } catch (err) {
        console.error("[authMiddleware]", err);
        res.status(500).json({ message: "Erreur auth-service." });
    }
}

/* ---------------- OPTIONAL AUTH (SAFE) ---------------- */
async function optionalAuth(req, res, next) {
    const h = req.headers.authorization;

    if (!h?.startsWith("Bearer ")) {
        req.user = null;
        return next();
    }

    try {
        const response = await fetch("http://auth-service:3001/verify", {
            headers: { Authorization: h }
        });

        if (!response.ok) {
            req.user = null;
            return next();
        }

        const data = await response.json();
        req.user = data?.sub ? data : null;
        next();

    } catch (err) {
        console.error("[optionalAuth]", err);
        req.user = null;
        next();
    }
}

/* ---------------- HELPERS ---------------- */
async function resolveUserId(req) {
    if (!req.user) return null;
    if (req.user.uid != null) return Number(req.user.uid);

    const { rows } = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [req.user.sub]
    );

    return rows[0]?.id ?? null;
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ message: "Réservé aux administrateurs." });
    }
    next();
}

/* ---------------- APP ---------------- */
const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- HEALTH ---------------- */
app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "up", service: SERVICE_NAME, db: true });
    } catch {
        res.status(503).json({ status: "down", db: false });
    }
});

/* ---------------- TRANSLATIONS ---------------- */
app.post("/translations", optionalAuth, async (req, res) => {
    const { sourceText, targetText, langFrom, langTo } = req.body || {};

    const userId = await resolveUserId(req);
    const id = uuidv4();

    await pool.query(
        `INSERT INTO translations 
        (id, user_id, source_text, target_text, lang_from, lang_to)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [
            id,
            userId,
            String(sourceText || ""),
            String(targetText || ""),
            String(langFrom || ""),
            String(langTo || "")
        ]
    );

    res.status(201).json({ id, userId });
});

app.get("/translations", authMiddleware, async (req, res) => {
    const userId = await resolveUserId(req);

    if (req.user?.role === "ADMIN") {
        const { rows } = await pool.query(
            `SELECT * FROM translations ORDER BY created_at DESC`
        );
        return res.json(rows);
    }

    const { rows } = await pool.query(
        `SELECT * FROM translations WHERE user_id=$1 ORDER BY created_at DESC`,
        [userId]
    );

    res.json(rows);
});

/* ---------------- SESSIONS ---------------- */
app.post("/sessions", authMiddleware, async (req, res) => {
    const { title, notes } = req.body || {};

    const id = uuidv4();

    await pool.query(
        `INSERT INTO interpretation_sessions 
        (id, user_email, title, notes)
        VALUES ($1,$2,$3,$4)`,
        [
            id,
            req.user?.sub,
            title || "Session",
            notes || ""
        ]
    );

    res.status(201).json({ id });
});

app.get("/sessions", authMiddleware, async (req, res) => {
    const uid = req.user?.sub;

    const { rows } = await pool.query(
        `SELECT * FROM interpretation_sessions
         WHERE user_email=$1`,
        [uid]
    );

    res.json(rows);
});

/* ---------------- INTERPRETATION QUEUE ---------------- */
app.post("/interpretation-requests", authMiddleware, (req, res) => {
    if (!mqChannel) {
        return res.status(503).json({ message: "Queue indisponible." });
    }

    const jobId = uuidv4();

    mqChannel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify({
            jobId,
            userId: req.user?.sub,
            createdAt: new Date().toISOString()
        })),
        { persistent: true }
    );

    res.status(202).json({ jobId, status: "queued" });
});

/* ---------------- ADMIN STATS ---------------- */
app.get("/stats/sessions", authMiddleware, requireAdmin, async (_req, res) => {
    const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS total FROM interpretation_sessions"
    );

    res.json(rows[0]);
});

/* ---------------- START ---------------- */
async function main() {
    await waitForDb();
    await migrate();
    await initMq();

    app.listen(PORT, () => {
        console.log(`[api-service] running on ${PORT}`);
    });
}

main().catch((err) => {
    console.error("[api-service fatal]", err);
    process.exit(1);
});