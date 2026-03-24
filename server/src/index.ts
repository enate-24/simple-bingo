import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two levels up from server/src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback for Render/production env vars

import { pool, initDatabase } from './db.js';
import { hashPassword, comparePassword, generateToken, authMiddleware, adminMiddleware, AuthRequest } from './auth.js';
import { sendTelegramMessage, invalidateSettingsCache } from './telegram.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'https://lottery-am.vercel.app',
    'http://localhost:5173',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// Health check - keeps Render from sleeping
app.get('/health', (req, res) => res.json({ status: 'ok', version: '2' }));

// Get current open game status (for operator to resume)
app.get('/api/game/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const operatorId = req.user!.id;
    const roundResult = await pool.query(
      `SELECT id, total_cartelas, cartela_price, prize_1, prize_2, prize_3, status, started_at
       FROM rounds WHERE status = 'open' AND operator_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [operatorId]
    );
    if (roundResult.rows.length === 0) return res.json({ open: false });
    const round = roundResult.rows[0];
    const configured = round.cartela_price != null;
    const soldResult = await pool.query(
      `SELECT COUNT(*) as sold FROM cartela_purchases WHERE round_id = $1`, [round.id]
    );
    const sold = parseInt(soldResult.rows[0].sold);
    res.json({
      open: true,
      configured,
      roundId: round.id,
      cartelaPrice: round.cartela_price,
      prize1: round.prize_1,
      prize2: round.prize_2,
      prize3: round.prize_3,
      totalCartelas: round.total_cartelas,
      soldCartelas: sold,
      remaining: round.total_cartelas - sold,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get game status' });
  }
});

// Telegram test endpoint
app.get('/api/test-telegram', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await pool.query('SELECT key, value FROM system_settings WHERE user_id = $1', [userId]);
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;
    console.log('[Test] DB settings keys for user', userId, ':', Object.keys(map));
  } catch (e: any) {
    console.error('[Test] DB error:', e.message);
  }
  try {
    await sendTelegramMessage('🧪 <b>Test message from server</b>', userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, role, balance, is_active',
      [email, passwordHash, full_name]
    );
    
    const user = result.rows[0];
    const token = generateToken(user.id, user.email, user.role);
    
    res.json({ user, token });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Signup failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user.id, user.email, user.role);
    const { password_hash, ...userWithoutPassword } = user;
    
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// User routes
app.get('/api/user/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, balance, is_active, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/user/transactions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Start game route
app.post('/api/game/start', authMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { selected_numbers, phone_number, customer_name, cartela_price, prize1, prize2, prize3 } = req.body;
    const operatorId = req.user!.id;

    if (!selected_numbers || !Array.isArray(selected_numbers) || selected_numbers.length === 0) {
      return res.status(400).json({ error: 'Selected numbers are required' });
    }

    await client.query('BEGIN');

    // Get operator's open round (locked)
    const roundResult = await client.query(
      `SELECT id, total_cartelas, cartela_price FROM rounds WHERE status = 'open' AND operator_id = $1 ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [operatorId]
    );
    if (roundResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }
    const round = roundResult.rows[0];
    const roundId = round.id;

    // Count sold cartelas for this round
    const soldResult = await client.query(
      `SELECT COUNT(*) as sold FROM cartela_purchases WHERE round_id = $1`, [roundId]
    );
    const sold = parseInt(soldResult.rows[0].sold);
    if (sold >= round.total_cartelas) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No cartelas remaining for this game.' });
    }

    // Check cartela not already taken in this round
    const dupCheck = await client.query(
      `SELECT 1 FROM cartela_purchases WHERE round_id = $1 AND cartela_number = $2 LIMIT 1`,
      [roundId, selected_numbers[0]]
    );
    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cartela already taken' });
    }

    await client.query(
      'INSERT INTO cartela_purchases (round_id, cartela_number, customer_phone, customer_name) VALUES ($1, $2, $3, $4)',
      [roundId, selected_numbers[0], phone_number || 'N/A', customer_name || null]
    );

    await client.query(
      `UPDATE rounds SET
        cartela_price = COALESCE(cartela_price, $1),
        prize_1 = COALESCE(prize_1, $2),
        prize_2 = COALESCE(prize_2, $3),
        prize_3 = COALESCE(prize_3, $4)
       WHERE id = $5`,
      [cartela_price || null, prize1 || null, prize2 || null, prize3 || null, roundId]
    );

    // Also keep cartela_stock in sync for backward compat
    await client.query(
      'UPDATE cartela_stock SET sold_cartelas = sold_cartelas + 1, updated_at = NOW() WHERE id = 1'
    );

    await client.query('COMMIT');

    stockCache = null;

    // Fire-and-forget Telegram
    buildCartelaListMessage({ price: cartela_price || '?', prize1: prize1 || 'N/A', prize2: prize2 || 'N/A', prize3: prize3 || 'N/A' }, operatorId)
      .then(msg => sendTelegramMessage(msg, operatorId).catch(console.error))
      .catch(console.error);

    const remaining = round.total_cartelas - sold - 1;
    if (remaining > 0) {
      startBroadcast({ price: cartela_price || '?', prize1: prize1 || 'N/A', prize2: prize2 || 'N/A', prize3: prize3 || 'N/A' }, operatorId);
    } else {
      stopBroadcast();
    }

    res.json({ success: true, cartela_number: selected_numbers[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to register cartela' });
  } finally {
    client.release();
  }
});

