async function migrate() {
    // USERS (corrigé pour UUID + password)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // INTERPRETATION SESSIONS
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

    // TRANSLATIONS
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