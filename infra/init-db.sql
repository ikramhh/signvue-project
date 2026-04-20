-- SignVue — schéma initial (exécuté au premier démarrage du conteneur Postgres)

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    verified BOOLEAN NOT NULL DEFAULT false,
    verify_token VARCHAR(255),
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