// Get current game
app.get('/api/game/current', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM games WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'in_progress']
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get current game error:', error);
    res.status(500).json({ error: 'Failed to get current game' });
  }
});

// Update game with drawn number
app.post('/api/game/draw', authMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current game
    const gameResult = await client.query(
      'SELECT * FROM games WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'in_progress']
    );

    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No active game found' });
    }

    const game = gameResult.rows[0];
    const { drawn_number } = req.body;

    if (!drawn_number) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Drawn number is required' });
    }

    // Update game with new drawn number
    const updatedDrawnNumbers = [...game.drawn_numbers, drawn_number];
    const isCompleted = updatedDrawnNumbers.length >= 3;

    await client.query(
      'UPDATE games SET drawn_numbers = $1, status = $2, completed_at = $3 WHERE id = $4',
      [updatedDrawnNumbers, isCompleted ? 'completed' : 'in_progress', isCompleted ? new Date() : null, game.id]
    );

    await client.query('COMMIT');

    res.json({ success: true, gameCompleted: isCompleted });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Draw error:', error);
    res.status(500).json({ error: 'Draw failed' });
  } finally {
    client.release();
  }
});

// Get game history
app.get('/api/games/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM games WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get game history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

// Draw route (legacy - kept for compatibility)
app.post('/api/draw', authMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userResult = await client.query(
      'SELECT balance, is_active, role FROM users WHERE id = $1 FOR UPDATE',
      [req.user!.id]
    );
    
    const user = userResult.rows[0];
    const drawCost = 30.00;
    
    // Admins cannot draw
    if (user.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admins cannot play the lottery' });
    }
    
    if (!user.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    if (user.balance < drawCost) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'Insufficient balance' });
    }
    
    await client.query(
      'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
      [drawCost, req.user!.id]
    );
    
    await client.query(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [req.user!.id, drawCost, 'debit', 'Lottery draw']
    );
    
    const newBalanceResult = await client.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      newBalance: parseFloat(newBalanceResult.rows[0].balance),
      cost: drawCost
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Draw failed' });
  } finally {
    client.release();
  }
});

// Packages routes
app.get('/api/packages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM packages WHERE is_active = true ORDER BY price ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Admin routes
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, balance, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { email, password, full_name, role, balance } = req.body;
    
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, balance) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, balance, is_active',
      [email, passwordHash, full_name, role || 'user', balance || 0]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

app.patch('/api/admin/users/:id/balance', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { amount, description } = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
      [amount, id]
    );
    
    await client.query(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [id, Math.abs(amount), amount > 0 ? 'credit' : 'debit', description || 'Admin adjustment']
    );
    
    const result = await client.query(
      'SELECT id, email, full_name, role, balance, is_active FROM users WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update balance' });
  } finally {
    client.release();
  }
});

