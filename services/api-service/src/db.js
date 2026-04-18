const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[api-service] DATABASE_URL manquant.");
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS interpretation_sessions (
            id UUID PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            title VARCHAR(200) NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_interpretation_sessions_user ON interpretation_sessions(user_email);
        CREATE TABLE IF NOT EXISTS translations (
            id UUID PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            source_text TEXT NOT NULL DEFAULT '',
            target_text TEXT NOT NULL DEFAULT '',
            lang_from VARCHAR(32) NOT NULL DEFAULT '',
            lang_to VARCHAR(32) NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_translations_user ON translations(user_id);
        CREATE INDEX IF NOT EXISTS idx_translations_created ON translations(created_at DESC);
    `);
}

async function waitForDb(maxAttempts = 30, delayMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await pool.query("SELECT 1");
            return;
        } catch (e) {
            console.warn(`[api-service] attente Postgres (${i + 1}/${maxAttempts})…`);
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
