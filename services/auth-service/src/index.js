const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("./db");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ================= REGISTER ================= */
app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: "Champs manquants" });
    }

    try {
        // vérifier si user existe
        const exist = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (exist.rows.length > 0) {
            return res.status(409).json({ message: "Email déjà utilisé" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();

        await pool.query(
            `INSERT INTO users (id, email, password)
             VALUES ($1,$2,$3)`,
            [id, email, hashedPassword]
        );

        res.json({
            message: "Inscription réussie",
            userId: id,
            email
        });

    } catch (err) {
        console.error("[REGISTER ERROR]", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= LOGIN ================= */
app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: "Champs manquants" });
    }

    try {
        const { rows } = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: "Utilisateur introuvable" });
        }

        const user = rows[0];

        const ok = await bcrypt.compare(password, user.password);

        if (!ok) {
            return res.status(401).json({ message: "Mot de passe incorrect" });
        }

        const token = jwt.sign(
            {
                sub: user.email,
                uid: user.id,
                role: user.role || "USER"
            },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ token });

    } catch (err) {
        console.error("[LOGIN ERROR]", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= VERIFY ================= */
app.get("/auth/verify", (req, res) => {
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token" });
    }

    const token = auth.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json(decoded);
    } catch (err) {
        res.status(401).json({ message: "Token invalide" });
    }
});

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
    res.json({ status: "auth-service ok" });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`[auth-service] running on port ${PORT}`);
});