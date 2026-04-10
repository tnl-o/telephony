'use strict';

/**
 * Lightweight migration runner.
 * Tracks applied migrations in the `_migrations` table.
 * Migrations are plain SQL — safe, transparent, reproducible.
 */

const migrations = [
  {
    name: '001_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        login         VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(10)  NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user', 'admin')),
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '002_create_spaces',
    sql: `
      CREATE TABLE IF NOT EXISTS spaces (
        id          SERIAL PRIMARY KEY,
        extension   VARCHAR(50)  NOT NULL,
        sip_password VARCHAR(255) NOT NULL,
        pbx_wss_url VARCHAR(500) NOT NULL,
        user_id     INTEGER      NOT NULL UNIQUE
                      REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: '003_create_call_histories',
    sql: `
      CREATE TABLE IF NOT EXISTS call_histories (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER      NOT NULL
                     REFERENCES users(id) ON DELETE CASCADE,
        direction  VARCHAR(10)  NOT NULL
                     CHECK (direction IN ('incoming', 'outgoing', 'missed')),
        number     VARCHAR(100) NOT NULL,
        duration   INTEGER      NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_call_histories_user_id
        ON call_histories(user_id);
    `,
  },
];

/**
 * Run all pending migrations in order.
 * @param {import('sequelize').Sequelize} sequelize
 */
async function runMigrations(sequelize) {
  // Ensure the migrations tracking table exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name    VARCHAR(255) PRIMARY KEY,
      run_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  const [applied] = await sequelize.query(
    'SELECT name FROM _migrations ORDER BY run_at ASC'
  );
  const appliedNames = new Set(applied.map((r) => r.name));

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) {
      continue;
    }

    console.log(`[migration] Running: ${migration.name}`);
    await sequelize.query(migration.sql);
    await sequelize.query(
      `INSERT INTO _migrations (name) VALUES (:name)`,
      { replacements: { name: migration.name } }
    );
    console.log(`[migration] Done:    ${migration.name}`);
  }
}

module.exports = { runMigrations };
