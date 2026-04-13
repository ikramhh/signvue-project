/**
 * API métier SignVue — CRUD sessions d'interprétation + endpoint métier (file RabbitMQ).
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const amqp = require("amqplib");

const PORT = Number(process.env.PORT) || 3002;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "signvue.interpretation";
const SERVICE_NAME = "api-service";
const SERVICE_ID = `${SERVICE_NAME}-${process.env.HOSTNAME || "1"}`;

/** @type {Map<string, { id: string, userId: string, title: string, notes: string, createdAt: string }>} */
const sessions = new Map();

let mqChannel = null;

async function initMq() {
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(QUEUE_NAME, { durable: true });
    mqChannel = ch;
    conn.on("error", (err) => console.error("[api-service] RabbitMQ", err.message));
    console.log("[api-service] connecté à RabbitMQ, file:", QUEUE_NAME);
}

function authMiddleware(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentification requise." });
    }
    try {
        req.user = jwt.verify(h.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: "Token invalide ou expiré." });
    }
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ message: "Réservé aux administrateurs." });
    }
    next();
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "up", service: SERVICE_NAME, queue: QUEUE_NAME });
});

app.get("/sessions", authMiddleware, (req, res) => {
    const uid = req.user.sub;
    const role = req.user.role;
    const list = [...sessions.values()].filter((s) => role === "ADMIN" || s.userId === uid);
    res.json(list);
});

app.post("/sessions", authMiddleware, (req, res) => {
    const { title, notes } = req.body || {};
    const id = uuidv4();
    const row = {
        id,
        userId: req.user.sub,
        title: String(title || "Session sans titre").slice(0, 200),
        notes: String(notes || "").slice(0, 2000),
        createdAt: new Date().toISOString(),
    };
    sessions.set(id, row);
    res.status(201).json(row);
});

app.get("/sessions/:id", authMiddleware, (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ message: "Session introuvable." });
    if (req.user.role !== "ADMIN" && s.userId !== req.user.sub) {
        return res.status(403).json({ message: "Accès refusé." });
    }
    res.json(s);
});

app.put("/sessions/:id", authMiddleware, (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ message: "Session introuvable." });
    if (req.user.role !== "ADMIN" && s.userId !== req.user.sub) {
        return res.status(403).json({ message: "Accès refusé." });
    }
    const { title, notes } = req.body || {};
    if (title != null) s.title = String(title).slice(0, 200);
    if (notes != null) s.notes = String(notes).slice(0, 2000);
    sessions.set(s.id, s);
    res.json(s);
});

app.delete("/sessions/:id", authMiddleware, (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ message: "Session introuvable." });
    if (req.user.role !== "ADMIN" && s.userId !== req.user.sub) {
        return res.status(403).json({ message: "Accès refusé." });
    }
    sessions.delete(req.params.id);
    res.status(204).send();
});

/** Endpoint métier : demande d'analyse asynchrone (notification / traitement lourd). */
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

/** Statistiques métier (exemple de permission ADMIN). */
app.get("/stats/sessions", authMiddleware, requireAdmin, (_req, res) => {
    res.json({ totalSessions: sessions.size });
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

initMq()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`[api-service] écoute sur :${PORT}`);
            registerConsul();
        });
    })
    .catch((err) => {
        console.error("[api-service] échec RabbitMQ:", err);
        process.exit(1);
    });
