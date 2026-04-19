const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "signvue-dev-jwt-secret-change-me";

if (!JWT_SECRET) {
    console.error("[auth-service] JWT_SECRET manquant.");
    process.exit(1);
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

async function getUserByEmail(email) {
    const { rows } = await pool.query(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        [normalizeEmail(email)]
    );
    return rows[0] || null;
}

async function getUserById(id) {
    const { rows } = await pool.query(
        "SELECT id, email, role FROM users WHERE id = $1",
        [id]
    );
    return rows[0] || null;
}

async function createUser(email, passwordHash) {
    const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, role`,
        [normalizeEmail(email), passwordHash]
    );
    return rows[0];
}

function signToken(user) {
    return jwt.sign(
        {
            sub: user.email,
            uid: user.id,
            email: user.email,
            role: user.role || "USER",
        },
        JWT_SECRET,
        { expiresIn: "12h" }
    );
}

function buildAuthResponse(user) {
    return {
        token: signToken(user),
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    };
}

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    return authHeader.slice(7);
}

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.post("/register", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
        return res.status(400).json({ error: "E-mail et mot de passe requis." });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    try {
        if (await getUserByEmail(email)) {
            return res.status(409).json({ error: "Cet e-mail est déjà utilisé. Connectez-vous." });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await createUser(email, passwordHash);
        return res.status(201).json(buildAuthResponse(user));
    } catch (err) {
        console.error("[auth-service] register error", err);
        if (err.code === "23505") {
            return res.status(409).json({ error: "Cet e-mail est déjà utilisé. Connectez-vous." });
        }
        return res.status(500).json({ error: "Impossible de créer le compte." });
    }
});

app.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
        return res.status(400).json({ error: "E-mail et mot de passe requis." });
    }

    try {
        const user = await getUserByEmail(email);
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: "E-mail ou mot de passe incorrect." });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: "E-mail ou mot de passe incorrect." });
        }

        return res.json(buildAuthResponse(user));
    } catch (err) {
        console.error("[auth-service] login error", err);
        return res.status(500).json({ error: "Impossible de se connecter." });
    }
});

app.get("/verify", async (req, res) => {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: "Token manquant" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await getUserById(payload.uid);
        if (!user) {
            return res.status(401).json({ error: "Token invalide" });
        }

        return res.json({
            sub: user.email,
            uid: user.id,
            email: user.email,
            role: user.role || "USER",
        });
    } catch (err) {
        return res.status(401).json({ error: "Token invalide" });
    }
});

app.get("/me", async (req, res) => {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: "Token manquant" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await getUserById(payload.uid);
        if (!user) {
            return res.status(401).json({ error: "Token invalide" });
        }

        return res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
        return res.status(401).json({ error: "Token invalide" });
    }
});

app.listen(PORT, () => {
    console.log(`[auth-service] écoute sur port ${PORT}`);
});