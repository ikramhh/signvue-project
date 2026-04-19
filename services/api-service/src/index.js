const cors = require("cors");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const amqp = require("amqplib");
const { pool, migrate, waitForDb } = require("./db");

const PORT = Number(process.env.PORT) || 3002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

const QUEUE_NAME = "signvue.interpretation";

let mqChannel = null;

/* ================= MQ ================= */
async function initMq() {
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(QUEUE_NAME, { durable: true });
    mqChannel = ch;
}

/* ================= APP ================= */
const app = express();
app.use(cors());
app.use(express.json());

/* ================= AUTH ================= */

/* REGISTER */
app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: "Champs manquants" });
    }

    try {
        const id = uuidv4();

        await pool.query(
            `INSERT INTO users (id, email, password)
             VALUES ($1,$2,$3)
             ON CONFLICT (email) DO NOTHING`,
            [id, email, password]
        );

        res.json({ message: "Inscription réussie", email });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* LOGIN */
app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: "Champs manquants" });
    }

    try {
        const { rows } = await pool.query(
            `SELECT * FROM users WHERE email=$1 AND password=$2`,
            [email, password]
        );

        if (!rows.length) {
            return res.status(401).json({ message: "Identifiants invalides" });
        }

        res.json({
            message: "Connexion réussie",
            token: "fake-jwt-token",
            user: rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= HEALTH ================= */
app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "up" });
    } catch {
        res.status(500).json({ status: "down" });
    }
});

/* ================= TRANSLATIONS ================= */
app.post("/translations", async (req, res) => {
    const { sourceText, targetText } = req.body || {};
    const id = uuidv4();

    await pool.query(
        `INSERT INTO translations (id, source_text, target_text)
         VALUES ($1,$2,$3)`,
        [id, sourceText, targetText]
    );

    res.json({ id });
});

app.get("/translations", async (_req, res) => {
    const { rows } = await pool.query("SELECT * FROM translations");
    res.json(rows);
});

/* ================= START ================= */
async function main() {
    await waitForDb();
    await migrate();
    await initMq();

    app.listen(PORT, () => {
        console.log(`[api-service] running on ${PORT}`);
    });
}

main().catch(err => {
    console.error(err);
});