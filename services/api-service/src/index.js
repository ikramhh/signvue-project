const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, migrate, waitForDb } = require("./db");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ================= HEALTH ================= */
app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "up" });
    } catch {
        res.status(500).json({ status: "down" });
    }
});

/* ================= REGISTER (FIXED) ================= */
app.post("/auth/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email et password requis" });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // check existing user
        const exist = await pool.query(
            "SELECT id FROM users WHERE email=$1",
            [normalizedEmail]
        );

        if (exist.rows.length > 0) {
            return res.status(409).json({ message: "Email déjà utilisé" });
        }

        const hash = await bcrypt.hash(password, 10);

        const id = uuidv4();

        await pool.query(
            "INSERT INTO users (id, email, password) VALUES ($1, $2, $3)",
            [id, normalizedEmail, hash]
        );

        return res.status(201).json({
            message: "Inscription réussie",
            user: { id, email: normalizedEmail }
        });

    } catch (err) {
        console.error("[REGISTER ERROR]", err);
        return res.status(500).json({
            message: "Erreur serveur inscription"
        });
    }
});

/* ================= LOGIN ================= */
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const normalizedEmail = email.trim().toLowerCase();

        const result = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Utilisateur introuvable" });
        }

        const user = result.rows[0];

        const ok = await bcrypt.compare(password, user.password);

        if (!ok) {
            return res.status(401).json({ message: "Mot de passe incorrect" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({
            token,
            user: { id: user.id, email: user.email }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur login" });
    }
});

/* ================= VERIFY ================= */
app.get("/auth/me", (req, res) => {
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

main().catch(console.error);