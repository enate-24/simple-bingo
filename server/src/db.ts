import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback: load from process env (Render sets env vars directly)

// Allow self-signed certificates for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'operator')),
        balance DECIMAL(10, 2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        draws_count INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        game_number INTEGER NOT NULL,
        selected_numbers INTEGER[] NOT NULL,
        drawn_numbers INTEGER[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cartela_stock (
        id SERIAL PRIMARY KEY,
        total_cartelas INTEGER NOT NULL DEFAULT 20,
        sold_cartelas INTEGER NOT NULL DEFAULT 0,
        round_started_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rounds (
        id SERIAL PRIMARY KEY,
        total_cartelas INTEGER NOT NULL,
        cartela_price DECIMAL(10,2),
        prize_1 DECIMAL(10,2),
        prize_2 DECIMAL(10,2),
        prize_3 DECIMAL(10,2),
        winner_1 INTEGER,
        winner_2 INTEGER,
        winner_3 INTEGER,
        winner_1_phone VARCHAR(20),
        winner_2_phone VARCHAR(20),
        winner_3_phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'completed')),
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cartela_purchases (
        id SERIAL PRIMARY KEY,
        round_id INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
        cartela_number INTEGER NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_name VARCHAR(100),
        purchased_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_cartela_purchases_round ON cartela_purchases(round_id);

      CREATE TABLE IF NOT EXISTS payment_addresses (
        id SERIAL PRIMARY KEY,
        label VARCHAR(100) NOT NULL,
        address VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'bank',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
      CREATE INDEX IF NOT EXISTS idx_games_game_number ON games(game_number);
    `);

    // Insert default packages if not exists
    const packagesCheck = await client.query('SELECT COUNT(*) FROM packages');
    if (parseInt(packagesCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO packages (name, price, draws_count) VALUES
          ('Starter Pack', 30.00, 30),
          ('Standard Pack', 25.00, 30),
          ('Premium Pack', 50.00, 75),
          ('Ultimate Pack', 100.00, 200)
      `);
    }

    // Ensure round_started_at column exists (migration for existing DBs)
    await client.query(`
      ALTER TABLE cartela_stock ADD COLUMN IF NOT EXISTS round_started_at TIMESTAMP DEFAULT NOW()
    `);

    // Ensure price/prize columns exist on rounds (migration for existing DBs)
    await client.query(`
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS cartela_price DECIMAL(10,2);
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS prize_1 DECIMAL(10,2);
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS prize_2 DECIMAL(10,2);
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS prize_3 DECIMAL(10,2);
    `);

    // Preset winners columns (server-side pre-picked, hidden until revealed)
    await client.query(`
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS preset_winner_1 INTEGER;
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS preset_winner_2 INTEGER;
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS preset_winner_3 INTEGER;
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS winners_revealed INTEGER DEFAULT 0;
    `);

    // Add operator_id to rounds (per-operator game isolation)
    await client.query(`
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES users(id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rounds_operator_id ON rounds(operator_id);
    `);

    // Ensure customer_name column exists on cartela_purchases (migration)
    await client.query(`
      ALTER TABLE cartela_purchases ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
    `);
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'operator'));
    `);

    // Ensure payment_addresses table exists (migration for existing DBs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_addresses (
        id SERIAL PRIMARY KEY,
        label VARCHAR(100) NOT NULL,
        address VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'bank',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ensure system_settings table exists (migration for existing DBs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add user_id to system_settings for per-operator settings
    await client.query(`
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);
    // Drop old single-key primary key, add id column, add composite unique index
    await client.query(`ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;`);
    await client.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS id SERIAL;`);
    // Make id the new primary key if not already
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_id_pkey' AND conrelid = 'system_settings'::regclass
        ) THEN
          ALTER TABLE system_settings ADD PRIMARY KEY (id);
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_key_user ON system_settings(key, user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_user_id ON system_settings(user_id);
    `);

    // Add user_id to payment_addresses for per-operator payment methods
    await client.query(`
      ALTER TABLE payment_addresses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_addresses_user_id ON payment_addresses(user_id);
    `);

    // Clean up old global system_settings rows (no user_id) that could leak to new users
    await client.query(`DELETE FROM system_settings WHERE user_id IS NULL;`);
    const roundCheck = await client.query(`SELECT id, total_cartelas FROM rounds WHERE status = 'open' LIMIT 1`);
    if (roundCheck.rows.length === 0) {
      const newRound = await client.query(`INSERT INTO rounds (total_cartelas) VALUES (20) RETURNING id`);
      const rid = newRound.rows[0].id;
      // Pre-pick winners for the default round
      const nums = Array.from({ length: 20 }, (_, i) => i + 1);
      for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
      await client.query(`UPDATE rounds SET preset_winner_1=$1, preset_winner_2=$2, preset_winner_3=$3, winners_revealed=0 WHERE id=$4`, [nums[0], nums[1], nums[2], rid]);
    } else {
      // Fix any open round missing pre-picked winners
      const row = roundCheck.rows[0];
      const missingCheck = await client.query(`SELECT preset_winner_1 FROM rounds WHERE id=$1`, [row.id]);
      if (!missingCheck.rows[0]?.preset_winner_1) {
        const total = row.total_cartelas || 20;
        const nums = Array.from({ length: total }, (_, i) => i + 1);
        for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
        await client.query(`UPDATE rounds SET preset_winner_1=$1, preset_winner_2=$2, preset_winner_3=$3, winners_revealed=0 WHERE id=$4`, [nums[0], nums[1], nums[2], row.id]);
        console.log(`[Winners] Fixed missing pre-picked winners for existing round ${row.id}`);
      }
    }

    // Insert default cartela stock if not exists, or fix if wrong total
    const cartelaCheck = await client.query('SELECT COUNT(*) FROM cartela_stock');
    if (parseInt(cartelaCheck.rows[0].count) === 0) {
      await client.query('INSERT INTO cartela_stock (total_cartelas, sold_cartelas) VALUES (20, 0)');
    } else {
      // Ensure total is 20 if it was set to the old default of 100
      await client.query(
        'UPDATE cartela_stock SET total_cartelas = 20 WHERE id = 1 AND total_cartelas = 100'
      );
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
};
