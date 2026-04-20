const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const { pool } = require("./db");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Configuration email (Ethereal pour test, ou vrai SMTP en production)
const SMTP_HOST = process.env.SMTP_HOST || "smtp.ethereal.email";
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter = null;

async function initMailer() {
    if (SMTP_USER && SMTP_PASS) {
        transporter = nodemailer.createTransporter({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: false,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });
    } else {
        // Mode test avec Ethereal
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log("[EMAIL] Test account created:", testAccount.user);
    }
}

async function sendVerificationEmail(email, token) {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
    
    const info = await transporter.sendMail({
        from: '"SignVue" <noreply@signvue.com>',
        to: email,
        subject: "Vérification de votre inscription - SignVue",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6b3fa0;">Bienvenue sur SignVue !</h2>
                <p>Merci de vous être inscrit. Pour finaliser votre inscription, veuillez cliquer sur le bouton ci-dessous :</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyUrl}" 
                       style="background: #6b3fa0; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                        Vérifier mon email
                    </a>
                </div>
                <p>Ou copiez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
                <p style="color: #999; font-size: 12px;">Ce lien expire dans 24 heures.</p>
            </div>
        `,
    });
    
    console.log("[EMAIL] Verification sent:", info.messageId);
    if (info.ethereal) {
        console.log("[EMAIL] Preview URL:", nodemailer.getTestMessageUrl(info));
    }
    return info;
}

/* ================= REGISTER ================= */
app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: "Champs manquants" });
    }

    try {
        // vérifier si user existe déjà et est vérifié
        const exist = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (exist.rows.length > 0 && exist.rows[0].verified) {
            return res.status(409).json({ message: "Email déjà utilisé" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const verifyToken = uuidv4();

        // Supprimer l'ancien enregistrement si non vérifié
        if (exist.rows.length > 0) {
            await pool.query("DELETE FROM users WHERE email = $1", [email]);
        }

        await pool.query(
            `INSERT INTO users (id, email, password, verified, verify_token, created_at)
             VALUES ($1, $2, $3, false, $4, NOW())`,
            [id, email, hashedPassword, verifyToken]
        );

        // Envoyer l'email de vérification
        await sendVerificationEmail(email, verifyToken);

        res.json({
            message: "Inscription initiée. Vérifiez votre email pour confirmer.",
            userId: id,
            email
        });

    } catch (err) {
        console.error("[REGISTER ERROR]", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= VERIFY EMAIL ================= */
app.get("/auth/verify-email", async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: "Token manquant" });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE verify_token = $1 AND verified = false",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Token invalide ou déjà utilisé" });
        }

        await pool.query(
            "UPDATE users SET verified = true, verify_token = NULL WHERE id = $1",
            [result.rows[0].id]
        );

        res.json({ message: "Email vérifié avec succès ! Vous pouvez maintenant vous connecter." });

    } catch (err) {
        console.error("[VERIFY ERROR]", err);
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

        if (!user.verified) {
            return res.status(401).json({ message: "Email non vérifié. Vérifiez votre boîte mail." });
        }

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

        res.json({ token, user: { email: user.email, role: user.role || "USER" } });

    } catch (err) {
        console.error("[LOGIN ERROR]", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= RESEND VERIFICATION ================= */
app.post("/auth/resend-verification", async (req, res) => {
    const { email } = req.body || {};

    if (!email) {
        return res.status(400).json({ message: "Email manquant" });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND verified = false",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Aucune inscription en attente trouvée" });
        }

        const newToken = uuidv4();
        await pool.query(
            "UPDATE users SET verify_token = $1 WHERE id = $2",
            [newToken, result.rows[0].id]
        );

        await sendVerificationEmail(email, newToken);

        res.json({ message: "Email de vérification renvoyé." });

    } catch (err) {
        console.error("[RESEND ERROR]", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/* ================= VERIFY TOKEN ================= */
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

initMailer().then(() => {
    app.listen(PORT, () => {
        console.log(`[auth-service] running on port ${PORT}`);
    });
});
