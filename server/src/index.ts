import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, initDatabase } from './db.js';
import { hashPassword, comparePassword, generateToken, authMiddleware, adminMiddleware, AuthRequest } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
    const { selected_numbers } = req.body;

    if (!selected_numbers || !Array.isArray(selected_numbers) || selected_numbers.length === 0) {
      return res.status(400).json({ error: 'Selected numbers are required' });
    }

    await client.query('BEGIN');

    // Check user balance and role
    const userResult = await client.query(
      'SELECT balance, is_active, role FROM users WHERE id = $1 FOR UPDATE',
      [req.user!.id]
    );
    const user = userResult.rows[0];
    const gameCost = 10.00;

    if (user.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admins cannot play the lottery' });
    }
    if (!user.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    if (parseFloat(user.balance) < gameCost) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'Insufficient balance' });
    }

    // Deduct 10 birr for the game
    await client.query(
      'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
      [gameCost, req.user!.id]
    );

    // Get the next game number for this user
    const gameNumberResult = await client.query(
      'SELECT COALESCE(MAX(game_number), 0) + 1 as next_number FROM games WHERE user_id = $1',
      [req.user!.id]
    );
    const gameNumber = gameNumberResult.rows[0].next_number;

    // Create new game
    const result = await client.query(
      'INSERT INTO games (user_id, game_number, selected_numbers, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user!.id, gameNumber, selected_numbers, 'in_progress']
    );

    await client.query(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [req.user!.id, gameCost, 'debit', `Lottery game #${gameNumber}`]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
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
    const drawCost = 10.00;
    
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

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
