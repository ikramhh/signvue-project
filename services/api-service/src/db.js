const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("[api-service] DATABASE_URL manquant.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

/* ================= WAIT FOR DB ================= */
async function waitForDb(maxAttempts = 30, delayMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await pool.query("SELECT 1");
            console.log("[api-service] Postgres prêt");
            return;
        } catch (e) {
            console.warn(`[api-service] attente DB (${i + 1}/${maxAttempts})...`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw new Error("Postgres indisponible après plusieurs tentatives.");
}

/* ================= MIGRATIONS ================= */
await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS interpretation_sessions (
            id UUID PRIMARY KEY,
            user_email VARCHAR(255),
            title VARCHAR(200),
            notes TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_user
        ON interpretation_sessions(user_email);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS translations (
            id UUID PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            source_text TEXT DEFAULT '',
            target_text TEXT DEFAULT '',
            lang_from VARCHAR(32),
            lang_to VARCHAR(32),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_translations_user
        ON translations(user_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_translations_created
        ON translations(created_at DESC);
    `);

    console.log("[api-service] migrations OK");
}

/* ================= EXPORT PROPRE ================= */
module.exports = {
    pool,
    waitForDb,
    migrate,
};