app.patch('/api/admin/users/:id/status', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, role, balance, is_active',
      [is_active, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.patch('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, password, role } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (full_name !== undefined) { fields.push(`full_name = $${idx++}`); values.push(full_name); }
    if (email !== undefined)     { fields.push(`email = $${idx++}`);     values.push(email); }
    if (role !== undefined)      { fields.push(`role = $${idx++}`);      values.push(role); }
    if (password) {
      const { hashPassword } = await import('./auth.js');
      fields.push(`password_hash = $${idx++}`);
      values.push(await hashPassword(password));
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, full_name, role, balance, is_active`,
      values
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    // Delete purchases for all rounds owned by this user
    await client.query(
      `DELETE FROM cartela_purchases WHERE round_id IN (SELECT id FROM rounds WHERE operator_id = $1)`, [id]
    );
    // Delete rounds owned by this user
    await client.query(`DELETE FROM rounds WHERE operator_id = $1`, [id]);
    // Delete user's settings and payment addresses
    await client.query(`DELETE FROM system_settings WHERE user_id = $1`, [id]);
    await client.query(`DELETE FROM payment_addresses WHERE user_id = $1`, [id]);
    // Delete transactions (has ON DELETE CASCADE but be explicit)
    await client.query(`DELETE FROM transactions WHERE user_id = $1`, [id]);
    // Finally delete the user
    await client.query(`DELETE FROM users WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// Save winners for current round
app.post('/api/admin/rounds/winners', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { winners } = req.body; // [{ place: 1, cartela_number: 5 }, ...]

    // Get current open round with prize config
    const roundResult = await pool.query(
      `SELECT id, cartela_price, prize_1, prize_2, prize_3 FROM rounds WHERE status = 'open' ORDER BY started_at DESC LIMIT 1`
    );
    if (roundResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active round found' });
    }
    const round = roundResult.rows[0];
    const roundId = round.id;
    const prizes = [round.prize_1, round.prize_2, round.prize_3];

    // Look up phone numbers and names for each winner cartela
    const getCustomer = async (cartela: number) => {
      const r = await pool.query(
        'SELECT customer_phone, customer_name FROM cartela_purchases WHERE round_id = $1 AND cartela_number = $2 LIMIT 1',
        [roundId, cartela]
      );
      const row = r.rows[0];
      if (!row) return { phone: 'N/A', label: 'N/A' };
      const masked = maskPhone(row.customer_phone);
      const label = row.customer_name ? `${row.customer_name} (${masked})` : masked;
      return { phone: row.customer_phone, label };
    };

    const w1 = winners[0]?.cartela_number ?? null;
    const w2 = winners[1]?.cartela_number ?? null;
    const w3 = winners[2]?.cartela_number ?? null;
    const c1 = w1 ? await getCustomer(w1) : null;
    const c2 = w2 ? await getCustomer(w2) : null;
    const c3 = w3 ? await getCustomer(w3) : null;
    const p1 = c1?.phone ?? null;
    const p2 = c2?.phone ?? null;
    const p3 = c3?.phone ?? null;

    const isComplete = winners.length >= 3;

    await pool.query(
      `UPDATE rounds SET
        winner_1 = $1, winner_1_phone = $2,
        winner_2 = $3, winner_2_phone = $4,
        winner_3 = $5, winner_3_phone = $6,
        status = $7, completed_at = $8
       WHERE id = $9`,
      [w1, p1, w2, p2, w3, p3, isComplete ? 'completed' : 'open', isComplete ? new Date() : null, roundId]
    );

    // Send Telegram notification for the latest winner with prize
    const latestWinner = winners[winners.length - 1];
    const latestLabel = winners.length === 1 ? c1?.label : winners.length === 2 ? c2?.label : c3?.label;
    const latestPrize = prizes[winners.length - 1];
    const placeLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];

    let msg =
      `${placeLabels[winners.length - 1]} <b>Winner!</b>\n\n` +
      `🎟️ <b>Cartela:</b> #${latestWinner.cartela_number}\n` +
      `👤 <b>Customer:</b> ${latestLabel}\n` +
      `💰 <b>Prize:</b> ${latestPrize ? latestPrize + ' Birr' : 'N/A'}`;

    if (isComplete) {
      msg += `\n\n🎉 <b>All winners selected!</b>\n\n` +
        `🥇 Cartela #${w1} — ${c1?.label} — ${prizes[0] ? prizes[0] + ' Birr' : 'N/A'}\n` +
        `🥈 Cartela #${w2} — ${c2?.label} — ${prizes[1] ? prizes[1] + ' Birr' : 'N/A'}\n` +
        `🥉 Cartela #${w3} — ${c3?.label} — ${prizes[2] ? prizes[2] + ' Birr' : 'N/A'}`;
    }

    await sendTelegramMessage(msg, req.user!.id);

    res.json({ success: true, roundId, isComplete });
  } catch (error) {
    console.error('Save winners error:', error);
    res.status(500).json({ error: 'Failed to save winners' });
  }
});

// Check if winners are pre-picked for current round (without revealing them)
app.get('/api/admin/rounds/preset-status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.winner_1, r.winner_2, r.winner_3, r.winners_revealed
       FROM rounds r WHERE r.status = 'open' AND r.operator_id = $1 ORDER BY r.started_at DESC LIMIT 1`,
      [req.user!.id]
    );
    if (result.rows.length === 0) return res.json({ revealed: 0, revealedWinners: [] });
    const row = result.rows[0];
    const revealed: number = row.winners_revealed ?? 0;
    const revealedWinners: number[] = [];
    if (revealed >= 1 && row.winner_1) revealedWinners.push(row.winner_1);
    if (revealed >= 2 && row.winner_2) revealedWinners.push(row.winner_2);
    if (revealed >= 3 && row.winner_3) revealedWinners.push(row.winner_3);
    res.json({ revealed, revealedWinners });
  } catch {
    res.status(500).json({ error: 'Failed to check preset status' });
  }
});

// Get round history for a specific user (admin only)
app.get('/api/admin/users/:id/rounds', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*,
        r.preset_winner_1, r.preset_winner_2, r.preset_winner_3,
        (SELECT COUNT(*) FROM cartela_purchases WHERE round_id = r.id) as total_purchases,
        ROW_NUMBER() OVER (ORDER BY r.started_at ASC) as game_number
       FROM rounds r
       WHERE r.operator_id = $1
       ORDER BY r.started_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user rounds' });
  }
});

// Get round history
app.get('/api/admin/rounds', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const roundsResult = await pool.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM cartela_purchases WHERE round_id = r.id) as total_purchases,
        ROW_NUMBER() OVER (ORDER BY r.started_at ASC) as game_number,
        COALESCE(u.full_name, u.email, 'Unknown') as operator_name
       FROM rounds r
       LEFT JOIN users u ON u.id = r.operator_id
       ORDER BY r.started_at DESC LIMIT 100`
    );
    res.json(roundsResult.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});
