const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const { pool, migrate, waitForDb } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ================= HEALTH ================= */
app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "up", service: "api-service", db: true });
    } catch (e) {
        res.status(500).json({ status: "down", db: false });
    }
});

/* ================= REGISTER ================= */
app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body;

    try {
        const exist = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );

        if (exist.rows.length > 0) {
            return res.status(409).json({ message: "Email déjà utilisé" });
        }

        const hash = await bcrypt.hash(password, 10);

        await pool.query(
            "INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), $1, $2)",
            [email, hash]
        );

        return res.status(200).json({ message: "Inscription réussie" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= VERIFY ================= */
app.get("/auth/verify", (req, res) => {
    const h = req.headers.authorization;

    if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token" });
    }

    try {
        const token = h.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json(decoded);
    } catch {
        res.status(401).json({ message: "Token invalide" });
    }
});

/* ================= START ================= */
async function main() {
    await waitForDb();
    await migrate();

    app.listen(PORT, () => {
        console.log(`[api-service] running on ${PORT}`);
    });
}

main().catch(err => console.error(err));