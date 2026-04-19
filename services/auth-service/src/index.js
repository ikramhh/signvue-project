const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// fake DB (simple pour ton projet)
const users = [];

/* ---------------- REGISTER ---------------- */
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    const exists = users.find(u => u.email === email);
    if (exists) {
        return res.status(400).json({ message: "Utilisateur existe déjà" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = {
        id: users.length + 1,
        email,
        password: hash,
        role: "USER"
    };

    users.push(user);

    res.json({ message: "Inscription réussie" });
});

/* ---------------- LOGIN ---------------- */
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ message: "Utilisateur introuvable" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    const token = jwt.sign(
        {
            sub: user.email,
            uid: user.id,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    res.json({ token });
});

/* ---------------- VERIFY ---------------- */
app.get("/verify", (req, res) => {
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

/* ---------------- HEALTH ---------------- */
app.get("/health", (req, res) => {
    res.json({ status: "auth ok" });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log("auth-service running on", PORT);
});