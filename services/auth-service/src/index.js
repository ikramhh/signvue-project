const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

console.log("[auth-service] démarré");

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// ----------------------
// VERIFY SUPABASE TOKEN
// ----------------------
app.get("/verify", (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token manquant" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(
            token,
            process.env.SUPABASE_JWT_SECRET
        );

        return res.json({
            id: payload.sub,
            email: payload.email,
            role: payload.role || "USER"
        });

    } catch (err) {
        return res.status(401).json({ error: "Token invalide" });
    }
});

// ----------------------
app.listen(PORT, () => {
    console.log(`[auth-service] écoute sur port ${PORT}`);
});