app.post('/api/admin/rounds/reveal-winner', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const roundResult = await pool.query(
      `SELECT id, preset_winner_1, preset_winner_2, preset_winner_3, winners_revealed,
              prize_1, prize_2, prize_3, total_cartelas
       FROM rounds WHERE status = 'open' AND operator_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [req.user!.id]
    );
    if (roundResult.rows.length === 0) return res.status(404).json({ error: 'No active round' });
    let round = roundResult.rows[0];

    // If winners not pre-picked yet, pick them now from sold cartelas
    if (!round.preset_winner_1) {
      const soldResult = await pool.query(
        'SELECT cartela_number FROM cartela_purchases WHERE round_id = $1',
        [round.id]
      );
      const numbers: number[] = soldResult.rows.map((r: any) => r.cartela_number);
      if (numbers.length < 3) {
        return res.status(400).json({ error: `Need at least 3 sold cartelas to draw. Currently sold: ${numbers.length}` });
      }
      // Fisher-Yates shuffle
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      const [w1, w2, w3] = numbers;
      await pool.query(
        `UPDATE rounds SET preset_winner_1 = $1, preset_winner_2 = $2, preset_winner_3 = $3, winners_revealed = 0 WHERE id = $4`,
        [w1, w2, w3, round.id]
      );
      round = { ...round, preset_winner_1: w1, preset_winner_2: w2, preset_winner_3: w3, winners_revealed: 0 };
      console.log(`[Winners] On-demand pre-pick for round ${round.id}: ${w1}, ${w2}, ${w3}`);
    }

    const revealed: number = round.winners_revealed ?? 0;
    if (revealed >= 3) return res.status(400).json({ error: 'All winners already revealed' });

    const presetCols = ['preset_winner_1', 'preset_winner_2', 'preset_winner_3'];
    const winnerCols = ['winner_1', 'winner_2', 'winner_3'];
    const phoneCols  = ['winner_1_phone', 'winner_2_phone', 'winner_3_phone'];
    const prizes     = [round.prize_1, round.prize_2, round.prize_3];

    const cartela: number = round[presetCols[revealed]];
    const place = revealed + 1;

    // Look up customer info
    const custResult = await pool.query(
      'SELECT customer_phone, customer_name FROM cartela_purchases WHERE round_id = $1 AND cartela_number = $2 LIMIT 1',
      [round.id, cartela]
    );
    const cust = custResult.rows[0];
    const masked = cust ? maskPhone(cust.customer_phone) : 'N/A';
    const label  = cust?.customer_name ? `${cust.customer_name} (${masked})` : masked;

    const newRevealed = revealed + 1;
    const isComplete  = newRevealed >= 3;

    await pool.query(
      `UPDATE rounds SET ${winnerCols[revealed]} = $1, ${phoneCols[revealed]} = $2,
        winners_revealed = $3,
        status = $4, completed_at = $5
       WHERE id = $6`,
      [cartela, cust?.customer_phone ?? null, newRevealed,
       isComplete ? 'completed' : 'open', isComplete ? new Date() : null, round.id]
    );

    // Telegram notification
    const placeLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
    let msg =
      `${placeLabels[revealed]} <b>Winner!</b>\n\n` +
      `🎟️ <b>Cartela:</b> #${cartela}\n` +
      `👤 <b>Customer:</b> ${label}\n` +
      `💰 <b>Prize:</b> ${prizes[revealed] ? prizes[revealed] + ' Birr' : 'N/A'}`;

    if (isComplete) {
      const w = [round.preset_winner_1, round.preset_winner_2, round.preset_winner_3];
      msg += `\n\n🎉 <b>All winners selected!</b>\n\n` +
        `🥇 Cartela #${w[0]} — ${prizes[0] ? prizes[0] + ' Birr' : 'N/A'}\n` +
        `🥈 Cartela #${w[1]} — ${prizes[1] ? prizes[1] + ' Birr' : 'N/A'}\n` +
        `🥉 Cartela #${w[2]} — ${prizes[2] ? prizes[2] + ' Birr' : 'N/A'}`;
    }
    sendTelegramMessage(msg, req.user!.id).catch(console.error);

    res.json({ place, cartela_number: cartela, customer_label: label, prize: prizes[revealed], is_complete: isComplete });
  } catch (error) {
    console.error('Reveal winner error:', error);
    res.status(500).json({ error: 'Failed to reveal winner' });
  }
});

