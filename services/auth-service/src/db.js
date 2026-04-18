const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[auth-service] DATABASE_URL manquant.");
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'USER',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `);
}

async function waitForDb(maxAttempts = 30, delayMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await pool.query("SELECT 1");
            return;
        } catch (e) {
            console.warn(`[auth-service] attente Postgres (${i + 1}/${maxAttempts})…`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw new Error("Postgres indisponible.");
}

module.exports = {
    pool,
    migrate,
    waitForDb,
};
