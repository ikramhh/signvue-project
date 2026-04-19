const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[auth-service] DATABASE_URL manquant.");
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

module.exports = {
    pool
};