// Get purchases for a round
app.get('/api/admin/rounds/:id/purchases', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cartela_purchases WHERE round_id = $1 ORDER BY cartela_number ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// System settings routes
app.get('/api/admin/settings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM system_settings WHERE user_id = $1', [req.user!.id]);
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;
    res.json(map);
  } catch { res.status(500).json({ error: 'Failed to fetch settings' }); }
});

app.post('/api/admin/settings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const settings: Record<string, string> = req.body;
    const userId = req.user!.id;

    // Check if telegram was configured before for this user
    const existing = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'telegram_bot_token' AND user_id = $1 AND value IS NOT NULL AND value != ''`,
      [userId]
    );
    const isFirstTime = existing.rows.length === 0;

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(`DELETE FROM system_settings WHERE key = $1 AND user_id = $2`, [key, userId]);
      await pool.query(
        `INSERT INTO system_settings (key, value, user_id, updated_at) VALUES ($1, $2, $3, NOW())`,
        [key, value, userId]
      );
    }
    invalidateSettingsCache(userId);

    // Send self-deleting welcome message on first-time Telegram config
    const newToken = settings['telegram_bot_token'];
    const newChatId = settings['telegram_group_chat_id'];
    if (isFirstTime && newToken && newChatId) {
      try {
        const url = `https://api.telegram.org/bot${newToken}/sendMessage`;
        const msgRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: newChatId,
            text: `✅ <b>Bot Connected!</b>\n\nThis system is now linked to this group.\n\n<i>This message will be deleted in 1 minute.</i>`,
            parse_mode: 'HTML',
          }),
        });
        const msgData = await msgRes.json() as any;
        if (msgData.ok) {
          const messageId = msgData.result.message_id;
          // Delete after 60 seconds
          setTimeout(async () => {
            await fetch(`https://api.telegram.org/bot${newToken}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: newChatId, message_id: messageId }),
            });
          }, 60000);
        }
      } catch (e) {
        console.error('Welcome message error:', e);
      }
    }

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to save settings' }); }
});

// Update current open round config (price / prizes) mid-game
app.patch('/api/admin/rounds/config', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { cartela_price, prize_1, prize_2, prize_3 } = req.body;
    const result = await pool.query(
      `UPDATE rounds SET
        cartela_price = COALESCE($1, cartela_price),
        prize_1 = COALESCE($2, prize_1),
        prize_2 = COALESCE($3, prize_2),
        prize_3 = COALESCE($4, prize_3)
       WHERE status = 'open' AND operator_id = $5
       RETURNING cartela_price, prize_1, prize_2, prize_3`,
      [cartela_price || null, prize_1 || null, prize_2 || null, prize_3 || null, req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No active round' });
    res.json({ success: true, ...result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update round config' });
  }
});

// Payment address routes
app.get('/api/admin/payment-addresses', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_addresses WHERE user_id = $1 ORDER BY created_at DESC', [req.user!.id]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Failed to fetch' }); }
});

app.post('/api/admin/payment-addresses', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { label, address, type } = req.body;
    const result = await pool.query(
      'INSERT INTO payment_addresses (label, address, type, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [label, address, type || 'bank', req.user!.id]
    );
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Failed to save' }); }
});

app.delete('/api/admin/payment-addresses/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM payment_addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete' }); }
});

// Simple in-memory cache for cartela stock (1.5s TTL)
let stockCache: { data: any; ts: number } | null = null;
const STOCK_CACHE_TTL = 1500;

// Per-operator broadcast interval
let broadcastInterval: ReturnType<typeof setInterval> | null = null;
let broadcastConfig: { price: string; prize1: string; prize2: string; prize3: string } | null = null;
let broadcastOperatorId: number | null = null;

function stopBroadcast() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  broadcastOperatorId = null;
}

// Pre-pick 3 random winners from all sold cartelas and store them (hidden until revealed)
async function pickAndStoreWinners(roundId: number): Promise<void> {
  const result = await pool.query(
    'SELECT cartela_number FROM cartela_purchases WHERE round_id = $1',
    [roundId]
  );
  const numbers: number[] = result.rows.map((r: any) => r.cartela_number);
  if (numbers.length < 3) return;

  // Fisher-Yates shuffle, pick first 3
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  const [w1, w2, w3] = numbers;

  await pool.query(
    `UPDATE rounds SET preset_winner_1 = $1, preset_winner_2 = $2, preset_winner_3 = $3, winners_revealed = 0 WHERE id = $4`,
    [w1, w2, w3, roundId]
  );
  console.log(`[Winners] Pre-picked for round ${roundId}: ${w1}, ${w2}, ${w3}`);
}

function maskPhone(phone: string): string {
  const p = phone.replace(/\s/g, '');
  if (p.length < 7) return p;
  // Keep first 4 and last 3 chars, mask the middle
  return p.slice(0, 4) + '***' + p.slice(-3);
}

async function buildCartelaListMessage(config: typeof broadcastConfig, operatorId: number): Promise<string> {
  // Get open round for this operator
  const roundResult = await pool.query(
    `SELECT id, total_cartelas FROM rounds WHERE status = 'open' AND operator_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [operatorId]
  );
  if (roundResult.rows.length === 0) return '📊 No active round';
  const round = roundResult.rows[0];

  const soldResult = await pool.query(
    `SELECT cartela_number, customer_phone, customer_name FROM cartela_purchases WHERE round_id = $1 ORDER BY cartela_number ASC`,
    [round.id]
  );
  const purchaseMap: Record<number, { phone: string; name: string | null }> = {};
  for (const row of soldResult.rows) {
    purchaseMap[row.cartela_number] = { phone: row.customer_phone, name: row.customer_name };
  }
  const sold = soldResult.rows.length;
  const remaining = round.total_cartelas - sold;

  const lines: string[] = [];
  for (let i = 1; i <= round.total_cartelas; i++) {
    const entry = purchaseMap[i];
    if (entry) {
      const label = entry.name ? entry.name : maskPhone(entry.phone);
      lines.push(`${i} 👉 ${label} ✅`);
    } else {
      lines.push(`${i} 👉`);
    }
  }

  // Fetch payment addresses for this operator
  let paymentSection = '';
  try {
    const paResult = await pool.query(
      'SELECT label, address, type FROM payment_addresses WHERE user_id = $1 ORDER BY created_at ASC',
      [operatorId]
    );
    if (paResult.rows.length > 0) {
      const paLines = paResult.rows.map((r: any) => `💳 <b>${r.label}</b> (${r.type}): <code>${r.address}</code>`);
      paymentSection = `\n\n💰 <b>Payment Details</b>\n` + paLines.join('\n');
    }
  } catch {}

  return (
    `📊 <b>Game Status</b>\n` +
    `💰 <b>Price:</b> ${config?.price || 'N/A'} Birr\n` +
    `🥇 ${config?.prize1 || 'N/A'} Birr  🥈 ${config?.prize2 || 'N/A'} Birr  🥉 ${config?.prize3 || 'N/A'} Birr\n` +
    `📦 <b>Remaining:</b> ${remaining} / ${round.total_cartelas}\n\n` +
    lines.join('\n') +
    paymentSection
  );
}

function startBroadcast(config: typeof broadcastConfig, operatorId: number) {
  broadcastConfig = config;
  broadcastOperatorId = operatorId;
  if (broadcastInterval) return;
  broadcastInterval = setInterval(async () => {
    try {
      if (!broadcastOperatorId) { stopBroadcast(); return; }
      const roundResult = await pool.query(
        `SELECT total_cartelas FROM rounds WHERE status = 'open' AND operator_id = $1 ORDER BY started_at DESC LIMIT 1`,
        [broadcastOperatorId]
      );
      if (roundResult.rows.length === 0) { stopBroadcast(); return; }
      const round = roundResult.rows[0];
      const soldResult = await pool.query(
        `SELECT COUNT(*) as sold FROM cartela_purchases WHERE round_id = (SELECT id FROM rounds WHERE status='open' AND operator_id=$1 ORDER BY started_at DESC LIMIT 1)`,
        [broadcastOperatorId]
      );
      const remaining = round.total_cartelas - parseInt(soldResult.rows[0].sold);
      if (remaining <= 0) { stopBroadcast(); return; }
      const msg = await buildCartelaListMessage(broadcastConfig, broadcastOperatorId);
      await sendTelegramMessage(msg, broadcastOperatorId);
    } catch (e) {
      console.error('Broadcast error:', e);
    }
  }, 120000);
}

// Cartela stock routes — operator-scoped
app.get('/api/cartelas/stock', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const operatorId = req.user!.id;

    const roundResult = await pool.query(
      `SELECT id, total_cartelas FROM rounds WHERE status = 'open' AND operator_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [operatorId]
    );
    if (roundResult.rows.length === 0) {
      return res.json({ total_cartelas: 0, sold_cartelas: 0, remaining: 0, sold_numbers: [] });
    }
    const round = roundResult.rows[0];

    const soldResult = await pool.query(
      `SELECT cartela_number as num FROM cartela_purchases WHERE round_id = $1`,
      [round.id]
    );
    const soldNumbers = soldResult.rows.map((r: any) => r.num);
    const sold = soldNumbers.length;

    res.json({
      total_cartelas: round.total_cartelas,
      sold_cartelas: sold,
      remaining: round.total_cartelas - sold,
      sold_numbers: soldNumbers,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cartela stock' });
  }
});

app.patch('/api/admin/cartelas/stock', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { total_cartelas } = req.body;
    const result = await pool.query(
      'UPDATE cartela_stock SET total_cartelas = $1, updated_at = NOW() WHERE id = 1 RETURNING *',
      [total_cartelas]
    );
    const stock = result.rows[0];
    res.json({ ...stock, remaining: stock.total_cartelas - stock.sold_cartelas });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cartela stock' });
  }
});

app.post('/api/admin/cartelas/reset', authMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { total_cartelas, cartela_price, prize_1, prize_2, prize_3 } = req.body;
    const total = total_cartelas ?? 20;

    await client.query('BEGIN');

    // Deduct 30 Birr game fee from operator balance (only when starting a new game with config)
    const isNewGame = cartela_price != null;
    if (isNewGame) {
      const GAME_FEE = 30;
      const userResult = await client.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [req.user!.id]
      );
      const currentBalance = parseFloat(userResult.rows[0]?.balance ?? '0');
      if (currentBalance < GAME_FEE) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: 'Insufficient balance. 30 Birr required to start a game.' });
      }
      await client.query(
        'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
        [GAME_FEE, req.user!.id]
      );
      await client.query(
        'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [req.user!.id, GAME_FEE, 'debit', 'Game fee (30 Birr)']
      );
    }

    // Close any open round for THIS operator only
    await client.query(`UPDATE rounds SET status = 'completed', completed_at = NOW() WHERE status = 'open' AND operator_id = $1`, [req.user!.id]);

    // Create new round with operator_id
    const roundInsert = await client.query(
      `INSERT INTO rounds (total_cartelas, cartela_price, prize_1, prize_2, prize_3, operator_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [total, cartela_price || null, prize_1 || null, prize_2 || null, prize_3 || null, req.user!.id]
    );
    const newRoundId = roundInsert.rows[0].id;

    // Pre-pick 3 winners immediately from the full cartela range (1..total)
    const allNumbers: number[] = Array.from({ length: total }, (_, i) => i + 1);
    for (let i = allNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allNumbers[i], allNumbers[j]] = [allNumbers[j], allNumbers[i]];
    }
    const [w1, w2, w3] = allNumbers;
    await client.query(
      `UPDATE rounds SET preset_winner_1 = $1, preset_winner_2 = $2, preset_winner_3 = $3, winners_revealed = 0 WHERE id = $4`,
      [w1, w2, w3, newRoundId]
    );
    console.log(`[Winners] Pre-picked at game start for round ${newRoundId}: ${w1}, ${w2}, ${w3}`);

    const result = await client.query(
      'UPDATE cartela_stock SET total_cartelas = $1, sold_cartelas = 0, round_started_at = NOW(), updated_at = NOW() WHERE id = 1 RETURNING *',
      [total]
    );
    const stock = result.rows[0];

    await client.query('COMMIT');

    stockCache = null;
    stopBroadcast();

    await sendTelegramMessage(
      `🔄 <b>New Round Started!</b>\n📦 <b>${stock.total_cartelas} cartelas</b> available. Good luck! 🍀`,
      req.user!.id
    );

    res.json({ ...stock, remaining: stock.total_cartelas - stock.sold_cartelas });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to reset cartela stock' });
  } finally {
    client.release();
  }
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
